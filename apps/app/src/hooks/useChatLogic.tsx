"use client";
import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { useChatStore } from "@/store/chat.store";
import { useConversations } from "@/hooks/useConversation";
import { useSettingsStore } from "@/store/setting.store";
import { DEFAULT, CONFIG } from "@/lib/constants";
import { useWalletStore } from "@/store/wallet.store";
import { SSEParser } from "@/lib/utils/SSEParser";
import { getFollowBackPrompt } from "@/lib/utils/prompts";

const CUSTOM_SERVICE_PARAM_KEYS = [
  "custom-service_url",
  "custom_service_url",
  "service_url",
] as const;
const CUSTOM_MODEL_PARAM_KEYS = [
  "custom-model",
  "custom_model",
  "service_model",
] as const;

function readFirstParam(
  params: { get: (key: string) => string | null },
  keys: readonly string[],
): string | null {
  for (const key of keys) {
    const value = params.get(key)?.trim();
    if (value) return value;
  }
  return null;
}

export function useChatLogic() {
  const [query, setQuery] = useState("");
  const [model, setModel] = useState<string>(() => {
    if (typeof window === "undefined") return DEFAULT.MODEL;
    return localStorage.getItem("llmmodel") || DEFAULT.MODEL;
  });
  const [state, setState] = useState<"idle" | "loading" | null>(null);
  const [reasoningChunks, setReasoningChunks] = useState<string[]>([]);
  const [llmChunks, setLLMChunks] = useState<string[]>([]);
  const [event, setEvent] = useState<string>("");
  const [mcp, setmcp] = useState(false);

  // Buffer refs for throttling
  const llmBufferRef = useRef<string[]>([]);
  const reasoningBufferRef = useRef<string[]>([]);
  const throttleTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // --- Stores ---
  const {
    addMessage,
    loadChatHistory,
    setSearch,
    search,
    setSelectedChatId,
    setSelectedModel,
    selectedChatId,
    selectedModel,
    thinking,
    setThinking,
    updateThreadTitle,
    updateThreadTool,
    deleteSingleChat,
    setFollowUp,
    _setMcp,
    setTool,
    tool,
    setPendingTool,
    pendingTool,
    pendingQuery,
    clearPendingQuery,
  } = useChatStore();

  const { localConfig } = useSettingsStore();
  const { conversations, scrollRef } = useConversations();

  // --- Routing & Refs ---
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const customServiceUrl = useMemo(
    () => readFirstParam(searchParams, CUSTOM_SERVICE_PARAM_KEYS),
    [searchParams],
  );
  const customServiceModel = useMemo(
    () => readFirstParam(searchParams, CUSTOM_MODEL_PARAM_KEYS),
    [searchParams],
  );
  const routeThreadId = Array.isArray(params.id) ? params.id[0] : params.id;
  const handledRef = useRef(false);
  const controllerRef = useRef<AbortController | null>(null);

  // --- Wallet / Auth ---
  const {
    wallet,
    connectWallet,
    isConnected,
    checkPhantom,
    verifyConnection,
    authMode,
    nosanaApiKey,
    isApiKeyConnected,
    getCredential,
  } = useWalletStore();

  // --- Effects ---
  useEffect(() => {
    checkPhantom();
    setTimeout(verifyConnection, 1000);
  }, [checkPhantom, verifyConnection]);

  useEffect(() => {
    const init = async () => {
      const modelParam = searchParams.get("model");
      const modelToUse =
        customServiceModel ||
        modelParam ||
        localStorage.getItem("llmmodel") ||
        DEFAULT.MODEL;

      const mcpParams = searchParams.get("tool");
      if (mcpParams && mcpParams === "deployer") {
        setTool(mcpParams);
        setmcp(true);
        _setMcp(true);
      } else {
        setTool(undefined);
        setmcp(false);
        _setMcp(false);
      }

      setModel(modelToUse);
      setSelectedModel(modelToUse);
      if (typeof window !== "undefined" && !localStorage.getItem("llmmodel")) {
        localStorage.setItem("llmmodel", modelToUse);
      }

      setSelectedChatId(routeThreadId || null);
      await loadChatHistory();

      // Set tool for this thread
      if (routeThreadId) {
        await updateThreadTool(
          routeThreadId,
          mcpParams === "deployer" ? "deployer" : undefined,
        );
      }

      const urlQuery = searchParams.get("q");
      const queryToProcess = pendingQuery || urlQuery;

      if (queryToProcess && !handledRef.current) {
        handledRef.current = true;
        setQuery(queryToProcess);
        await handleAskChunk(new Event("submit"), queryToProcess, modelToUse);

        if (pendingQuery) {
          clearPendingQuery();
        }

        if (routeThreadId) {
          const nextParams = new URLSearchParams();
          if (mcpParams === "deployer") nextParams.set("tool", "deployer");
          if (customServiceUrl) {
            nextParams.set("custom-service_url", customServiceUrl);
          }
          if (customServiceModel) {
            nextParams.set("custom-model", customServiceModel);
          }
          const nextQuery = nextParams.toString();
          router.replace(
            `/ask/${routeThreadId}${nextQuery ? `?${nextQuery}` : ""}`,
          );
        }
      }
    };
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, customServiceModel, customServiceUrl]);

  async function ensureWallet() {
    try {
      const currentState = useWalletStore.getState();
      // If API key is connected, no wallet needed
      if (currentState.isApiKeyConnected && currentState.nosanaApiKey) {
        console.log("✅ Using API key mode — no wallet needed");
        return;
      }

      if (!currentState.wallet || !currentState.isConnected) {
        console.log("🔄 Wallet not connected, attempting to connect...");
        await connectWallet();

        await new Promise((resolve) => setTimeout(resolve, 1000));

        const updatedState = useWalletStore.getState();
        if (!updatedState.wallet && !updatedState.isApiKeyConnected) {
          throw new Error(
            "No connection available. Please connect a wallet or set a Nosana API key.",
          );
        }

        console.log("✅ Wallet connected successfully");
      }
    } catch (err: any) {
      console.error("Auth connection failed:", err);
      throw new Error(`Connection failed: ${err.message}`);
    }
  }

  const customConfig = useMemo(() => getCustomConfig(), []);

  const walletCondition = useMemo(
    () =>
      tool === "deployer" &&
      ((isConnected && wallet) || (isApiKeyConnected && nosanaApiKey)),
    [tool, isConnected, wallet, isApiKeyConnected, nosanaApiKey],
  );

  const handleAskChunk = useCallback(
    async (
      e:
        | React.FormEvent<HTMLFormElement>
        | React.KeyboardEvent<HTMLTextAreaElement>
        | Event
        | undefined,
      queryOverride?: string,
      modelOverride?: string,
      toolFollowUp?: boolean,
    ) => {
      if (e) e.preventDefault();
      const effectiveQuery = queryOverride ?? query;
      if (state === "loading" || !effectiveQuery) return;

      //cleanUp
      const userMessageId = crypto.randomUUID();
      setState("loading");
      if (!toolFollowUp)
        addMessage({
          role: "user",
          content: effectiveQuery,
          id: userMessageId,
          type: "message",
        });
      setQuery("");
      setReasoningChunks([]);
      setLLMChunks([]);
      setPendingTool(null);

      //abort controller
      controllerRef.current = new AbortController();
      const { signal } = controllerRef.current;

      //variable declared to store stuffs
      let finalLLM = "";
      let finalThinking = "";
      let responseTime = 0;
      let followUpQuestions: { question: string }[] = [];
      let fallbackLLM = "";

      //model configured
      const DEFAULT_MODEL = DEFAULT.MODEL;
      const modelToSend =
        modelOverride || selectedModel || model || DEFAULT_MODEL;
      try {
        //setting out the API KEYs and headers
        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        const tavilyKey = localStorage.getItem("TavilyApiKey");
        if (tavilyKey) {
          headers["x-tavily-key"] = tavilyKey;
        }
        const deployedModelPayload = customServiceUrl
          ? {
              baseURL: customServiceUrl,
              model: customServiceModel || modelToSend,
            }
          : undefined;

        //making backend ai request
        const res = await fetch(`/api/v2/ask`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            query: effectiveQuery,
            model: modelToSend,
            mode: tool ? tool : undefined,
            customConfig: customConfig,
            walletPublicKey: walletCondition ? getCredential() : undefined,
            chats: conversations.slice(-50).map((c) => ({
              role: c.role,
              content: c.content,
              metadata: {
                status: c.type,
                id: c.id,
                reasoning: c.reasoning,
                model: c.model,
              },
            })),
            customPrompt:
              typeof window !== "undefined"
                ? localStorage.getItem("customPrompt")
                : null,
            websearch: search || false,
            thinking: thinking || false,
            threadId: routeThreadId || selectedChatId || undefined,
            chatId: userMessageId,
            deployedModel: deployedModelPayload,
          }),
          signal,
        });

        //zod error handling
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));

          let errorsArray: { message: string; path: string[]; code: string }[] =
            [];
          try {
            errorsArray =
              typeof data.error === "string"
                ? JSON.parse(data.error)
                : data.error;
          } catch {
            errorsArray = [
              {
                message: data.error || "Unknown error",
                path: [],
                code: "unknown",
              },
            ];
          }

          if (Array.isArray(errorsArray) && errorsArray.length > 0) {
            const content = errorsArray
              .map((e: { message: string }) => e.message)
              .join("; ");

            const reasoning = errorsArray
              .map((e: { path: string[]; message: string; code: string }) => {
                const path =
                  e.path && e.path.length ? e.path.join(".") : "(root)";
                return `${path}: ${e.message} [${e.code}]`;
              })
              .join("\n");

            const error = new Error(content);
            (error as Error & { reasoning?: string }).reasoning = reasoning;
            throw error;
          }

          throw new Error(
            `Server error: ${res.status} | ${data.error || res.statusText}`,
          );
        }

        //empty body handling
        if (!res.body) {
          throw new Error("Response body is empty.");
        }

        // Throttled UI updates
        const flushBuffers = () => {
          if (llmBufferRef.current.length > 0) {
            setLLMChunks((prev) => [...prev, ...llmBufferRef.current]);
            llmBufferRef.current = [];
          }
          if (reasoningBufferRef.current.length > 0) {
            setReasoningChunks((prev) => [
              ...prev,
              ...reasoningBufferRef.current,
            ]);
            reasoningBufferRef.current = [];
          }
          throttleTimeoutRef.current = null;
        };

        const queueUpdate = () => {
          if (!throttleTimeoutRef.current) {
            throttleTimeoutRef.current = setTimeout(flushBuffers, 80);
          }
        };

        //parsing the chunk
        const reader = res.body.getReader();
        const parser = new SSEParser();
        let searchResult: { url: string; title: string; content?: string }[] =
          [];

        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            flushBuffers();
            break;
          }

          const events = parser.processChunk(value);

          for (const { event: eventType, data: dataRaw } of events) {
            try {
              const data = JSON.parse(dataRaw);
              //handling various events
              switch (eventType) {
                case "thinking": {
                  const text = data.toString();
                  reasoningBufferRef.current.push(text);
                  finalThinking += text;
                  queueUpdate();
                  break;
                }

                case "event":
                  setEvent(data.toString());
                  break;

                case "llmResult": {
                  const text = data.toString();
                  llmBufferRef.current.push(text);
                  finalLLM += text;
                  queueUpdate();
                  break;
                }

                case "threadTitle":
                  if (selectedChatId)
                    updateThreadTitle(
                      String(routeThreadId || selectedChatId),
                      data.toString(),
                    ).catch(console.error);
                  break;

                case "searchResult":
                  searchResult = JSON.parse(data);
                  break;

                //stream based error handling
                case "error":
                  if (localConfig.showErrorMessages) {
                    addMessage({
                      role: "model",
                      model: modelToSend,
                      reasoning: `An error occurred: ${data.message || data}}`,
                      content: `An error occurred: in Response from ${(data.message || data).substring(0, 50)}... Expand to check full error message.`,
                      id: crypto.randomUUID(),
                      type: "error",
                    });
                  }
                  console.error("API Error:", data.message || data);
                  setState("idle");
                  break;

                //tools execution approval
                case "toolExecute": {
                  try {
                    const parsed = JSON.parse(data);
                    const funcName = parsed.toolname || "UnknownTool";
                    const prompt = parsed.prompt;

                    console.log(parsed);
                    const commonCancel = async () => {
                      await handleAskChunk(
                        undefined,
                        getFollowBackPrompt({
                          funcName: funcName,
                          status: "cancelled",
                          result:
                            "no result as approval cancelled by user itself | ask user what happend? do you want any refinement? show tools remember prev chat and conclude?",
                        }),
                        "openai/qwen3:0.6b",
                        true,
                      );
                      console.log(`✖ Cancelled: ${funcName}`);
                      setPendingTool(null);
                    };

                    await ensureWallet();
                    switch (funcName) {
                      case "createJob":
                        setPendingTool({
                          funcName,
                          prompt,
                          heading: "JOB definition confirmation",
                          onConfirm: async () => {
                            try {
                              console.log(`▶ Executing ${funcName}`);
                              const approvedJobDef =
                                pendingTool?.prompt || parsed.prompt;
                              const { validateJobDefinition } = await import(
                                "@nosana/sdk"
                              );
                              const r = validateJobDefinition(approvedJobDef);
                              if (!r.success) {
                                const validationErrors = JSON.stringify(
                                  r.errors || [],
                                );
                                throw new Error(
                                  `Invalid job definition: ${validationErrors}`,
                                );
                              }
                              const { createJob } = await import(
                                "@/lib/nosana/createJob"
                              );
                              const result = await createJob(
                                approvedJobDef,
                                parsed.args.marketPubKey,
                                parsed.args.timeoutSeconds / 60,
                              );
                              if (!result.jobId)
                                alert(
                                  `consider checking job manually on nosana dashboard something went wrong no jobId returned ${CONFIG.EXPLORER_URL}`,
                                );

                              const curlSnippet =
                                parsed?.args?.provider === "huggingface" &&
                                parsed?.args?.testGeneration
                                  ? `
                                # You can test your deployment using:
                                curl -s -X POST <service_url>/generate \\
                                  -H "Content-Type: application/json" \\
                                  -H "Authorization: Bearer <api_key>" \\
                                  -d '{"inputs": "hi"}'
                                `
                                  : "";

                              const jobDetails = (result?.result?.jobDetails ||
                                {}) as Record<string, any>;
                              const jobId = result?.jobId || "";
                              const serviceUrl =
                                (typeof jobDetails.serviceUrl === "string" &&
                                  jobDetails.serviceUrl) ||
                                (typeof jobDetails.service_url === "string" &&
                                  jobDetails.service_url) ||
                                (typeof jobDetails?.jobResponse?.serviceUrl ===
                                  "string" &&
                                  jobDetails.jobResponse.serviceUrl) ||
                                (typeof jobDetails?.jobResponse?.service_url ===
                                  "string" &&
                                  jobDetails.jobResponse.service_url) ||
                                "";

                              let nosanaChatUrl: string | null = null;
                              let deployedModelName: string | null = null;
                              let deployedModelBaseURL: string | null = null;

                              if (
                                jobId &&
                                serviceUrl &&
                                typeof window !== "undefined"
                              ) {
                                const {
                                  saveDeployedChatModelFromJob,
                                  inferModelNameFromJobDef,
                                } = await import("@/lib/nosana/deployedModels");
                                const saved = saveDeployedChatModelFromJob({
                                  jobId,
                                  serviceUrl,
                                  jobDef: approvedJobDef,
                                });

                                const extractedModel =
                                  inferModelNameFromJobDef(approvedJobDef);
                                const savedModel =
                                  saved?.model && saved.model !== "local-model"
                                    ? saved.model
                                    : null;

                                deployedModelName =
                                  savedModel || extractedModel || null;
                                deployedModelBaseURL =
                                  saved?.baseURL || serviceUrl;

                                const chatParams = new URLSearchParams();
                                chatParams.set(
                                  "custom-service_url",
                                  serviceUrl,
                                );
                                if (deployedModelName) {
                                  chatParams.set("model", deployedModelName);
                                  chatParams.set(
                                    "custom-model",
                                    deployedModelName,
                                  );
                                }
                                nosanaChatUrl = `${window.location.origin}/ask?${chatParams.toString()}`;
                              }

                              await handleAskChunk(
                                undefined,
                                getFollowBackPrompt({
                                  funcName: funcName,
                                  status: "approved",
                                  result: {
                                    jobId: jobId || null,
                                    serviceUrl: serviceUrl || null,
                                    nosanaChatUrl,
                                    deployedModel: deployedModelName,
                                    inferenceBaseURL: deployedModelBaseURL,
                                    explorerUrl:
                                      jobDetails.explorerUrl ||
                                      (jobId
                                        ? `${CONFIG.EXPLORER_URL}/jobs/${jobId}`
                                        : CONFIG.EXPLORER_URL),
                                    testGenerationCurl:
                                      curlSnippet.trim() || null,
                                  },
                                }),
                                undefined,
                                true,
                              );
                              // alert("✅ Job created successfully");
                            } catch (err) {
                              const errorMessage =
                                err instanceof Error
                                  ? err.message
                                  : String(err);
                              alert(
                                "❌ " + (errorMessage || "Error creating job"),
                              );
                              await handleAskChunk(
                                undefined,
                                getFollowBackPrompt({
                                  funcName: funcName,
                                  status: "failed",
                                  result: `The tool failed with error: ${errorMessage}`,
                                }),
                                undefined,
                                true,
                              );
                              // console.error(`❌ Error in ${funcName}:`, err);
                            } finally {
                              setPendingTool(null);
                            }
                          },
                          onCancel: commonCancel,
                        });
                        break;

                      case "stopJob":
                        setPendingTool({
                          funcName,
                          prompt,
                          heading: "confirm JOB stop",
                          onConfirm: async () => {
                            try {
                              console.log(`▶ Executing ${funcName}`);
                              const { stopJob } = await import(
                                "@/lib/nosana/stopJob"
                              );
                              const result = await stopJob(parsed.args.jobId);
                              await handleAskChunk(
                                undefined,
                                getFollowBackPrompt({
                                  funcName: funcName,
                                  status: "approved",
                                  result: result.result,
                                }),
                                undefined,
                                true,
                              );
                            } catch (err) {
                              const errorMessage =
                                err instanceof Error
                                  ? err.message
                                  : String(err);
                              await handleAskChunk(
                                undefined,
                                getFollowBackPrompt({
                                  funcName: funcName,
                                  status: "failed",
                                  result: errorMessage,
                                }),
                                undefined,
                                true,
                              );
                              // alert("❌ " + ((err as Error).message || "Error stopping job"));
                              console.error(`❌ Error in ${funcName}:`, err);
                            } finally {
                              setPendingTool(null);
                            }
                          },
                          onCancel: commonCancel,
                        });
                        break;

                      case "extendJobRuntime":
                        setPendingTool({
                          funcName,
                          prompt,
                          heading: "extend JOB runtime confirmation",
                          onConfirm: async () => {
                            try {
                              console.log(`▶ Executing ${funcName}`);
                              const { extendJob } = await import(
                                "@/lib/nosana/extendjob"
                              );
                              const result = await extendJob(
                                parsed.args.jobId,
                                parsed.args.extensionSeconds / 60,
                              );
                              await handleAskChunk(
                                undefined,
                                getFollowBackPrompt({
                                  funcName: funcName,
                                  status: "approved",
                                  result: `the job extended for ${parsed.args.extensionSeconds / 60} minutes  successfully with result: ${result}`,
                                }),
                                undefined,
                                true,
                              );
                              // alert("✅ Job extended");
                            } catch (err) {
                              const errorMessage =
                                err instanceof Error
                                  ? err.message
                                  : String(err);
                              console.error(`❌ Error in ${funcName}:`, err);
                              await handleAskChunk(
                                undefined,
                                getFollowBackPrompt({
                                  funcName: funcName,
                                  status: "failed",
                                  result: errorMessage,
                                }),
                                undefined,
                                true,
                              );
                              alert(
                                "❌ " + (errorMessage || "Error extending job"),
                              );
                            } finally {
                              setPendingTool(null);
                            }
                          },
                          onCancel: commonCancel,
                        });
                        break;

                      default:
                        console.warn(`⚠️ Unknown tool name: ${funcName}`);
                        break;
                    }
                  } catch (err) {
                    console.error(
                      "❌ Failed to parse toolExecute data:",
                      err,
                      data,
                    );
                  }
                  break;
                }

                case "Duration":
                  responseTime = data;
                  console.log("Response time (ms):", responseTime);
                  break;

                default:
                  if (eventType?.toLowerCase() === "followup") {
                    try {
                      followUpQuestions = JSON.parse(data);
                      setFollowUp(followUpQuestions);
                    } catch (err) {
                      console.error(
                        "Failed to parse follow-up questions:",
                        err,
                        data,
                      );
                    }
                  }
                  break;
              }
            } catch (err) {
              if (eventType === "llmResult" && typeof dataRaw === "string") {
                const rawText = dataRaw.trim();
                if (rawText) {
                  llmBufferRef.current.push(rawText);
                  fallbackLLM += rawText;
                  queueUpdate();
                }
              }
              console.error("Failed to parse SSE chunk:", err, dataRaw);
            }
          }
        }

        //wrapping UP
        const finalContent = (finalLLM + fallbackLLM).trim();
        if (finalContent !== "" || finalThinking.trim() !== "") {
          addMessage({
            role: "model",
            query: query || undefined,
            content: finalContent,
            collapsed: true,
            reasoning: finalThinking.trim() ? finalThinking : undefined,
            model: modelToSend,
            search: searchResult,
            id: crypto.randomUUID(),
            responseTime: responseTime || undefined,
            followUps: followUpQuestions || [],
            type: "message",
          });
        } else if (selectedChatId) {
          if (!localConfig.showErrorMessages) {
            deleteSingleChat(selectedChatId, userMessageId).catch(
              console.error,
            );
            alert("No response from the model.");
          }
        }
      } catch (error) {
        if ((error as Error).name === "AbortError") {
          addMessage({
            role: "model",
            content: finalLLM
              ? `${finalLLM}\n\n  ${`...aborted`}`
              : "`...aborted`",
            collapsed: true,
            reasoning: finalThinking.trim() ? finalThinking : undefined,
            model: selectedModel,
            id: crypto.randomUUID(),
            type: "aborted",
          });
        } else {
          console.error("Fetch/Stream error:", error);
          if (selectedChatId)
            deleteSingleChat(selectedChatId, userMessageId).catch(
              console.error,
            );

          if (localConfig.showErrorMessages) {
            alert(selectedModel);
            addMessage({
              role: "model",
              type: "error",
              model: modelToSend,
              content: (error as Error).message,
              reasoning:
                (error as Error & { reasoning?: string }).reasoning ||
                (error as Error).message,
              id: crypto.randomUUID(),
            });
          }
        }
      } finally {
        //cleanUp
        setReasoningChunks([]);
        setLLMChunks([]);
        setState("idle");
        setEvent("");
        controllerRef.current = null;
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    },
    [
      state,
      query,
      selectedModel,
      model,
      tool,
      isConnected,
      wallet,
      isApiKeyConnected,
      nosanaApiKey,
      customConfig,
      conversations,
      search,
      thinking,
      customServiceUrl,
      customServiceModel,
      routeThreadId,
      selectedChatId,
      walletCondition,
    ],
  );

  return {
    model,
    setModel,
    selectedModel,
    setSelectedModel,
    setSearch,
    thinking,
    setThinking,
    search,
    query,
    setQuery,
    state,
    reasoningChunks,
    llmChunks,
    conversations,
    scrollRef,
    handleAskChunk,
    event,
    setEvent,
    controllerRef,
    setState,
    setReasoningChunks,
    setLLMChunks,
    mcp,
    setmcp,
  };
}

type ContextConfig = {
  absoluteMaxTokens: number;
  maxContextTokens: number;
  prevChatLimit: number;
  truncateFrom: "start" | "end";
};

type AIConfig = {
  temperature: number;
  max_tokens: number;
  top_p: number;
  presence_penalty: number;
  frequency_penalty: number;
  stop: string[];
  followUp: boolean;
  context: ContextConfig;
};

export function getCustomConfig(): AIConfig {
  const DEFAULT_AI_CONFIG: AIConfig = {
    temperature: 0.7,
    max_tokens: 2000,
    top_p: 1,
    presence_penalty: 0,
    frequency_penalty: 0,
    stop: [],
    followUp: true,
    context: {
      absoluteMaxTokens: 5000,
      maxContextTokens: 3000,
      prevChatLimit: 6,
      truncateFrom: "end",
    },
  };

  if (typeof window === "undefined") {
    return DEFAULT_AI_CONFIG;
  }

  let storedConfig: Partial<AIConfig> = {};
  let storedLocalConfig: Partial<{ followUp: boolean }> = {};

  try {
    storedConfig = JSON.parse(localStorage.getItem("customAIConfig") || "{}");
  } catch {
    storedConfig = {};
  }

  try {
    storedLocalConfig = JSON.parse(localStorage.getItem("localConfig") || "{}");
  } catch {
    storedLocalConfig = {};
  }

  return {
    temperature: storedConfig.temperature ?? DEFAULT_AI_CONFIG.temperature,
    max_tokens: storedConfig.max_tokens ?? DEFAULT_AI_CONFIG.max_tokens,
    top_p: storedConfig.top_p ?? DEFAULT_AI_CONFIG.top_p,
    presence_penalty:
      storedConfig.presence_penalty ?? DEFAULT_AI_CONFIG.presence_penalty,
    frequency_penalty:
      storedConfig.frequency_penalty ?? DEFAULT_AI_CONFIG.frequency_penalty,
    stop: Array.isArray(storedConfig.stop)
      ? storedConfig.stop
      : DEFAULT_AI_CONFIG.stop,
    followUp: storedLocalConfig.followUp ?? DEFAULT_AI_CONFIG.followUp,
    context: storedConfig.context ?? DEFAULT_AI_CONFIG.context,
  };
}

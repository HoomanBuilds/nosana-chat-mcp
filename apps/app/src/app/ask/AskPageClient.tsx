/* eslint-disable react-hooks/exhaustive-deps */
"use client";
import {
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRightFromLine } from "lucide-react";
import { Footer } from "@/components/Footer";
import { useChatLogic } from "@/hooks/useChatLogic";
import { deployerQuestions, questions } from "@/lib/utils/questions";
import SideBar from "@/components/SideBar";
import { useSettingsStore } from "@/store/setting.store";
import { cn } from "@/lib/utils";
import { DEFAULT } from "@/lib/constants";
import { AskForm } from "@/components/ChatForm/AskForm";
import { useChatStore } from "@/store/chat.store";
import ChatNavBar from "@/components/Chatnavbar";
import { LoadingScreen } from "@/components/ui/LoadingScreen";

function AskPage() {
  const [input, setInput] = useState("");
  const { model, setModel, selectedModel, setSelectedModel, mcp } =
    useChatLogic();

  const tool = useChatStore((state) => state.tool);
  const setPendingQuery = useChatStore((state) => state.setPendingQuery);

  const [randomQuestions, setRandomQuestions] = useState<typeof questions>([]);
  const {
    localConfig: { appearance },
    toggleMobile,
  } = useSettingsStore();
  const textref = useRef<HTMLTextAreaElement>(
    null,
  ) as React.RefObject<HTMLTextAreaElement>;
  const router = useRouter();
  const searchParams = useSearchParams();
  const customServiceUrl =
    searchParams.get("custom-service_url") ||
    searchParams.get("custom_service_url") ||
    searchParams.get("service_url");
  const customServiceModel =
    searchParams.get("custom-model") ||
    searchParams.get("custom_model") ||
    searchParams.get("service_model");

  useEffect(() => {
    const modelFromUrl = customServiceModel || searchParams.get("model");
    const saved = localStorage.getItem("llmmodel");
    setModel(modelFromUrl || saved || DEFAULT.MODEL);
    setTimeout(() => textref.current?.focus(), 50);

    const picked = [...questions].sort(() => Math.random() - 0.5).slice(0, 3);
    setRandomQuestions(picked);
  }, [searchParams, customServiceModel, setModel]);

  const buildStartChatUrl = useCallback(
    (chatId: number, modelToSend: string) => {
      const params = new URLSearchParams();
      params.set("model", modelToSend);
      params.set("chatid", String(chatId));
      if (mcp) params.set("tool", "deployer");
      if (customServiceUrl) params.set("custom-service_url", customServiceUrl);
      if (customServiceModel) params.set("custom-model", customServiceModel);
      return `/ask/${chatId}?${params.toString()}`;
    },
    [mcp, customServiceUrl, customServiceModel],
  );

  const handleStartChat = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      if (!input.trim()) return;

      const chatId = Date.now();
      const modelToSend = model || DEFAULT.MODEL;

      setPendingQuery(input);

      router.push(buildStartChatUrl(chatId, modelToSend));
    },
    [input, model, setPendingQuery, router, buildStartChatUrl],
  );

  const handleTemplateSelect = useCallback(
    (jobDefinition: Record<string, any>) => {
      const jsonString = JSON.stringify(jobDefinition, null, 2);
      setInput(jsonString);

      // Auto-submit after setting the input
      setTimeout(() => {
        const chatId = Date.now();
        const modelToSend = model || DEFAULT.MODEL;

        setPendingQuery(jsonString);

        router.push(buildStartChatUrl(chatId, modelToSend));
      }, 100);
    },
    [model, setPendingQuery, router, buildStartChatUrl],
  );

  const formProps = useMemo(
    () => ({
      input,
      setInput,
      model,
      setModel,
      selectedModel: selectedModel || model,
      setSelectedModel,
      onSubmit: handleStartChat,
      textareaRef: textref,
      mcp,
    }),
    [input, model, selectedModel, mcp],
  );

  const displayedQuestions = mcp ? deployerQuestions : randomQuestions;

  return (
    <>
      <div className={appearance}>
        <SideBar onTemplateSelect={handleTemplateSelect} />
      </div>

      {!mcp && (
        <button
          onClick={() => toggleMobile()}
          type="button"
          className="fixed left-3 z-40 rounded-full border border-border/60 bg-background/90 p-2 shadow-md backdrop-blur lg:hidden"
          style={{ top: "max(0.75rem, env(safe-area-inset-top))" }}
        >
          <ArrowRightFromLine
            className={cn("cursor-pointer lg:hidden text-muted-foreground")}
          />
        </button>
      )}

      <div
        className={cn(
          "w-full flex-col flex min-h-screen transition-colors duration-500",
          appearance,
          "bg-background text-foreground",
        )}
      >
        {mcp && (
          <div className="sticky top-0 z-40 w-full">
            <ChatNavBar />
          </div>
        )}

        <div
          className={cn(
            "flex flex-1 flex-col items-center justify-center px-4 pb-32 pt-16 sm:px-6 md:pb-20",
            mcp ? "pt-0" : "",
          )}
        >
          <div className="flex w-full flex-col items-center md:-translate-y-6">
            <div
              className={cn(
                "text-center text-2xl sm:text-3xl font-sans mb-6 font-extralight",
                !mcp && "bg-gradient-to-r text-transparent bg-clip-text",
              )}
            >
              <div className="text-center text-2xl sm:text-3xl font-sans font-extralight">
                {mcp ? (
                  <div className="text-foreground gap-3 text-4xl">
                    <div className="flex gap-2 items-center">
                      <span className="font-bold text-green-500">NOSANA</span>,
                      <span className="font-bold text-muted-foreground">
                        Deployer
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-foreground">
                    <span className="font-bold">Hey</span>, How May I assist you
                    Today?
                  </div>
                )}
              </div>
            </div>

            <AskForm {...formProps} className="mt-8 hidden md:flex" />

            <div className="mt-5 grid w-full max-w-[800px] grid-cols-1 gap-4 sm:w-[80vw] sm:grid-cols-2 md:w-[70vw] lg:w-[60vw] lg:grid-cols-3 xl:w-[50vw]">
              {displayedQuestions.map((q, index) => (
                <div
                  key={q.id}
                  onClick={() => {
                    setInput(q.text);
                    textref.current?.focus();
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setInput(q.text);
                      textref.current?.focus();
                      e.preventDefault();
                    }
                  }}
                  className={cn(
                    "mb-2 flex h-auto min-h-24 select-none flex-row items-center gap-4 rounded-lg border border-transparent bg-muted/30 p-3 text-muted-foreground shadow-md transition-all duration-150 sm:h-full sm:flex-col sm:items-start sm:gap-0",
                    index >= 2 ? "sm:hover:scale-105" : "hover:scale-105",
                    "hover:bg-muted-foreground/10",
                    mcp && "border-2 rounded-none shadow-[4px_4px_0_#2f2e2a]",
                  )}
                >
                  <div className={cn("sm:mb-5 text-green-500")}>{q.Icon}</div>
                  <div className="w-full">
                    {q.topic}
                    <div
                      className={cn(
                        "text-xs mt-1 w-full text-muted-foreground/50",
                      )}
                    >
                      {q.text}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div
          className={cn(
            "fixed inset-x-0 bottom-0 z-30 border-t border-border/60 bg-background/85 px-2 pt-2 backdrop-blur-sm transition-colors duration-500 md:hidden",
          )}
          style={{ paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))" }}
        >
          <div className="flex justify-center">
            <AskForm {...formProps} />
          </div>
        </div>

        <Footer className="absolute bottom-0 self-center" />
      </div>
    </>
  );
}

export default function AskPageClient() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <AskPage />
    </Suspense>
  );
}

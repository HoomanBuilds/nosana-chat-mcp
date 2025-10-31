/* eslint-disable react-hooks/exhaustive-deps */
"use client";
import { Suspense, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightFromLine, LucideLoader2 } from "lucide-react";
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
    null
  ) as React.RefObject<HTMLTextAreaElement>;
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem("llmmodel");
    setModel(saved || DEFAULT.MODEL);
    setTimeout(() => textref.current?.focus(), 50);

    const picked = [...questions].sort(() => Math.random() - 0.5).slice(0, 3);
    setRandomQuestions(picked);
  }, []);

  const handleStartChat = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    const chatId = Date.now();
    const modelToSend = model || DEFAULT.MODEL;

    setPendingQuery(input);

    router.push(
      `/ask/${chatId}?model=${modelToSend}&chatid=${chatId}${mcp ? `&tool=deployer` : ""}`
    );
  }, [input, model, mcp, setPendingQuery, router]);

  const handleTemplateSelect = useCallback((jobDefinition: Record<string, any>) => {
    const jsonString = JSON.stringify(jobDefinition, null, 2);
    setInput(jsonString);
    
    // Auto-submit after setting the input
    setTimeout(() => {
      const chatId = Date.now();
      const modelToSend = model || DEFAULT.MODEL;

      setPendingQuery(jsonString);

      router.push(
        `/ask/${chatId}?model=${modelToSend}&chatid=${chatId}${mcp ? `&tool=deployer` : ""}`
      );
    }, 100);
  }, [model, mcp, setPendingQuery, router]);

  const formProps = useMemo(() => ({
    input,
    setInput,
    model,
    setModel,
    selectedModel: selectedModel || model,
    setSelectedModel,
    onSubmit: handleStartChat,
    textareaRef: textref,
    mcp,
  }), [input, model, selectedModel, mcp]);

  const displayedQuestions = useMemo(
    () => mcp ? deployerQuestions : randomQuestions,
    [mcp, randomQuestions]
  );

  return (
    <>
      <div className={appearance}>
        <SideBar onTemplateSelect={handleTemplateSelect} />
      </div>

      {!mcp && (
        <button onClick={() => toggleMobile()} className="fixed top-2 left-2 z-50">
          <ArrowRightFromLine
            className={cn("cursor-pointer lg:hidden text-muted-foreground")}
          />
        </button>
      )}

      <div
        className={cn(
          "w-full flex-col flex min-h-screen transition-colors duration-500",
          appearance,
          "bg-background text-foreground"
        )}
      >
        {mcp && (
          <div className="sticky top-0 z-40 w-full">
            <ChatNavBar />
          </div>
        )}

        <div className={cn(
          "flex-1 flex flex-col justify-center items-center px-6",
          mcp ? "pt-0" : ""
        )}>
          <div className="sm:translate-y-6 w-full -translate-y-12 flex flex-col items-center">
            <div
              className={cn(
                "text-center text-2xl sm:text-3xl font-sans mb-6 font-extralight bg-gradient-to-r text-transparent bg-clip-text"
              )}
            >
              <div className="text-center text-2xl sm:text-3xl font-sans font-extralight">
                {mcp ? (
                  <div className="text-muted gap-3 text-4xl">
                    <div className="flex gap-2 items-center">
                      <span className="font-bold text-green-500">NOSANA</span>,
                      Nosana {tool}
                    </div>
                  </div>
                ) : (
                  <div className="bg-gradient-to-r from-muted-foreground to-muted text-transparent bg-clip-text">
                    <span className="font-bold">Hey</span>, How May I assist you
                    Today?
                  </div>
                )}
              </div>
            </div>

            <AskForm
              {...formProps}
              className="mt-8 hidden md:block"
            />

            <div className="w-[90vw] sm:w-[80vw] md:w-[70vw] lg:w-[60vw] xl:w-[50vw] max-w-[800px] grid-cols-2 lg:grid-cols-3 gap-4 mt-5 sm:grid">
              {displayedQuestions.map((q, index) => (
                <div
                  key={q.id}
                  onClick={() => {
                    setInput(q.text);
                    textref.current?.focus();
                  }}
                  className={cn(
                    "p-3 h-24 items-center sm:items-start gap-4 sm:gap-0 shadow-md mb-2 flex flow-row sm:flex-col sm:h-full select-none border border-transparent rounded-lg cursor-pointer transition-all duration-150 bg-muted/30 text-muted-foreground ",
                    index >= 2 ? "sm:hover:scale-105" : "hover:scale-105",
                    "hover:bg-muted-foreground/10",
                    mcp && "border-2 rounded-none shadow-[4px_4px_0_#2f2e2a]"
                  )}
                >
                  <div className={cn("sm:mb-5 text-green-500")}>{q.Icon}</div>
                  <div className="w-full">
                    {q.topic}
                    <div
                      className={cn(
                        "text-xs mt-1 w-full text-muted-foreground/50"
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
            "md:hidden fixed bottom-0 left-0 right-0 backdrop-blur-sm border-border py-2 transition-colors duration-500"
          )}
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

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="bg-muted w-full h-full flex items-center justify-center">
          <LucideLoader2 className="animate-spin" />
        </div>
      }
    >
      <AskPage />
    </Suspense>
  );
}
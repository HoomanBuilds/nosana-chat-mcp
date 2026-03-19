"use client";
import React from "react";
import { SlGlobe } from "react-icons/sl";
import { cn } from "@/lib/utils";
import { Modes } from "@nosana-chat/ai";
import { ChatInput } from "./ChatInput";
import { ModelSelector } from "./Modelselector";
import { FeatureToggle } from "./FeatureToggle";
import { SubmitButton } from "./ui/submit-button";
import { Brain } from "lucide-react";
import { useChatStore } from "@/store/chat.store";
import PhantomConnect from "../PhantomConnect";
import { useShallow } from "zustand/shallow";

interface ChatFormProps {
  query: string;
  setQuery: (query: string) => void;
  model: string;
  setModel: (model: string) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;

  search: boolean;
  setSearch: (search: boolean) => void;
  thinking: boolean;
  setThinking: (thinking: boolean) => void;

  onSubmit: (e: React.FormEvent) => void;
  onAbort?: () => void;
  state: "idle" | "loading";

  formRef?: React.RefObject<HTMLFormElement>;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;

  className?: string;
}

export const ChatForm: React.FC<ChatFormProps> = ({
  query,
  setQuery,
  model,
  setModel,
  selectedModel,
  setSelectedModel,
  search,
  setSearch,
  thinking,
  setThinking,
  onSubmit,
  onAbort,
  state,
  formRef,
  textareaRef,
  className,
}) => {
  const currentConfig =
    Modes.ChatModeConfig[
      selectedModel?.split("/")[1] as keyof typeof Modes.ChatModeConfig
    ] || {};

  const { tool } = useChatStore(useShallow((state) => ({ tool: state.tool })));
  const isModelSelected = !!(model || selectedModel);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);

    if (e.key === "Enter" && !isMobile && !e.shiftKey) {
      e.preventDefault();
      if (query.trim() && isModelSelected) {
        onSubmit(e);
        setQuery("");
      }
    }
  };

  const handleModelChange = (val: string) => {
    setModel(val);
    localStorage.setItem("llmmodel", val);
    setSelectedModel(val);
  };

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className={cn(
        "fixed z-30 mb-0 flex w-[calc(100vw-1rem)] max-w-[800px] -translate-x-1/2 flex-col gap-1 overflow-hidden rounded-2xl border border-muted-foreground/10 bg-muted/95 shadow-xl backdrop-blur supports-[backdrop-filter]:bg-muted/85 sm:w-[80vw] md:w-[70vw] lg:w-[60vw] xl:w-[60vw]",
        className,
      )}
      style={{
        left: "calc(50% + (var(--sidebar-width, 0px) / 2))",
        bottom: "max(0.5rem, env(safe-area-inset-bottom))",
      }}
    >
      <ChatInput
        value={query}
        onChange={setQuery}
        onKeyDown={handleKeyDown}
        textareaRef={textareaRef}
        className="rounded-t-2xl"
      />

      <div className="flex items-center gap-2 px-2 pb-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden text-muted-foreground">
          <ModelSelector
            value={model || selectedModel}
            onValueChange={handleModelChange}
            className="min-w-0 flex-1 sm:min-w-[12rem] sm:flex-none"
          />

          {tool && <PhantomConnect compactMobile />}

          {currentConfig.search && !tool && (
            <FeatureToggle
              icon={<SlGlobe size={20} />}
              isActive={search}
              onClick={() => setSearch(!search)}
              activeColor="text-blue-500/50"
            />
          )}

          {currentConfig.thinking && !tool && (
            <FeatureToggle
              icon={<Brain size={20} />}
              isActive={thinking}
              onClick={() => setThinking(!thinking)}
              activeColor="text-yellow-500"
            />
          )}
        </div>

        <SubmitButton
          isLoading={state === "loading"}
          isDisabled={!query.trim() || !isModelSelected}
          onAbort={onAbort}
          onSubmit={() => {
            if (query.trim() && isModelSelected) {
              onSubmit(new Event("submit") as any);
              setQuery("");
            }
          }}
          className="size-8 shrink-0 rounded-full p-0 sm:h-8 sm:w-auto sm:rounded-md sm:px-3"
        />
      </div>
    </form>
  );
};

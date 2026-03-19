"use client";
import { cn } from "@/lib/utils";
import { ChatInput } from "./ChatInput";
import { ModelSelector } from "./Modelselector";
import { SubmitButton } from "./ui/submit-button";
import PhantomConnect from "../PhantomConnect";

interface AskFormProps {
  input: string;
  setInput: (input: string) => void;
  model: string;
  setModel: (model: string) => void;
  selectedModel: string;
  setSelectedModel: (model: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
  className?: string;
  placeholder?: string;
  mcp?: boolean;
}

export const AskForm: React.FC<AskFormProps> = ({
  input,
  setInput,
  model,
  setModel,
  selectedModel,
  setSelectedModel,
  onSubmit,
  textareaRef,
  className,
  placeholder = "Type your message to start chat...",
  mcp = false,
}) => {
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isMobile = /Mobi|Android/i.test(navigator.userAgent);

    if (e.key === "Enter" && !isMobile && !e.shiftKey) {
      e.preventDefault();
      if (input.trim()) {
        onSubmit(e);
        setInput("");
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
      onSubmit={onSubmit}
      className={cn(
        "flex w-[calc(100vw-1rem)] max-w-[800px] flex-col gap-1 overflow-hidden rounded-2xl border border-muted-foreground/10 bg-muted/80 shadow-md sm:w-[80vw] md:w-[70vw] lg:w-[60vw] xl:w-[50vw]",
        className,
        mcp && "rounded-none shadow-[4px_4px_0_#2f2e2a]",
      )}
    >
      <ChatInput
        value={input}
        onChange={setInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        textareaRef={textareaRef}
        className={cn("rounded-t-lg py-3")}
        mcp={mcp}
      />

      <div className="flex items-center gap-2 px-2 pb-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          <ModelSelector
            value={model || selectedModel}
            onValueChange={handleModelChange}
            className="min-w-0 flex-1 border-muted-foreground/10 bg-muted/5 sm:min-w-[12rem] sm:flex-none"
            mcp={mcp}
          />

          {mcp && (
            <PhantomConnect
              compactMobile
              className="h-8 shrink-0 rounded-xl border border-purple-400/40 bg-purple-600 px-3 text-sm text-white hover:bg-purple-500 sm:h-8 sm:w-auto sm:rounded-none"
            />
          )}
        </div>

        <SubmitButton
          isLoading={false}
          isDisabled={!input.trim()}
          onSubmit={() => {
            if (input.trim()) {
              onSubmit(new Event("submit") as any);
              setInput("");
            }
          }}
          mcp={mcp}
          className="size-8 shrink-0 border border-muted-foreground/10 p-0 sm:h-8 sm:w-auto sm:px-3"
        />
      </div>
    </form>
  );
};

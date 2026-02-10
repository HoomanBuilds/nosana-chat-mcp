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
  mcp = false
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
        "border-muted-foreground/5  overflow-hidden border-2 bg-muted/60 w-[95vw] sm:w-[80vw] md:w-[70vw] lg:w-[60vw] xl:w-[50vw] max-w-[800px] rounded-2xl shadow-md flex flex-col gap-2",
        className,
        mcp && "rounded-none shadow-[4px_4px_0_#2f2e2a]"
      )}
    >
      <ChatInput
        value={input}
        onChange={setInput}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        textareaRef={textareaRef}
        className={cn("py-4 rounded-t-lg")}
        mcp={mcp}
      />

      <div className="flex justify-between items-center pb-2 px-2">
        <div className="flex items-center gap-2">
          <ModelSelector
            value={model || selectedModel}
            onValueChange={handleModelChange}
            className="border-muted-foreground/10 bg-muted/5"
            mcp={mcp}
          />

          {mcp && (
            <PhantomConnect className="bg-purple-600 px-4 py-2 h-8 text-white rounded-none border cursor-pointer hover:bg-purple-500" />
          )}
        </div>


        <div className="flex  items-center gap-2">
          <SubmitButton
            isLoading={false}
            isDisabled={!input.trim()}
            onSubmit={() => {
              if (input.trim()) {
                onSubmit(new Event('submit') as any);
                setInput("");
              }
            }}
            mcp={mcp}
            className="border-muted-foreground/10 border"
          />
        </div>

      </div>
    </form>
  );
};

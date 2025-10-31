"use client";
import React, { useRef, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onFocus?: () => void;
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  className?: string;
  textareaRef?: React.RefObject<HTMLTextAreaElement>;
  mcp?: boolean
}

export const ChatInput: React.FC<ChatInputProps> = ({
  value,
  onChange,
  onFocus,
  onKeyDown,
  placeholder = "Type your message...",
  className,
  textareaRef,
  mcp=false
}) => {
  const internalTextareaRef = useRef<HTMLTextAreaElement>(null);
  const actualRef = textareaRef || internalTextareaRef;

  useEffect(() => {
    const resizeTextarea = () => {
      if (actualRef.current) {
        actualRef.current.style.height = "auto";
        actualRef.current.style.height = Math.min(actualRef.current.scrollHeight, 256) + "px";
      }
    };

    resizeTextarea();
  }, [value, actualRef]);

  const handleFocus = () => {
    onFocus?.();
  };

  return (
    <textarea
      ref={actualRef}
      placeholder={placeholder}
      rows={1}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={handleFocus}
      onKeyDown={onKeyDown}
      className={cn(
        "w-full min-h-16 resize-none bg-muted-foreground/10 text-muted-foreground p-2 rounded-t-lg focus:outline-none focus:ring-black/10",
        className,
        mcp && "rounded-none"
      )}
    />
  );
};
"use client";
import React from "react";
import { Square, Send } from "lucide-react";
import { cn } from "@/lib/utils";

interface SubmitButtonProps {
  isLoading: boolean;
  isDisabled: boolean;
  onAbort?: () => void;
  onSubmit?: () => void;
  className?: string;
  mcp?: boolean
}

export const SubmitButton: React.FC<SubmitButtonProps> = ({
  isLoading,
  isDisabled,
  onAbort,
  onSubmit,
  className,
  mcp
}) => {
  const handleClick = (e: React.MouseEvent) => {
    if (isLoading && onAbort) {
      e.preventDefault();
      onAbort();
    } else if (!isLoading && onSubmit && !isDisabled) {
      e.preventDefault();
      onSubmit();
    }
  };

  return (
    <button
      type={isLoading ? "button" : "submit"}
      onClick={handleClick}
      disabled={!isLoading && isDisabled}
      className={cn(
        "bg-muted-foreground/10 cursor-pointer p-1 flex items-center justify-center rounded text-muted-foreground/80 transition",
        !isDisabled && !isLoading ? "opacity-100 hover:bg-muted-foreground/20" : "opacity-50",
        className,
        mcp && "rounded-none bg-green-600 hover:bg-green-500"
      )}
    >
      {isLoading ? (
        <Square className="text-red-500/80" />
      ) : (
        <Send className="cursor-pointer" />
      )}
    </button>
  );
};
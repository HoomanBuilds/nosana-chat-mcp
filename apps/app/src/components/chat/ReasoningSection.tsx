"use client";

import React, { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { Sparkles, ChevronRight, Loader2, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import { m, AnimatePresence } from "motion/react";

interface ReasoningSectionProps {
  reasoning: string;
  isStreaming?: boolean;
}

export function ReasoningSection({ reasoning, isStreaming = false }: ReasoningSectionProps) {
  const [isOpen, setIsOpen] = useState(isStreaming);
  const contentRef = useRef<HTMLDivElement>(null);

  // Auto-scroll logic if it's streaming and open
  useEffect(() => {
    if (isStreaming && isOpen && contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [reasoning, isStreaming, isOpen]);

  // If it starts streaming, ensure it's open
  useEffect(() => {
    if (isStreaming) {
      setIsOpen(true);
    }
  }, [isStreaming]);

  if (!reasoning && !isStreaming) return null;

  return (
    <div className="mb-4 group/reasoning px-0.5">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center gap-3">
          <CollapsibleTrigger asChild>
            <button
              className={cn(
                "flex items-center gap-2.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all duration-300 ease-out",
                "bg-secondary/30 hover:bg-secondary/50 text-muted-foreground/70 hover:text-foreground border border-transparent hover:border-border/30 shadow-sm",
                isOpen && "bg-transparent text-primary/80 border-transparent shadow-none"
              )}
            >
              <div className="relative flex items-center justify-center">
                {isStreaming && !isOpen ? (
                  <Loader2 size={14} className="animate-spin text-primary/70" />
                ) : (
                  isOpen ? (
                    <Brain size={14} className="text-primary animate-in zoom-in-50 duration-500" />
                  ) : (
                    <Sparkles
                      size={14}
                      className={cn(
                        "transition-all duration-500 ease-in-out opacity-60",
                        isStreaming && "animate-pulse text-primary"
                      )}
                    />
                  )
                )}
                {isOpen && (
                  <m.div
                    className="absolute inset-0 bg-primary/15 blur-[10px] rounded-full -z-10"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1.5 }}
                  />
                )}
              </div>
              <span className="tracking-tight uppercase font-bold text-[10px] select-none">
                {isOpen ? "Thought process" : (isStreaming ? "Thinking..." : "Show thought process")}
              </span>
              <ChevronRight
                size={12}
                className={cn(
                  "transition-all duration-300 ease-in-out ml-0.5 opacity-40",
                  isOpen ? "rotate-90 text-primary opacity-100" : "rotate-0"
                )}
              />
            </button>
          </CollapsibleTrigger>

          {isStreaming && isOpen && (
            <m.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-1.5"
            >
              <div className="h-1 w-1 bg-primary/40 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary/40 animate-pulse">Thinking</span>
            </m.div>
          )}
        </div>

        <CollapsibleContent forceMount asChild>
          <m.div
            initial={false}
            animate={{
              height: isOpen ? "auto" : 0,
              opacity: isOpen ? 1 : 0
            }}
            transition={{ duration: 0.3, ease: [0.23, 1, 0.32, 1] }}
            className="overflow-hidden"
          >
            <div
              ref={contentRef}
              className={cn(
                "relative mt-1 ml-4 pl-5 border-l-2 border-primary/20 bg-primary/[0.02] rounded-r-2xl py-4 pr-5 transition-colors duration-500",
                isStreaming ? "max-h-80 overflow-y-auto" : ""
              )}
            >
              {/* Subtle Gradient Accent */}
              <div className="absolute -left-[2.5px] top-0 bottom-0 w-[3px] bg-gradient-to-b from-primary/50 via-primary/20 to-transparent rounded-full" />

              <div className="prose prose-sm dark:prose-invert max-w-none 
                text-[13.5px] leading-relaxed text-muted-foreground/85 
                selection:bg-primary/20 selection:text-primary
                [&>p]:mb-3 [&>p:last-child]:mb-0
                [&>ul]:list-disc [&>ul]:ml-4 [&>ol]:list-decimal [&>ol]:ml-4
                [&>code]:text-primary/90 [&>code]:bg-primary/10 [&>code]:px-1.5 [&>code]:py-0.5 [&>code]:rounded-md [&>code]:font-mono [&>code]:text-[12px]
                [&>pre]:bg-muted/40 [&>pre]:p-3 [&>pre]:rounded-xl [&>pre]:border [&>pre]:border-border/50
                [&>strong]:text-foreground/90 [&>strong]:font-semibold italic"
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {reasoning || "_Thinking..._"}
                </ReactMarkdown>
                {isStreaming && (
                  <m.span
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ repeat: Infinity, duration: 1 }}
                    className="inline-block w-1 h-3 ml-1 bg-primary/50 align-middle"
                  />
                )}
              </div>
            </div>
          </m.div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}

"use client";

import React, { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeHighlight from "rehype-highlight";
import { cn } from "@/lib/utils";
import { TraceEvent } from "@/store/chat.store";
import "../../styles/markdown.css";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  Wrench,
  Clock,
} from "lucide-react";

interface StreamItem {
  id: string;
  type: "text" | "trace";
  data: string | TraceEvent;
  timestamp: number;
}

interface StreamContentProps {
  items: StreamItem[];
  markdownComponents?: any;
  isStreaming?: boolean;
}

export const StreamContent = memo(function StreamContent({
  items,
  markdownComponents,
  isStreaming = false,
}: StreamContentProps) {
  if (items.length === 0) return null;

  // Build segments: interleave text chunks with trace items
  const segments: { type: "text" | "trace"; content: any }[] = [];
  let currentText = "";
  const completedTools = new Set<string>();

  for (const item of items) {
    if (item.type === "text") {
      currentText += item.data as string;
    } else {
      // Flush any pending text
      if (currentText) {
        segments.push({ type: "text", content: currentText });
        currentText = "";
      }
      // Track completed tools
      const traceData = item.data as TraceEvent;
      if (traceData.type === "tool_result" && traceData.toolName) {
        completedTools.add(traceData.toolName);
      }
      // Add the trace
      segments.push({ type: "trace", content: item.data });
    }
  }

  // Flush remaining text
  if (currentText) {
    segments.push({ type: "text", content: currentText });
  }

  return (
    <>
      {segments.map((segment, idx) => {
        if (segment.type === "text") {
          if (isStreaming) {
            // Split into completed lines (stable markdown) + last incomplete line (raw)
            const lastNewline = segment.content.lastIndexOf("\n");
            const stable = lastNewline >= 0 ? segment.content.slice(0, lastNewline + 1) : "";
            const tail = lastNewline >= 0 ? segment.content.slice(lastNewline + 1) : segment.content;
            return (
              <React.Fragment key={idx}>
                {stable && (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }]]}
                    components={markdownComponents}
                  >
                    {stable}
                  </ReactMarkdown>
                )}
                {tail && <span className="whitespace-pre-wrap">{tail}</span>}
              </React.Fragment>
            );
          }
          return (
            <ReactMarkdown
              key={idx}
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }]]}
              components={markdownComponents}
            >
              {segment.content}
            </ReactMarkdown>
          );
        }
        const traceData = segment.content as TraceEvent;
        // Only tool_start should show loading if tool hasn't completed yet
        const showLoading =
          isStreaming &&
          traceData.type === "tool_start" &&
          !completedTools.has(traceData.toolName || "");

        return (
          <TraceItem key={idx} trace={traceData} isStreaming={showLoading} />
        );
      })}
      {isStreaming && (
        <span className="inline-block w-1 h-4 bg-primary/50 animate-pulse ml-1 align-middle" />
      )}
    </>
  );
});

interface TraceItemProps {
  trace: TraceEvent;
  isStreaming?: boolean;
}

const TraceItem = memo(function TraceItem({
  trace,
  isStreaming = false,
}: TraceItemProps) {
  const [expanded, setExpanded] = React.useState(false);

  if (trace.type === "tool_start") {
    return (
      <div className="flex items-center gap-3 py-2 px-3 my-2 rounded-lg bg-amber-500/5 border border-amber-500/20">
        <Circle
          size={14}
          className={cn(
            "shrink-0",
            isStreaming && "animate-pulse",
            "text-amber-500 fill-amber-500/20",
          )}
        />
        <div className="flex items-center gap-2 flex-1">
          <Wrench size={12} className="text-muted-foreground/50" />
          <span className="text-sm font-medium">Calling {trace.toolName}</span>
          {trace.toolArgs && Object.keys(trace.toolArgs).length > 0 && (
            <span className="text-xs text-muted-foreground/50">
              ({Object.keys(trace.toolArgs).slice(0, 2).join(", ")}
              {Object.keys(trace.toolArgs).length > 2 && "..."})
            </span>
          )}
        </div>
        {isStreaming && (
          <Loader2 size={12} className="animate-spin text-amber-500" />
        )}
      </div>
    );
  }

  if (trace.type === "tool_result") {
    return (
      <div className="flex flex-col my-2">
        <div
          className="flex items-center gap-3 py-2 px-3 rounded-lg bg-green-500/5 border border-green-500/20 cursor-pointer hover:bg-green-500/10 transition-colors"
          onClick={() => setExpanded(!expanded)}
        >
          <CheckCircle2
            size={14}
            className="shrink-0 text-green-500 fill-green-500/20"
          />
          <div className="flex items-center gap-2 flex-1">
            <Wrench size={12} className="text-muted-foreground/50" />
            <span className="text-sm font-medium">
              {trace.toolName} completed
            </span>
            {trace.duration && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground/50">
                <Clock size={10} />
                {trace.duration < 1000
                  ? `${trace.duration}ms`
                  : `${(trace.duration / 1000).toFixed(2)}s`}
              </span>
            )}
          </div>
          <button className="p-1 hover:bg-muted rounded">
            {expanded ? (
              <ChevronDown size={14} className="text-muted-foreground/50" />
            ) : (
              <ChevronRight size={14} className="text-muted-foreground/50" />
            )}
          </button>
        </div>

        {expanded && trace.toolResult ? (
          <div className="mt-1 ml-6 p-3 rounded-lg bg-muted/50 border border-border/50">
            <div className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide mb-2">
              Result
            </div>
            <pre className="text-xs font-mono bg-background/50 p-2 rounded border overflow-x-auto max-h-48 overflow-y-auto">
              {String(JSON.stringify(trace.toolResult, null, 2))}
            </pre>
          </div>
        ) : null}
      </div>
    );
  }

  if (trace.type === "tool_error") {
    return (
      <div className="flex items-center gap-3 py-2 px-3 my-2 rounded-lg bg-red-500/5 border border-red-500/20">
        <AlertCircle
          size={14}
          className="shrink-0 text-red-500 fill-red-500/20"
        />
        <div className="flex items-center gap-2 flex-1">
          <Wrench size={12} className="text-muted-foreground/50" />
          <span className="text-sm font-medium text-red-500">
            {trace.toolName} failed
          </span>
        </div>
        {trace.error && (
          <span className="text-xs text-red-500/70">{trace.error}</span>
        )}
      </div>
    );
  }

  return null;
});

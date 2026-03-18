"use client";

import React, { useState } from "react";
import { cn } from "@/lib/utils";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Circle,
  Loader2,
  AlertCircle,
  Wrench,
  Clock,
  Sparkles,
} from "lucide-react";
import { TraceEvent } from "@/store/chat.store";

interface AgentTraceProps {
  trace: TraceEvent[];
  isStreaming?: boolean;
}

export function AgentTrace({ trace, isStreaming = false }: AgentTraceProps) {
  const [expandedTools, setExpandedTools] = useState<Set<string>>(new Set());
  const [showTrace, setShowTrace] = useState(true);

  const toggleTool = (toolId: string) => {
    setExpandedTools((prev) => {
      const next = new Set(prev);
      if (next.has(toolId)) {
        next.delete(toolId);
      } else {
        next.add(toolId);
      }
      return next;
    });
  };

  if (!trace || trace.length === 0) return null;

  const toolEvents = trace.filter(
    (e) =>
      e.type === "tool_start" ||
      e.type === "tool_result" ||
      e.type === "tool_error",
  );
  const thinkingEvents = trace.filter((e) => e.type === "thinking");

  const formatDuration = (ms?: number) => {
    if (!ms) return "";
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatTimestamp = (ts: number) => {
    return new Date(ts).toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const truncateJson = (obj: unknown, maxLength = 200): string => {
    const str = JSON.stringify(obj, null, 2);
    if (str.length <= maxLength) return str;
    return str.substring(0, maxLength) + "...";
  };

  if (toolEvents.length === 0 && thinkingEvents.length === 0) return null;

  return (
    <div className="my-4 group/trace">
      <button
        onClick={() => setShowTrace(!showTrace)}
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all",
          "bg-secondary/50 hover:bg-secondary/70 text-muted-foreground",
          "border border-transparent hover:border-border/50",
        )}
      >
        <Sparkles size={14} className="text-primary" />
        <span className="uppercase tracking-wide">
          {showTrace ? "Hide" : "Show"} Agent Trace
        </span>
        <span className="text-muted-foreground/50">
          ({toolEvents.filter((e) => e.type === "tool_result").length} tools
          called)
        </span>
        {isStreaming && (
          <Loader2 size={12} className="animate-spin text-primary" />
        )}
        {showTrace ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
      </button>

      {showTrace && (
        <div className="mt-3 space-y-2">
          {/* Thinking/Reasoning events */}
          {thinkingEvents.length > 0 && (
            <div className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10">
              <BrainThinking
                size={14}
                className="mt-1 text-primary/70 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-primary/70 mb-1 uppercase tracking-wide">
                  Thinking
                </div>
                <div className="text-sm text-muted-foreground/80 font-mono">
                  {thinkingEvents.map((e, i) => (
                    <span key={i}>{e.content}</span>
                  ))}
                  {isStreaming && (
                    <span className="inline-block w-1.5 h-3 ml-0.5 bg-primary/50 animate-pulse" />
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tool call chain */}
          <div className="space-y-1">
            {toolEvents.map((event, index) => {
              const toolId = `${event.toolName}-${index}`;
              const isExpanded = expandedTools.has(toolId);
              const isStart = event.type === "tool_start";
              const isResult = event.type === "tool_result";
              const isError = event.type === "tool_error";

              // Find corresponding result for this tool
              const correspondingResult = trace.find(
                (e) =>
                  e.type === "tool_result" &&
                  e.toolName === event.toolName &&
                  e.timestamp > event.timestamp,
              );
              const duration = correspondingResult?.duration;

              return (
                <div key={toolId} className="relative">
                  {/* Timeline connector */}
                  {index > 0 && (
                    <div className="absolute left-[15px] -top-1 w-px h-3 bg-border" />
                  )}

                  <div
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer",
                      isStart &&
                        "bg-amber-500/5 border-amber-500/20 hover:bg-amber-500/10",
                      isResult &&
                        "bg-green-500/5 border-green-500/20 hover:bg-green-500/10",
                      isError &&
                        "bg-red-500/5 border-red-500/20 hover:bg-red-500/10",
                    )}
                    onClick={() => toggleTool(toolId)}
                  >
                    {/* Status icon */}
                    <div className="shrink-0">
                      {isStart && (
                        <Circle
                          size={14}
                          className="text-amber-500 fill-amber-500/20"
                        />
                      )}
                      {isResult && (
                        <CheckCircle2
                          size={14}
                          className="text-green-500 fill-green-500/20"
                        />
                      )}
                      {isError && (
                        <AlertCircle
                          size={14}
                          className="text-red-500 fill-red-500/20"
                        />
                      )}
                    </div>

                    {/* Tool info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Wrench
                          size={12}
                          className="text-muted-foreground/50"
                        />
                        <span className="text-sm font-medium text-foreground">
                          {event.toolName}
                        </span>
                        {duration && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground/50">
                            <Clock size={10} />
                            {formatDuration(duration)}
                          </span>
                        )}
                      </div>

                      {isStart && event.toolArgs && (
                        <div className="mt-1 text-xs text-muted-foreground/70">
                          {Object.keys(event.toolArgs).length > 0 ? (
                            <span>
                              {Object.keys(event.toolArgs)
                                .slice(0, 3)
                                .join(", ")}
                              {Object.keys(event.toolArgs).length > 3 && "..."}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </div>

                    {/* Expand indicator */}
                    <div className="shrink-0">
                      {isExpanded ? (
                        <ChevronDown
                          size={14}
                          className="text-muted-foreground/50"
                        />
                      ) : (
                        <ChevronRight
                          size={14}
                          className="text-muted-foreground/50"
                        />
                      )}
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && (
                    <div className="mt-1 ml-8 p-3 rounded-lg bg-muted/50 border border-border/50">
                      {event.toolArgs &&
                        Object.keys(event.toolArgs).length > 0 && (
                          <div className="mb-3">
                            <div className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide mb-1">
                              Arguments
                            </div>
                            <pre className="text-xs font-mono bg-background/50 p-2 rounded border overflow-x-auto">
                              {
                                JSON.stringify(
                                  event.toolArgs,
                                  null,
                                  2,
                                ) as string
                              }
                            </pre>
                          </div>
                        )}

                      {event.toolResult ? (
                        <div>
                          <div className="text-xs font-semibold text-muted-foreground/70 uppercase tracking-wide mb-1">
                            Result
                          </div>
                          <pre className="text-xs font-mono bg-background/50 p-2 rounded border overflow-x-auto max-h-60 overflow-y-auto">
                            {String(truncateJson(event.toolResult))}
                          </pre>
                        </div>
                      ) : null}

                      {event.error && (
                        <div className="text-xs text-red-500 font-mono">
                          Error: {event.error}
                        </div>
                      )}

                      <div className="mt-2 text-xs text-muted-foreground/40">
                        {formatTimestamp(event.timestamp)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function BrainThinking({
  size = 16,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
      <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
      <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
      <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
      <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
      <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
      <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
      <path d="M6 18a4 4 0 0 1-1.967-.516" />
      <path d="M19.967 17.484A4 4 0 0 1 18 18" />
    </svg>
  );
}

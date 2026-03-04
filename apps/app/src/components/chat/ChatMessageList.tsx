/* eslint-disable */

import React, { memo, useEffect, useMemo, useRef } from "react";
import ChatMessage from "./ChatMessage";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@radix-ui/react-collapsible";
import { ChevronDown, Sparkles } from "lucide-react";
import { Card, CardContent } from "../ui/card";
import rehypeHighlight from "rehype-highlight";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { Conversation, useChatStore } from "@/store/chat.store";
import { useShallow } from "zustand/shallow";
import PermissionRequest from "../UserPermission";

interface ChatMessageListProps {
  conversations: Conversation[];
  state: "idle" | "loading" | null;
  reasoningChunks: string;
  llmChunks: string;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  event: string;
  setQuery: (q: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  onSubmit?: (question: string) => void;
}

const ChatMessageList = memo(
  ({
    conversations,
    state,
    reasoningChunks,
    llmChunks,
    scrollRef,
    event,
    setQuery,
    textareaRef,
    onSubmit,
  }: ChatMessageListProps) => {
    const autoScroll = useRef(true);

    const { pendingPermission } = useChatStore(
      useShallow((state) => ({ pendingPermission: state.pendingPermission })),
    );

    const reasoningRef = useRef<HTMLDivElement>(null);
    const virtuosoRef = useRef<VirtuosoHandle>(null);

    // Memoize markdown components to prevent recreation on every render
    const markdownComponents = useMemo(
      () => ({
        table({ node, ...props }: any) {
          return (
            <div style={{ overflowX: "auto", maxWidth: "100%" }}>
              <table {...props} className="markdown-table" />
            </div>
          );
        },
      }),
      [],
    );

    const reasoningContent = reasoningChunks;
    const llmContent = llmChunks;



    useEffect(() => {
      if (reasoningRef.current) {
        reasoningRef.current.scrollTop = reasoningRef.current.scrollHeight;
      }
    }, [reasoningChunks]);

    // Auto-scroll the main list when new chunks arrive
    useEffect(() => {
      if (state === "loading" && virtuosoRef.current) {
        virtuosoRef.current.scrollToIndex({
          index: conversations.length,
          align: "end",
          behavior: "auto"
        });
      }
    }, [llmChunks, reasoningChunks, state, conversations.length]);

    return (
      <div className="flex-1 w-[95vw] pb-4 sm:w-[80vw] md:w-[70vw] lg:w-[60vw] xl:w-[60vw] max-w-[800px] h-full relative">
        <Virtuoso
          ref={virtuosoRef}
          style={{ height: "100%", width: "100%" }}
          data={conversations}
          followOutput="smooth"
          initialTopMostItemIndex={conversations.length > 0 ? conversations.length - 1 : 0}
          components={{
            Footer: () => (
              <>
                {(state === "loading") && (
                  <div className="flex relative justify-start mt-1 items-start gap-4 w-full mb-5 self-start">
                    <div className="min-w-[95%] w-[100%] flex flex-col gap-2">
                      {(reasoningChunks?.length > 0) && (
                        <Collapsible open={true} className="w-full mb-3 px-[5px]">
                          <CollapsibleTrigger className="flex bg-muted-foreground/5 w-fit items-center justify-between px-3 py-2 text-xs font-medium text-gray-600 rounded-md border-muted-foreground/5 border gap-2 hover:bg-muted/70 transition">
                            <span className="flex items-center gap-2 text-muted-foreground/50 ">
                              <Sparkles size={15} /> Reasoning
                            </span>
                            <ChevronDown className="h-3 w-3 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                          </CollapsibleTrigger>

                          <CollapsibleContent
                            className="overflow-y-auto max-h-52 border rounded-md mt-1 overflow-hidden"
                            ref={reasoningRef}
                          >
                            <Card className="border-0 shadow-none text-sm bg-muted/60 rounded-none">
                              <CardContent
                                style={{
                                  padding: "0px",
                                  paddingRight: "10px",
                                  paddingLeft: "10px",
                                }}
                                className="text-muted-foreground/80 leading-6 prose prose-sm max-w-none"
                              >
                                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                  {reasoningContent}
                                </ReactMarkdown>
                              </CardContent>
                            </Card>
                          </CollapsibleContent>
                        </Collapsible>
                      )}

                      <div
                        style={{
                          paddingLeft: "10px",
                          paddingRight: "5px",
                          paddingTop: "0px",
                          paddingBlock: "0px",
                          margin: "0px",
                          backgroundColor: "transparent",
                        }}
                        className="markdown-container rounded-lg mt-3 w-full text-black/60 text-sm prose prose-sm max-w-none"
                      >
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }]]}
                          components={markdownComponents}
                        >
                          {llmContent}
                        </ReactMarkdown>

                        {pendingPermission && (
                          <PermissionRequest
                            toolName={pendingPermission.toolName}
                            args={pendingPermission.args}
                            onAllow={pendingPermission.onAllow}
                            onDeny={pendingPermission.onDeny}
                          />
                        )}

                        <div className="flex items-center gap-4 text-muted-foreground/50 mt-2 mb-4">
                          <PulseCircle size={0.8} colorClass="bg-muted-foreground/50" />
                          <span className="flex-1 flex items-center">{event}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                <div className="h-4" />
              </>
            ),
          }}
          itemContent={(index, msg) => (
            <ChatMessage
              key={msg.id || index}
              msg={msg}
              index={index}
              conversations={conversations}
              setQuery={setQuery}
              textareaRef={textareaRef}
              onSubmit={onSubmit}
            />
          )}
        />
      </div>
    );
  },
);

export default ChatMessageList;

const PulseCircle: React.FC<{ size?: number; colorClass?: string }> = ({
  size = 4,
  colorClass = "bg-muted-foreground/20",
}) => {
  return (
    <div
      className={`rounded-full ${colorClass}`}
      style={{
        width: `${size}rem`,
        height: `${size}rem`,
        display: "inline-block",
        animation: "pulseScale 1s ease-in-out infinite",
      }}
    >
      <style>
        {`
          @keyframes pulseScale {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.5); }
          }
        `}
      </style>
    </div>
  );
};

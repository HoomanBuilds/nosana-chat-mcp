/* eslint-disable */

import React, { memo, useEffect, useMemo, useRef } from "react";
import ChatMessage from "./ChatMessage";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ReasoningSection } from "./ReasoningSection";
import { AgentTrace } from "./AgentTrace";
import { StreamContent } from "./StreamContent";
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
  streamItems?: any[];
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
    streamItems = [],
  }: ChatMessageListProps) => {
    const autoScroll = useRef(true);
    const virtuosoRef = useRef<VirtuosoHandle>(null);
    const prevLen = useRef(conversations.length);

    useEffect(() => {
      // If we just added a message and are now loading, force the latest prompt to the TOP
      if (conversations.length > prevLen.current && state === "loading") {
        const targetIndex = conversations.length - 1;

        // Multiple attempts to ensure the scroll hits after dynamic layout shifts
        const scroll = () => {
          virtuosoRef.current?.scrollToIndex({
            index: targetIndex,
            align: "start",
            behavior: "smooth",
          });
        };

        // Try immediately and again after a short delay for Markdown/Images to settle
        scroll();
        setTimeout(scroll, 100);
        setTimeout(scroll, 300);
      }
      prevLen.current = conversations.length;
    }, [conversations.length, state]);

    const { pendingPermission } = useChatStore(
      useShallow((state) => ({ pendingPermission: state.pendingPermission })),
    );

    const reasoningRef = useRef<HTMLDivElement>(null);

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

    return (
      <div className="flex-1 w-[95vw] pb-4 sm:w-[80vw] md:w-[70vw] lg:w-[60vw] xl:w-[60vw] max-w-[800px] h-full">
        <Virtuoso
          ref={virtuosoRef}
          style={{ height: "100%", width: "100%" }}
          data={conversations}
          initialTopMostItemIndex={conversations.length - 1}
          context={{
            state,
            reasoningChunks,
            llmChunks,
            event,
            markdownComponents,
            pendingPermission,
            streamItems,
          }}
          components={{
            Footer: ChatFooter,
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

const ChatFooter = memo(({ context }: { context: any }) => {
  const {
    state,
    reasoningChunks,
    llmChunks,
    event,
    markdownComponents,
    pendingPermission,
    streamItems = [],
  } = context;

  if (
    state !== "loading" &&
    !reasoningChunks &&
    !llmChunks &&
    streamItems.length === 0
  ) {
    return <div className="h-4" />;
  }

  return (
    <>
      {state === "loading" && (
        <div className="flex relative justify-start mt-1 items-start gap-4 w-full mb-5 self-start">
          <div className="min-w-[95%] w-[100%] flex flex-col gap-2">
            {reasoningChunks?.length > 0 && (
              <ReasoningSection
                reasoning={reasoningChunks}
                isStreaming={true}
                hasNormalResponseStarted={
                  llmChunks.length > 0 || streamItems.length > 0
                }
              />
            )}

            {streamItems.length > 0 ? (
              <>
                <div className="flex items-center gap-4 text-muted-foreground/50 mb-2">
                  <PulseCircle size={0.8} colorClass="bg-muted-foreground/50" />
                  <span className="flex-1 flex items-center">{event || "streaming..."}</span>
                </div>
                <div style={{ paddingLeft: "5px", paddingRight: "5px", paddingTop: "0px", paddingBlock: "0px", margin: "0px", backgroundColor: "transparent" }} className="rounded-lg mt-3 markdown-container markdown-body text-sm max-w-none">
                  <StreamContent
                    items={streamItems}
                    markdownComponents={markdownComponents}
                    isStreaming={state === "loading"}
                  />
                </div>
              </>
            ) : (
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
                <div className="flex items-center gap-4 text-muted-foreground/50 mb-2">
                  <PulseCircle size={0.8} colorClass="bg-muted-foreground/50" />
                  <span className="flex-1 flex items-center">{event || "streaming..."}</span>
                </div>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }]]}
                  components={markdownComponents}
                >
                  {llmChunks}
                </ReactMarkdown>

                {pendingPermission && (
                  <PermissionRequest
                    toolName={pendingPermission.toolName}
                    args={pendingPermission.args}
                    onAllow={pendingPermission.onAllow}
                    onDeny={pendingPermission.onDeny}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      )}
      <div className="h-4" />
      {state === "loading" && <div className="h-[80vh]" />}
    </>
  );
});

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

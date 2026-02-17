"use client";
import React, { JSX, Suspense, useRef, useCallback } from "react";
import { cn } from "@/lib/utils";
import { useChatLogic } from "@/hooks/useChatLogic";
import ChatMessageList from "@/components/chat/ChatMessageList";
import { useSettingsStore } from "@/store/setting.store";
import SideBar from "@/components/SideBar";
import ChatNavBar from "@/components/Chatnavbar";
import { ChatForm } from "@/components/ChatForm/ChatForm";

function ChatPageInner(): JSX.Element {
  const {
    model,
    setModel,
    selectedModel,
    setSelectedModel,
    setSearch,
    search,
    query,
    setQuery,
    state,
    reasoningChunks,
    llmChunks,
    conversations,
    scrollRef,
    handleAskChunk,
    thinking,
    setThinking,
    event,
    controllerRef,
  } = useChatLogic();

  const {
    localConfig: { appearance },
  } = useSettingsStore();
  const textareaRef = useRef<HTMLTextAreaElement>(
    null
  ) as React.RefObject<HTMLTextAreaElement>;
  const formRef = useRef<HTMLFormElement>(
    null
  ) as React.RefObject<HTMLFormElement>;

  const handleTemplateSelect = useCallback((jobDefinition: Record<string, any>) => {
    const jsonString = JSON.stringify(jobDefinition, null, 2);
    setQuery(jsonString);
    // Auto-submit after a short delay to allow the input to be set
    setTimeout(() => {
      if (formRef.current) {
        formRef.current.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
      }
    }, 100);
  }, [setQuery]);

  const updateContainerHeight = () => {
    setTimeout(() => {
      const chatContainer = document.getElementById("chat-container");
      if (chatContainer) {
        setTimeout(() => {
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }, 50);
      }
    }, 200);
  };

  const handleSubmit = (e: React.FormEvent<Element>) => {
    e.preventDefault();
    if (query.trim() && (model || selectedModel)) {
      handleAskChunk(e as React.FormEvent<HTMLFormElement>);
      setQuery("");

      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";

        if (/Mobi|Android/i.test(navigator.userAgent)) {
          setTimeout(() => {
            textareaRef.current?.blur();
            setTimeout(updateContainerHeight, 350);
          }, 100);
        } else {
          setTimeout(updateContainerHeight, 100);
        }
      }
    }
  };

  const handleAbort = () => {
    controllerRef.current?.abort();
  };
  return (
    <>
      <div className={appearance}>
        <SideBar onTemplateSelect={handleTemplateSelect} />
      </div>

      <div
        id="chat-container"
        className={cn(
          "flex items-center flex-col w-full bg-background pb-30",
          appearance
        )}
        style={{
          height: "100dvh",
          overflowY: "auto",
          overflowX: "hidden",
        }}
        onScroll={(e) => {
          const element = e.currentTarget;
          const isNearBottom =
            element.scrollHeight - element.scrollTop - element.clientHeight <
            100;
          (window as any).chatAutoScroll = isNearBottom;
        }}
      >
        <ChatNavBar onTemplateSelect={handleTemplateSelect} />

        <ChatMessageList
          conversations={conversations}
          state={state}
          reasoningChunks={reasoningChunks}
          llmChunks={llmChunks}
          scrollRef={scrollRef}
          event={event}
          setQuery={setQuery}
          textareaRef={textareaRef}
        />

        <ChatForm
          query={query}
          setQuery={setQuery}
          model={model}
          setModel={setModel}
          selectedModel={selectedModel || model}
          setSelectedModel={setSelectedModel}
          search={search}
          setSearch={setSearch}
          thinking={thinking}
          setThinking={setThinking}
          onSubmit={handleSubmit}
          onAbort={handleAbort}
          state={state || "idle"}
          formRef={formRef}
          textareaRef={textareaRef}
        />
      </div>
    </>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div>Loading chat...</div>}>
      <ChatPageInner />
    </Suspense>
  );
}

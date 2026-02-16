/* eslint-disable */
import React, { memo, useEffect } from "react";
import { ToolExecDialog } from "./ToolExecDialog";
import { useChatStore } from "@/store/chat.store";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/store/setting.store";
import MarkdownComponent from "./MarkdownComponent";
import FollowUP from "./FollowUps";
import { UserMessage } from "./UserMessage";
import { ReasoningSection } from "./ReasoningSection";
import { SearchResultsSection } from "./SearchResultsSection";
import { MessageToolbar } from "./AiMessageToolBar";
import { useShallow } from "zustand/shallow";

const ChatMessage = memo(
  ({ msg, index, conversations, setQuery, textareaRef }: any) => {
    const { tool } = useChatStore(
      useShallow((state) => ({ tool: state.tool })),
    );
    const { appearance } = useSettingsStore(
      useShallow((state) => ({ appearance: state.localConfig.appearance })),
    );

    useEffect(() => {
      if (appearance == "dark") {
        import("highlight.js/styles/atom-one-dark.css");
      } else {
        import("highlight.js/styles/github.css");
      }
    });

    if (msg.role === "user") return <UserMessage msg={msg} />;

    return (
      <div className={cn("flex mt-8 justify-start mb-4")}>
        <div className="min-w-[95%] w-[100%] flex flex-col gap-2">
          {/* Reasoning preview */}
          {msg.reasoning && <ReasoningSection reasoning={msg.reasoning} />}

          {/* search Result */}
          {msg.search && msg.search.length > 0 && (
            <SearchResultsSection search={msg.search} />
          )}

          {/* markdown */}
          <div
            style={{
              paddingLeft: "5px",
              paddingRight: "5px",
              paddingTop: "0px",
              paddingBlock: "0px",
              margin: "0px",
              backgroundColor: "transparent",
            }}
            className="rounded-lg mt-3 markdown-container markdown-body text-sm prose prose-sm max-w-none"
          >
            <MarkdownComponent msg={msg} />
          </div>

          {/* tool execution dialog box , show run tool */}
          {tool && index === conversations.length - 1 && <ToolExecDialog />}

          {/* control Button */}
          <MessageToolbar msg={msg} tool={tool} />

          {/* follow up's goes here */}
          {msg.followUps?.length > 0 && index === conversations.length - 1 && (
            <FollowUP
              textareaRef={textareaRef}
              followUPs={msg.followUps}
              setQuery={setQuery}
            />
          )}
        </div>
      </div>
    );
  },
);

export default ChatMessage;

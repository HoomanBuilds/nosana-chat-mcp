import { CopyButton } from "../ui/shadcn-io/copy-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Ellipsis, Trash2, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { DEFAULT } from "@/lib/constants";
import { useChatStore } from "@/store/chat.store";
import { useShallow } from "zustand/shallow";

type Message = {
  id: string;
  content?: string;
  responseTime?: number;
  model?: string;
  type?: "success" | "error" | "aborted";
};

interface MessageToolbarProps {
  msg: Message;
  tool: string | undefined;
}

export function MessageToolbar({ msg, tool }: MessageToolbarProps) {
  const { deleteChat, selectedChatId, downloadMessage, setPendingTool } =
    useChatStore(
      useShallow((state) => ({
        deleteChat: state.deleteChat,
        selectedChatId: state.selectedChatId,
        downloadMessage: state.downloadMessage,
        setPendingTool: state.setPendingTool,
      })),
    );
  return (
    <div className="flex items-center text-xs mb-5">
      <CopyButton
        content={msg.content || ""}
        variant="default"
        className="size-7 bg-transparent text-muted-foreground/50 hover:text-muted-foreground hover:bg-transparent rounded p-1 cursor-pointer"
      />

      <Button
        variant="link"
        size="sm"
        onClick={() => {
          if (selectedChatId) {
            setPendingTool(null);
            deleteChat(String(selectedChatId), msg.id);
          }
        }}
        className="h-7 cursor-pointer px-2 group"
      >
        <Trash2 className="h-4 w-4 mr-1 text-muted-foreground/50 group-hover:text-red-400" />
      </Button>

      <Button variant="link" size="sm" className="w-fit h-7 px-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="cursor-pointer group">
              <Ellipsis className="size-4 text-muted-foreground/50 group-hover:text-muted-foreground" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="bg-muted text-muted-foreground"
          >
            <DropdownMenuItem
              onClick={() => downloadMessage(msg.id, "duo")}
              className="text-xs flex items-center justify-between"
            >
              Download
              <Download className="ml-2 w-3 h-3" />
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </Button>

      {!tool && (
        <div className="flex ml-auto items-center">
          {msg.responseTime && (
            <span className="text-muted-foreground/20 px-2 border-b border-dashed border border-muted-foreground/20 sm:text-xs text-[10px] italic">
              ResponseTime: {(msg.responseTime / 1000).toFixed(1)}s
            </span>
          )}

          <span className="text-muted-foreground/20 px-2 ml-auto border border-dashed border-muted-foreground/20 border-r sm:text-xs text-[10px] italic">
            {msg.model?.split("/")[1] || DEFAULT.MODEL}
          </span>

          {msg.type === "error" || msg.type === "aborted" ? (
            <span
              className={cn(
                "hidden sm:inline-block px-2 border border-dashed border-muted-foreground/20 sm:text-xs text-[10px] italic",
                msg.type === "error" ? "text-red-500/50" : "text-yellow-500/50",
              )}
            >
              {msg.type}
            </span>
          ) : (
            <span className="hidden sm:inline-block px-2 border border-dashed border-muted-foreground/20 sm:text-xs text-[10px] italic text-green-600">
              success
            </span>
          )}
        </div>
      )}
    </div>
  );
}

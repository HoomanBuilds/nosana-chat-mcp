import { memo } from "react";
import { CheckIcon, X } from "lucide-react";
import { ChatOptionsMenu } from "./ChatmenuOption";
import { Input } from "../ui/input";

const ChatListItem = memo(
  ({
    item,
    isSelected,
    onChatClick,
    editingId,
    editContent,
    onEditSave,
    onEditCancel,
    onEditStart,
    setEditContent,
    onExport,
    onRename,
    onDelete,
    barOpen,
  }: ChatListItemProps) => {
    const isEditing = editingId === item.thread_id;

    return (
      <div
        onClick={() => !isEditing && onChatClick(item.thread_id)}
        className={`select-none group mb-0.5 text-muted-foreground/80 flex items-center justify-between p-2 gap-2 rounded cursor-pointer hover:bg-muted-foreground/3 ${
          isSelected ? "bg-muted-foreground/5" : ""
        } ${isEditing ? "bg-muted-foreground/10" : ""}`}
      >
        {isEditing ? (
          <div className="flex items-center gap-1 w-full">
            <Input
              value={editContent}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  onEditSave(item.thread_id, editContent);
                } else if (e.key === "Escape") {
                  onEditCancel();
                }
              }}
              onChange={(e) => setEditContent(e.target.value)}
              className="border px-2 rounded text-sm w-full h-8"
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditSave(item.thread_id, editContent);
              }}
              className="text-muted-foreground/60 hover:text-green-500 transition-colors"
            >
              <CheckIcon size={16} />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEditCancel();
              }}
              className="text-muted-foreground/60 hover:text-red-500 transition-colors"
            >
              <X size={16} />
            </button>
          </div>
        ) : (
          <>
            <div className="line-clamp-1 text-sm flex-1">
              {item.thread_title ?? "Chat"}
            </div>
            {barOpen && (
              <ChatOptionsMenu
                threadId={item.thread_id}
                threadTitle={item.thread_title}
                onExport={onExport}
                onRename={onRename}
                onDelete={onDelete}
                setEditingId={onEditStart}
                setEditContent={setEditContent}
              />
            )}
          </>
        )}
      </div>
    );
  },
);

interface ChatListItemProps {
  item: { thread_id: string; thread_title?: string };
  isSelected: boolean;
  onChatClick: (id: string) => void;
  editingId: string | null;
  editContent: string;
  onEditSave: (id: string, title: string) => void;
  onEditCancel: () => void;
  onEditStart: (id: string | null) => void;
  setEditContent: (content: string) => void;
  onExport: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  barOpen: boolean;
}

export default ChatListItem;

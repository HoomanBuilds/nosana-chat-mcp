import { ChatOptionsMenu } from "./ChatmenuOption";

const CurrentChatSection = ({
    barOpen,
    selectedChatId,
    chatHistory,
    onExport,
    onDelete,
    setEditingId,
    setEditContent
}: CurrentChatSectionProps) => {
    if (!barOpen || !selectedChatId) return null;

    return (
        <div className="mb-4 px-3 h-fit text-muted-foreground/20">
            <div className="inline-block text-muted-foreground/40 text-xs mb-2">Current Chat</div>
            <div className="flex items-center cursor-pointer justify-between py-2 px-3 border border-dashed border-muted-foreground/30 bg-muted-foreground/5 rounded group">
                <span className="line-clamp-1 text-foreground/50 text-sm">
                    {chatHistory.find(c => c.thread_id === selectedChatId)?.thread_title ?? "New Chat"}
                </span>
                <ChatOptionsMenu
                    threadId={selectedChatId}
                    threadTitle={chatHistory.find(c => c.thread_id === selectedChatId)?.thread_title}
                    onExport={onExport}
                    onRename={(id, title) => console.log("rename current", id, title)}
                    onDelete={onDelete}
                    setEditingId={setEditingId}
                    setEditContent={setEditContent}
                />
            </div>
        </div>
    );
};


interface CurrentChatSectionProps {
    barOpen: boolean;
    selectedChatId: string | null;
    chatHistory: Array<{ thread_id: string; thread_title?: string }>;
    onExport: (id: string) => void;
    onDelete: (id: string) => void;
    setEditingId: (id: string | null) => void;
    setEditContent: (content: string) => void;
}

export default CurrentChatSection;
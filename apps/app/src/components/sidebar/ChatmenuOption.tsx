
import React from "react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils"
import { Download, Ellipsis, Pen, Trash2 } from "lucide-react";


interface ChatOptionsMenuProps {
    threadId: string;
    threadTitle?: string;
    onExport: (id: string) => void;
    onRename: (id: string, title: string) => void;
    onDelete: (id: string) => void;
    setEditingId?: (id: string | null) => void;
    setEditContent?: (title: string) => void;
}

export function ChatOptionsMenu({
    threadId,
    threadTitle,
    onExport,
    onRename,
    onDelete,
    setEditingId,
    setEditContent,
}: ChatOptionsMenuProps) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <div
                    className={cn(
                        "block sm:invisible group-hover:visible"
                    )}
                    onClick={(e) => e.stopPropagation()}
                >
                    <Ellipsis className="size-4 text-muted-foreground/40 cursor-pointer" />
                </div>
            </DropdownMenuTrigger>

            <DropdownMenuContent
                align="start"
                className="w-40 bg-muted border border-muted-foreground/10 text-muted-foreground/80"
                onClick={(e) => e.stopPropagation()}
            >
                <DropdownMenuItem
                    onClick={() => onExport(threadId)}
                    className="justify-between cursor-pointer items-center"
                >
                    Export Thread
                    <Download />
                </DropdownMenuItem>

                <DropdownMenuItem
                    onClick={() => {
                        setEditingId?.(threadId);
                        setEditContent?.(threadTitle || "");
                        onRename(threadId, threadTitle || "");
                    }}
                    className="justify-between cursor-pointer flex items-center"
                >
                    Rename
                    <Pen />
                </DropdownMenuItem>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                    onClick={() => onDelete(threadId)}
                    className="focus:bg-red-500/20 hover:bg-red-500/10 dark:hover:bg-red-500/20 dark:focus:bg-red-500/30 justify-between cursor-pointer text-red-600 dark:text-red-400"
                >
                    Delete Thread
                    <Trash2 className="text-red-600 dark:text-red-400" />
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}


export default ChatOptionsMenu;
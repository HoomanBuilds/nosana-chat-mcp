import React from "react";
import { CopyButton } from "../ui/shadcn-io/copy-button";

interface UserMessageProps {
    msg: {
        id?: string;
        content: string;
        role?: string;
    };
}

export function UserMessage({ msg }: UserMessageProps) {
    return (
        <div
            className="mt-5 mb-2 flex scroll-mt-20 flex-col items-end group"
            data-message-id={msg.id}
        >
            <div className="max-w-[95%] bg-muted-foreground/3 border border-muted-foreground/5 rounded  group py-2 text-sm tracking-tighter px-4">
                <div className="relative">

                    <pre
                        className="text-muted-foreground/70 rounded space-pre-wrap whitespace-pre-wrap overflow-scroll"
                    >
                        {msg.content}
                    </pre>
                </div>
            </div> 
            <CopyButton content={msg.content} variant={"default"} className="bg-transparent text-transparent group-hover:text-white hover:bg-transparent" />
        </div>
    );
}

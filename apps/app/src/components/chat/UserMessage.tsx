import React from "react";
import { CopyButton } from "../ui/shadcn-io/copy-button";

interface UserMessageProps {
    msg: {
        content: string;
        role?: string;
    };
}

export function UserMessage({ msg }: UserMessageProps) {
    return (
        <div className="flex mt-5 items-end mb-2 flex-col group">
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

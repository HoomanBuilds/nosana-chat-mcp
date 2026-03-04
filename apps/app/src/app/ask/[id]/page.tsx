import { Metadata } from "next";
import ChatPageClient from "./ChatPageClient";

export const metadata: Metadata = {
    title: "Nosana Chat | Conversation",
    description: "Chat history and active conversation",
};

import { Suspense } from "react";
import { Loader2 } from "lucide-react";

export default function Page() {
    return (
        <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>}>
            <ChatPageClient />
        </Suspense>
    );
}

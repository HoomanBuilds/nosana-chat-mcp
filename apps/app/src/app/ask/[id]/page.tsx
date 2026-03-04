import { Metadata } from "next";
import ChatPageClient from "./ChatPageClient";

export const metadata: Metadata = {
    title: "Nosana Chat | Conversation",
    description: "Chat history and active conversation",
};

import { Suspense } from "react";
import { Loader2 } from "lucide-react";

import { LoadingScreen } from "@/components/ui/LoadingScreen";

export default function Page() {
    return (
        <Suspense fallback={<LoadingScreen />}>
            <ChatPageClient />
        </Suspense>
    );
}

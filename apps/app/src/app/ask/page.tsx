import { Metadata } from "next";
import AskPageClient from "./AskPageClient";

export const metadata: Metadata = {
  title: "Nosana Chat | Ask",
  description: "Ask anything to Nosana Chat",
};

import { Suspense } from "react";
import { Loader2 } from "lucide-react";

export default function Page() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin" /></div>}>
      <AskPageClient />
    </Suspense>
  );
}

import { Metadata } from "next";
import AskPageClient from "./AskPageClient";

export const metadata: Metadata = {
  title: "Nosana Chat | Ask",
  description: "Ask anything to Nosana Chat",
};

import { Suspense } from "react";

import { LoadingScreen } from "@/components/ui/LoadingScreen";

export default function Page() {
  return (
    <Suspense fallback={<LoadingScreen />}>
      <AskPageClient />
    </Suspense>
  );
}

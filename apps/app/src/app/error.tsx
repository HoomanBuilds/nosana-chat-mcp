"use client";

import { useEffect } from "react";
import Link from "next/link";
import { CopyButton } from "@/components/ui/shadcn-io/copy-button";
import { AlertCircle, RefreshCcw, Home } from "lucide-react";

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Log the error to an error reporting service
        console.error("Global App error:", error);
    }, [error]);

    return (
        <div className="flex h-screen w-full items-center justify-center bg-background text-foreground p-4">
            <div className="w-full max-w-xl space-y-6">
                <div className="flex flex-col items-center justify-center space-y-3 text-center">
                    <div className="rounded-full bg-red-100 p-4 dark:bg-red-900/20">
                        <AlertCircle className="h-10 w-10 text-red-600 dark:text-red-500" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight">Something went wrong</h1>
                    <p className="text-muted-foreground max-w-md">
                        The application encountered an unexpected error. We apologize for the inconvenience.
                    </p>
                </div>

                <div className="relative rounded-lg border bg-muted/50 p-4 font-mono text-sm">
                    <div className="absolute right-2 top-2">
                        <CopyButton content={error.message || "Unknown error"} className="h-6 w-6" />
                    </div>
                    <p className="text-red-500 mb-2 font-semibold">Error Message:</p>
                    <p className="break-words text-muted-foreground pr-8">
                        {error.message || "An unknown error occurred during rendering."}
                    </p>
                    {error.digest && (
                        <p className="mt-2 text-xs text-muted-foreground/50">
                            Digest: {error.digest}
                        </p>
                    )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
                    <button
                        onClick={() => reset()}
                        className="inline-flex items-center justify-center rounded-md border border-transparent bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                    >
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Try Again
                    </button>
                    <Link
                        href="/"
                        className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium shadow-sm transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
                    >
                        <Home className="mr-2 h-4 w-4" />
                        Go to Home
                    </Link>
                </div>
            </div>
        </div>
    );
}

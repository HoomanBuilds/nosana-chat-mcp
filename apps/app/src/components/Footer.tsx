import { cn } from "@/lib/utils";

export function Footer({ className }: { className?: string }) {
    return (
        <div className={cn("text-muted-foreground/50 hidden md:flex md:text-[11px] opacity-50 p-2 text-center" , className)}>
            This AI assistant may generate inaccurate or incomplete information. Please verify responses before relying on them for important decisions
        </div>
    );
};

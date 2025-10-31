import { cn } from "@/lib/utils";
import { ArrowLeftToLine } from "lucide-react";

/* eslint-disable @next/next/no-img-element */
interface SidebarHeaderProps {
    barOpen: boolean;
    setBarOpen: (open: boolean) => void;
    toggleMobile: () => void;
    router: any;
}

const SidebarHeader = ({ barOpen, setBarOpen, toggleMobile, router }: SidebarHeaderProps) => (
    <div className={cn(
        "border-b border-dashed border-muted-foreground/30 pb-3 text-sm font-semibold text-muted-foreground",
        barOpen && "flex"
    )}>
        {barOpen ? (
            <div className="flex items-center gap-2 text-muted-foreground/20 font-semibold w-full">
                <img
                    src="/nosana.png"
                    alt="nosana Logo"
                    className="w-6 h-6 aspect-square cursor-pointer"
                    onClick={() => router.push("/ask")}
                />
                <div className="flex gap-1 items-baseline flex-1">
                    <span className="text-xl text-muted-foreground/70">NOSANA</span>
                    <span>Chat</span>
                </div>
                <button
                    onClick={() => {
                        if (window.innerWidth < 1024) {
                            toggleMobile();
                        } else {
                            setBarOpen(!barOpen);
                        }
                    }}
                    className="flex items-center justify-end p-1 hover:bg-muted-foreground/10 rounded transition-colors"
                >
                    <ArrowLeftToLine className="size-4 text-muted-foreground/80 cursor-pointer" />
                </button>
            </div>
        ) : (
            <div className="flex flex-col items-center gap-2">
                <img
                    src="/nosana.png"
                    alt="nosana Logo"
                    className="w-8 h-8 aspect-square cursor-pointer"
                    onClick={() => router.push("/ask")}
                />
            </div>
        )}
    </div>
);


export default SidebarHeader;
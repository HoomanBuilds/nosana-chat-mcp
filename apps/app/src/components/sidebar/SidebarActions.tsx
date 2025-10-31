import { ArrowRightFromLine, Sparkles } from "lucide-react";
import { Button } from "../ui/button";
import { SlMagnifier } from "react-icons/sl";


interface SidebarActionsProps {
    barOpen: boolean;
    setBarOpen: (open: boolean) => void;
    setPopupOpen: (open: boolean) => void;
    handleNewChat: () => void;
}

const SidebarActions = ({ barOpen, setBarOpen, setPopupOpen, handleNewChat }: SidebarActionsProps) => (
    <div className="space-y-2">
        {!barOpen && (
            <div className="w-full py-2 rounded flex items-center hover:bg-muted-foreground/5 justify-center border border-muted-foreground/20 transition-colors">
                <ArrowRightFromLine
                    onClick={() => setBarOpen(true)}
                    className="size-5 text-muted-foreground/80 cursor-pointer"
                />
            </div>
        )}

        <Button
            onClick={async () => {
                setBarOpen(true);
                await new Promise(resolve => setTimeout(resolve, 100));
                setPopupOpen(true);
            }}
            className={`flex text-muted-foreground/80 items-center cursor-pointer gap-2 w-full hover:bg-muted-foreground/5 p-2 rounded border bg-muted-foreground/5 border-muted-foreground/20 transition-all duration-200 `}
        >
            <SlMagnifier className="" />
            {barOpen && (
                <span className="flex justify-between items-center w-full line-clamp-1 text-muted-foreground/80">
                    Search chats
                </span>
            )}
        </Button>

        <Button
            onClick={handleNewChat}
            className={`flex text-muted-foreground/80 items-center cursor-pointer gap-2 w-full hover:bg-muted-foreground/5 p-2 rounded border bg-transparent border-muted-foreground/20 transition-all duration-200 ${!barOpen ? "justify-center px-2" : "justify-center"
                }`}
        >
            {barOpen && <span>New Chat</span>}
            <Sparkles size={18} />
        </Button>
    </div>
);

export default SidebarActions;
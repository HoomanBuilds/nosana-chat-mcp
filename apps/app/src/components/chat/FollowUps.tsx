import { Undo2 } from "lucide-react";

const FollowUP = ({ followUPs, setQuery, textareaRef, onSubmit }: { followUPs: { question: string }[], setQuery: any, textareaRef: React.RefObject<HTMLTextAreaElement>, onSubmit?: (question: string) => void }) => {
    const handleClick = (question: string) => {
        if (onSubmit) {
            onSubmit(question);
        } else {
            setQuery(question);
            textareaRef.current?.focus();
        }
    };

    return (
        <div className="w-full sm:w-[80vw] mb-5 md:w-[60vw] xl:w-[50vw] max-w-[800px] flex flex-col gap-2 py-2 sm:px-2">
            <h3 className="text-sm text-muted-foreground/70 mb-1">Follow-up Questions:</h3>
            <div className="flex flex-col gap-2">
                {followUPs.map((item, index) => {
                    const questionText = typeof item === 'string' ? item : item.question;
                    if (!questionText) return null;
                    return (
                        <div
                            key={questionText || index}
                            role="button"
                            tabIndex={0}
                            onClick={() => handleClick(questionText)}
                            onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { handleClick(questionText); e.preventDefault(); } }}
                            className="text-muted-foreground/50 w-fit group flex hover:border-muted-foreground/5 hover:bg-muted-foreground/6 justify-between items-center bg-muted-foreground/5 border border-muted-foreground/5 rounded-md cursor-pointer border-dashed p-2 text-sm animate-in fade-in-0 slide-in-from-bottom-3 duration-300 fill-mode-both"
                            style={{ animationDelay: `${index * 150}ms` }}
                        >
                            {questionText}
                            <span className="opacity-40 group-hover:text-muted-foreground transition-all duration-75 ">
                                <Undo2 className="ml-4 w-5 h-5" />
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    )
}

export default FollowUP;
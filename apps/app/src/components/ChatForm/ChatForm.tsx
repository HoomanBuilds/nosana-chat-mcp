"use client";
import React from "react";
import { SlGlobe } from "react-icons/sl";
import { cn } from "@/lib/utils";
import { Modes } from "@nosana-chat/ai";
import { ChatInput } from "./ChatInput";
import { ModelSelector } from "./Modelselector";
import { FeatureToggle } from "./FeatureToggle";
import { SubmitButton } from "./ui/submit-button";
import { Brain, Wallet } from "lucide-react";
import { useChatStore } from "@/store/chat.store";
import { useWalletStore } from "@/store/wallet.store";
import PhantomConnect from "../PhantomConnect";

interface ChatFormProps {
    query: string;
    setQuery: (query: string) => void;
    model: string;
    setModel: (model: string) => void;
    selectedModel: string;
    setSelectedModel: (model: string) => void;

    search: boolean;
    setSearch: (search: boolean) => void;
    thinking: boolean;
    setThinking: (thinking: boolean) => void;

    onSubmit: (e: React.FormEvent) => void;
    onAbort?: () => void;
    state: "idle" | "loading";

    formRef?: React.RefObject<HTMLFormElement>;
    textareaRef?: React.RefObject<HTMLTextAreaElement>;

    className?: string;
}

export const ChatForm: React.FC<ChatFormProps> = ({
    query,
    setQuery,
    model,
    setModel,
    selectedModel,
    setSelectedModel,
    search,
    setSearch,
    thinking,
    setThinking,
    onSubmit,
    onAbort,
    state,
    formRef,
    textareaRef,
    className
}) => {
    const currentConfig = Modes.ChatModeConfig[selectedModel?.split("/")[1] as keyof typeof Modes.ChatModeConfig] || {};

    const { tool } = useChatStore()
    const { wallet } = useWalletStore()
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const isMobile = /Mobi|Android/i.test(navigator.userAgent);

        if (e.key === "Enter" && !isMobile && !e.shiftKey) {
            e.preventDefault();
            if (query.trim()) {
                onSubmit(e);
                setQuery("");
            }
        }
    };

    const handleModelChange = (val: string) => {
        setModel(val);
        localStorage.setItem("llmmodel", val);
        setSelectedModel(val);
    };

    return (
        <form
            ref={formRef}
            onSubmit={onSubmit}
            className={cn(
                "overflow-hidden bg-muted w-[95vw] sm:w-[80vw] md:w-[70vw] lg:w-[60vw] xl:w-[60vw] max-w-[800px] rounded-2xl border-2 border-muted-foreground/5 flex flex-col gap-2 mb-3 fixed bottom-0",
                className
            )}
        >
            <ChatInput
                value={query}
                onChange={setQuery}
                onKeyDown={handleKeyDown}
                textareaRef={textareaRef}
            />

            <div className="flex justify-between items-center pb-2 px-2">
                <div className="flex gap-4 items-center text-black/50">
                    {
                        !tool ? (
                            <ModelSelector
                                value={model || selectedModel}
                                onValueChange={handleModelChange}
                            />
                        ) : (
                            wallet ? <div onClick={() => navigator.clipboard.writeText(wallet)}><Wallet className="text-purple-500" /></div> : (
                                <PhantomConnect />
                            )
                        )
                    }

                    {currentConfig.search && !tool && (
                        <FeatureToggle
                            icon={<SlGlobe size={20} />}
                            isActive={search}
                            onClick={() => setSearch(!search)}
                            activeColor="text-blue-500/50"
                        />
                    )}

                    {currentConfig.thinking && !tool && (
                        <FeatureToggle
                            icon={<Brain size={20} />}
                            isActive={thinking}
                            onClick={() => setThinking(!thinking)}
                            activeColor="text-yellow-500"
                        />
                    )}
                </div>

                <SubmitButton
                    isLoading={state === "loading"}
                    isDisabled={!query.trim()}
                    onAbort={onAbort}
                    onSubmit={() => {
                        if (query.trim()) {
                            onSubmit(new Event('submit') as any);
                            setQuery("");
                        }
                    }}
                />
            </div>
        </form>
    );
};
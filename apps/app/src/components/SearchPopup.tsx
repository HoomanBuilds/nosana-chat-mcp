import { useChatStore } from '@/store/chat.store';
import { useSettingsStore } from '@/store/setting.store';
import { useRouter } from 'next/navigation';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, MessageSquare, Command, FileUp, FileDown, Trash2, Plus, Settings, Rocket } from 'lucide-react';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Card } from './ui/card';
import { AdvancedSearch } from '@/lib/utils/AdvancedSearchAnalytics';

interface ChatItem {
    thread_id: string;
    thread_title?: string;
    type: "chat";
    score?: number;
    matchType?: "exact" | "partial" | "fuzzy";
}

interface CommandItem {
    keywords: string[];
    label: string;
    action: () => void;
    type: "command";
    icon?: React.ReactNode;
    category?: string;
    score?: number;
    matchType?: "exact" | "partial" | "fuzzy";
}

interface SearchPopupProps {
    setPopupOpen: React.Dispatch<React.SetStateAction<boolean>>;
    chatHistory: Array<{ thread_id: string; thread_title?: string }>;
}


function SearchPopup({ setPopupOpen, chatHistory }: SearchPopupProps) {
    const [search, setSearch] = useState("");
    const [filteredCommands, setFilteredCommands] = useState<CommandItem[]>([]);
    const [filteredChats, setFilteredChats] = useState<ChatItem[]>([]);
    const router = useRouter();

    const { exportThread, selectedChatId, deletethread, exportAllThreads, clearAll, importThreads } = useChatStore();
    const { openSettings, setActiveTab, toggleMobile } = useSettingsStore();

    const handleEscape = useCallback((event: KeyboardEvent) => {
        if (event.key === 'Escape') {
            setPopupOpen(false);
        }
    }, [setPopupOpen]);

    useEffect(() => {
        document.addEventListener('keydown', handleEscape);
        return () => document.removeEventListener('keydown', handleEscape);
    }, [handleEscape]);


    const commandsRegistry: CommandItem[] = useMemo(() => [
        {
            keywords: ["create", "new", "start", "add", "chat", "begin", "init"],
            label: "Create New Chat",
            action: () => router.push("/ask"),
            type: "command",
            icon: <Plus size={16} />,
            category: "Chat"
        },
        {
            keywords: ["mcp", "nosana", "deploy" ,"gpu" , "host"],
            label: "Deploy Model",
            action: () => router.push("/ask?mcp=deployer"),
            type: "command",
            icon: <Rocket size={16} />,
            category: "MCP"
        },
        {
            keywords: ["export", "download", "save", "backup", "dump", "extract"],
            label: "Export Selected Chat",
            action: () => {
                if (selectedChatId) {
                    exportThread(selectedChatId).catch(console.error);
                    setPopupOpen(false);
                } else {
                    alert("No chat selected to export.");
                }
            },
            type: "command",
            icon: <FileDown size={16} />,
            category: "Export"
        },
        {
            keywords: ["delete", "remove", "trash", "clear", "del", "rm", "erase"],
            label: "Delete Selected Chat",
            action: () => {
                if (selectedChatId) {
                    deletethread(selectedChatId).then(() => {
                        if (selectedChatId === selectedChatId) router.push("/ask");
                        setPopupOpen(false);
                    }).catch(console.error);
                } else {
                    alert("No chat selected to delete.");
                }
            },
            type: "command",
            icon: <Trash2 size={16} />,
            category: "Manage"
        },
        {
            keywords: ["export all", "download all", "backup all", "export everything", "all chats"],
            label: "Export All Chats",
            action: () => {
                exportAllThreads().catch(console.error);
                setPopupOpen(false);
            },
            type: "command",
            icon: <FileDown size={16} />,
            category: "Export"
        },
        {
            keywords: ["custom prompt", "prompt", "instruction", "system prompt", "persona"],
            label: "Custom Prompt Settings",
            action: () => {
                openSettings();
                setActiveTab("Custom Prompt");
                setPopupOpen(false);
            },
            type: "command",
            icon: <Settings size={16} />,
            category: "Settings"
        },
        {
            keywords: ["custom config", "config", "configuration", "ai settings", "model settings"],
            label: "AI Configuration",
            action: () => {
                openSettings();
                setActiveTab("Custom Configs");
                setPopupOpen(false);
            },
            type: "command",
            icon: <Settings size={16} />,
            category: "Settings"
        },
        {
            keywords: ["clear all", "delete all", "remove all", "wipe", "reset all"],
            label: "Clear All Chats",
            action: () => {
                if (confirm("Are you sure you want to delete all chats? This action cannot be undone.")) {
                    clearAll();
                    setPopupOpen(false);
                }
            },
            type: "command",
            icon: <Trash2 size={16} />,
            category: "Manage"
        },
        {
            keywords: ["import", "upload", "restore", "backup", "chats", "load"],
            label: "Import Chats",
            action: () => {
                const input = document.createElement("input");
                input.type = "file";
                input.accept = ".json";
                input.onchange = async (e: Event) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                        await importThreads(file);
                        setPopupOpen(false);
                    }
                };
                input.click();
            },
            type: "command",
            icon: <FileUp size={16} />,
            category: "Import"
        }
    ], [
        router, selectedChatId, exportThread, setPopupOpen, deletethread,
        exportAllThreads, openSettings, setActiveTab, clearAll, importThreads
    ]);

    useEffect(() => {
        if (!search.trim()) {
            setFilteredCommands(commandsRegistry.slice(0, 4));
            setFilteredChats(
                chatHistory
                    .slice(0, 5)
                    .map(c => ({ ...c, type: "chat" as const }))
            );
            return;
        }

        const cmdMatches = commandsRegistry
            .map(cmd => {
                const keywordScores = cmd.keywords.map(k =>
                    AdvancedSearch.scoreMatch(k, search)
                );
                const labelScore = AdvancedSearch.scoreMatch(cmd.label, search);
                const categoryScore = cmd.category ? AdvancedSearch.scoreMatch(cmd.category, search) : { score: 0, matchType: "fuzzy" as const };

                const bestKeywordScore = Math.max(...keywordScores.map(k => k.score));
                const bestScore = Math.max(bestKeywordScore, labelScore.score, categoryScore.score);

                const boostedScore = AdvancedSearch.boostScore(
                    bestScore,
                    `${cmd.label} ${cmd.keywords.join(' ')} ${cmd.category}`,
                    search
                );

                return {
                    ...cmd,
                    score: boostedScore,
                    matchType: [labelScore.matchType, ...keywordScores.map(k => k.matchType)]
                        .find(mt => mt === "exact") ||
                        keywordScores.find(k => k.matchType === "partial")?.matchType ||
                        "fuzzy"
                };
            })
            .filter(cmd => cmd.score > 15)
            .sort((a, b) => b.score - a.score);

        const chatMatches = chatHistory
            .map(chat => {
                const title = chat.thread_title || "Untitled Chat";
                const { score, matchType } = AdvancedSearch.scoreMatch(title, search);

                const boostedScore = AdvancedSearch.boostScore(score, title, search);

                return {
                    ...chat,
                    type: "chat" as const,
                    score: boostedScore,
                    matchType
                };
            })
            .filter(chat => chat.score > 10)
            .sort((a, b) => b.score - a.score);

        setFilteredCommands(cmdMatches);
        setFilteredChats(chatMatches);
    }, [search, chatHistory, commandsRegistry]);

    const handleResultClick = (action: () => void) => {
        action();
        setPopupOpen(false);
    };

    const handleChatClick = (threadId: string) => {
        router.push(`/ask/${threadId}`);
        if (toggleMobile) toggleMobile();
        setPopupOpen(false);
    };

    const HighlightText = ({ text, query }: { text: string; query: string }) => {
        if (!query.trim()) return <span>{text}</span>;

        const normalizedText = text.toLowerCase();
        const normalizedQuery = query.toLowerCase();
        const index = normalizedText.indexOf(normalizedQuery);

        if (index === -1) return <span>{text}</span>;

        return (
            <span>
                {text.substring(0, index)}
                <mark className="text-green-500 bg-transparent px-1 rounded">
                    {text.substring(index, index + query.length)}
                </mark>
                {text.substring(index + query.length)}
            </span>
        );
    };

    return (
        <div
            className="fixed inset-0 flex items-center justify-center bg-black/50 z-50 p-4"
            onClick={() => setPopupOpen(false)}
        >
            <div
                className="bg-background rounded-xl border shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden"
                onClick={e => e.stopPropagation()}
            >
                <div className="p-6 border-b bg-muted/50">
                    <div className="flex items-center gap-3 mb-3">
                        <Search className="text-muted-foreground" size={20} />
                        <h2 className="text-lg font-semibold">Search & Commands</h2>
                    </div>
                    <Input
                        autoFocus
                        type="text"
                        placeholder="Search chats or commands..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-background"
                        onKeyDown={(e) => {
                            if (e.key === 'Escape') {
                                setPopupOpen(false);
                            }
                        }}
                    />
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {filteredCommands.length > 0 && (
                        <div>
                            <SectionHeader
                                title="Commands"
                                icon={<Command size={16} />}
                                count={filteredCommands.length}
                            />
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {filteredCommands.map((cmd, idx) => (
                                    <ResultCard
                                        key={idx}
                                        onClick={() => handleResultClick(cmd.action)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="text-green-600">
                                                {cmd.icon}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex font-medium items-center justify-between text-sm">
                                                    <HighlightText text={cmd.label} query={search} />

                                                    <div className="flex items-center gap-2">
                                                        {cmd.category && (
                                                            <Badge variant="outline" className=" text-xs">
                                                                {cmd.category}
                                                            </Badge>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </ResultCard>
                                ))}
                            </div>
                        </div>
                    )}

                    {filteredChats.length > 0 && (
                        <div>
                            <SectionHeader
                                title="Chats"
                                icon={<MessageSquare size={16} />}
                                count={filteredChats.length}
                            />
                            <div className="space-y-2">
                                {filteredChats.map((chat, idx) => (
                                    <ResultCard
                                        key={idx}
                                        onClick={() => handleChatClick(chat.thread_id)}
                                    >
                                        <div className="flex items-center gap-3">
                                            <MessageSquare size={16} className="text-foreground" />
                                            <span className="text-sm text-muted-foreground/70 truncate flex-1">
                                                <HighlightText
                                                    text={chat.thread_title || "Untitled Chat"}
                                                    query={search}
                                                />
                                            </span>
                                        </div>
                                    </ResultCard>
                                ))}
                            </div>
                        </div>
                    )}

                    {filteredCommands.length === 0 && filteredChats.length === 0 && search && (
                        <EmptyState message={
                            `No results`
                        } />
                    )}

                    {!search && filteredChats.length === 0 && (
                        <EmptyState message="Start typing to search chats and commands..." />
                    )}
                </div>

                <div className="p-4 border-t bg-muted/30">
                    <div className="flex justify-between items-center text-xs text-muted-foreground">
                        <span>Press Esc to close</span>
                        <span>{filteredCommands.length + filteredChats.length} results</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default SearchPopup;


const ResultCard = ({
    children,
    onClick,
    className = ""
}: {
    children: React.ReactNode;
    onClick: () => void;
    className?: string;
}) => (
    <Card
        className={`p-3 cursor-pointer transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] border-1 rounded hover:border-primary/20 ${className}`}
        onClick={onClick}
    >
        {children}
    </Card>
);

const SectionHeader = ({
    title,
    icon,
    count
}: {
    title: string;
    icon: React.ReactNode;
    count: number;
}) => (
    <div className="flex items-center  gap-2 mb-3">
        {icon}
        <span className="text-sm font-medium translate-y-0.5 text-muted-foreground">{title}</span>
        <Badge variant="secondary" className="ml-auto bg-muted border shadow-sm">
            {count}
        </Badge>
    </div>
);

const EmptyState = ({ message }: { message: string }) => (
    <div className="text-center py-8 text-muted-foreground">
        {/* <div className="text-4xl mb-2">🔍</div> */}
        <p className="opacity-60 text-sm">{message}</p>
    </div>
);
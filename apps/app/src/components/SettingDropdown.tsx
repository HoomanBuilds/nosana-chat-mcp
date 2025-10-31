import { Button } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuGroup,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuPortal,
    DropdownMenuSeparator,
    DropdownMenuShortcut,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Download, ImportIcon, Info, ListCollapseIcon, Settings2, Trash } from "lucide-react"

import { useRef, useState } from "react"
import SettingPopover from "./SettingPopover"
import { useChatStore } from "@/store/chat.store"
import { useSettingsStore } from "@/store/setting.store"
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "./ui/dialog"
import { Input } from "./ui/input"
import { cn, ping } from "@/lib/utils"
import { getRemainingCredits } from "@/lib/client/credit"


interface ApiConfig {
    name: string;
    storageKey: string;
    placeholder?: string;
    pingModel: string;
    guide: string
}

const apis: ApiConfig[] = [
    { name: "Gemini", storageKey: "geminiApiKey", placeholder: "Paste your Gemini API key", pingModel: "gemini-2.0-flash", guide: "https://aistudio.google.com/api-keys" },
    { name: "Tavily", storageKey: "TavilyApiKey", placeholder: "Paste your Tavily API key", pingModel: "tavilydefault", guide: "" },
];

function ApiKeyDialog({ api }: { api: ApiConfig }) {
    const [key, setKey] = useState(() => localStorage.getItem(api.storageKey) || "");
    return (
        <Dialog>
            <DialogTrigger asChild>
                <div>{api.name}</div>
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{api.name} API Key</DialogTitle>
                    <DialogDescription>Add {api.name} API key here</DialogDescription>
                </DialogHeader>
                <Input
                    type="password"
                    placeholder={api.placeholder}
                    value={key}
                    className="selection:bg-green-400"
                    onChange={(e) => setKey(e.target.value)}
                />
                <DialogFooter className="sm:justify-start">
                    <DialogClose asChild>
                        <Button
                            className="bg-green-400 cursor-pointer hover:bg-green-600 text-sm"
                            type="button"
                            onClick={async () => {
                                const isValid = await ping({
                                    provider: api.name,
                                    apiKey: key,
                                    modelName: api.pingModel
                                });

                                if (isValid) {
                                    localStorage.setItem(api.storageKey, key);
                                    alert("API key saved!");
                                } else {
                                    alert("Invalid API key");
                                    setKey("");
                                }
                            }}
                        >
                            Save
                        </Button>
                    </DialogClose>
                    <a href={api.guide} target="_blank" className="hover:underline text-xs ml-auto mt-auto text-muted-foreground/40 flex items-center gap-1"><Info size={15} /> get <span className="text-muted-foreground"> {api.name}</span> api key </a>
                </DialogFooter>
            </DialogContent>
        </Dialog >
    );
}


export function LoginDropDown({ barOpen, router }: { barOpen?: boolean, router: any }) {
    const { settingsOpen, openSettings, closeSettings } = useSettingsStore();
    const { exportAllThreads, importThreads, clearAll , tool} = useChatStore()
    function handleExport() {
        exportAllThreads().catch(console.error)
    }
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFileSelect = async () => {
        const file = fileInputRef.current?.files?.[0];
        console.log("File selected:", file);
        if (!file) return;

        try {
            await importThreads(file);
            console.log("importThreads finished successfully");
        } catch (err) {
            console.error("importThreads failed:", err);
            alert("Failed to import threads.");
        } finally {
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    return (
        <>
            <DropdownMenu>
                <DropdownMenuTrigger className="bg-muted  border-muted-foreground/20 rounded hover:bg-muted-foreground/5 cursor-pointer" asChild>
                    <Button variant="outline" className={cn(" w-full p-0  flex", barOpen && "justify-between")}>
                        {barOpen ? (
                            <>
                                <p className="text-muted-foreground/80">Nosana Chat</p>
                                <ListCollapseIcon className="text-muted-foreground/80" />
                            </>
                        ) :
                            <Settings2 className="text-muted-foreground/80" />
                        }
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 bg-muted border border-muted-foreground/10 text-muted-foreground/80" align="center">
                    <DropdownMenuLabel className="text-muted-foreground/40">My Account</DropdownMenuLabel>
                    <DropdownMenuGroup>
                        <DropdownMenuItem
                            onSelect={() => openSettings()}
                            className="flex items-center justify-between"
                        >
                            Settings
                            <DropdownMenuShortcut><Settings2 /></DropdownMenuShortcut>
                        </DropdownMenuItem>
                    </DropdownMenuGroup>
                    <DropdownMenuGroup>
                    </DropdownMenuGroup>

                    {
                        process.env.NODE_ENV !== "production" &&
                        <DropdownMenuSub>
                            <DropdownMenuSubTrigger>API keys</DropdownMenuSubTrigger>
                            <DropdownMenuPortal>
                                <DropdownMenuSubContent>
                                    {apis.map((api) => (
                                        <DropdownMenuItem
                                            key={api.storageKey}
                                            onSelect={(e) => e.preventDefault()}
                                        >
                                            <ApiKeyDialog api={api} />
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuSubContent>
                            </DropdownMenuPortal>
                        </DropdownMenuSub>
                    }

                    <DropdownMenuSeparator />
                    {/* <DropdownMenuItem onClick={() => window.open("https://github.com/HoomanDigital/nosana-chat", "_blank")}>GitHub
                        <DropdownMenuShortcut><Github /></DropdownMenuShortcut>
                    </DropdownMenuItem> */}
                    <DropdownMenuItem onClick={handleExport}>ExportAllThreads
                        <DropdownMenuShortcut><Download /></DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                        ImportThreads
                        <DropdownMenuShortcut><ImportIcon /></DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => null} className={cn(tool == "deployer" && "hidden")}>
                        credits
                        <DropdownMenuShortcut>{getRemainingCredits()}/10</DropdownMenuShortcut>
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                        router.push("/ask")
                        clearAll()
                    }}>
                        Clear All thread
                        <DropdownMenuShortcut><Trash /></DropdownMenuShortcut>
                    </DropdownMenuItem>

                </DropdownMenuContent>
            </DropdownMenu>
            <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                style={{ display: "none" }}
                onChange={handleFileSelect}
            />
            <SettingPopover
                open={settingsOpen}
                setOpen={closeSettings}
            />
        </>
    )
}

import React from "react";
import rehypeRaw from "rehype-raw";
import {
    Download,
    Code2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import "../../styles/markdown.css";
import rehypeHighlight from "rehype-highlight";
import { CopyButton } from "../ui/shadcn-io/copy-button";
import "../../styles/markdown.css";


function MarkdownComponent({ msg }: { msg: any }) {
    return (
        <>
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[rehypeHighlight, rehypeRaw]}
                components={{
                    table({ node, ...props }) {
                        return (
                            <div style={{ overflowX: "auto", maxWidth: "100%" }}>
                                <table {...props} className="markdown-table" />
                            </div>
                        );
                    },
                    code({ node, className, children, ...props }) {
                        const match = /language-(\w+)/.exec(className || "");
                        const lang = match ? match[1] : null;
                        const getText = (nodes: React.ReactNode): string => {
                            return React.Children.toArray(nodes)
                                .map((child) => {
                                    if (React.isValidElement(child) && "props" in child) {
                                        return getText((child as any).props.children);
                                    }
                                    return typeof child === "string" ? child : "";
                                })
                                .join("");
                        };

                        const getExtension = (language: string | null): { extension: string; langMap: { [key: string]: { extension: string, color?: string } } } => {
                            const langMap: { [key: string]: { extension: string, color?: string } } = {
                                javascript: { extension: "js", color: "#f1e05a" },
                                typescript: { extension: "ts", color: "#3178c6" },
                                python: { extension: "py", color: "#3572A5" },
                                java: { extension: "java", color: "#b07219" },
                                cpp: { extension: "cpp", color: "#f34b7d" },
                                csharp: { extension: "cs", color: "#178600" },
                                ruby: { extension: "rb", color: "#701516" },
                                php: { extension: "php", color: "#4F5D95" },
                                go: { extension: "go", color: "#00ADD8" },
                                swift: { extension: "swift", color: "#F05138" },
                                kotlin: { extension: "kt", color: "#A97BFF" },
                                rust: { extension: "rs", color: "#DEA584" },
                                html: { extension: "html", color: "#e34c26" },
                                css: { extension: "css", color: "#563d7c" },
                                bash: { extension: "sh", color: "#89e051" },
                                shell: { extension: "sh", color: "#89e051" },
                                json: { extension: "json", color: "#292929" },
                                xml: { extension: "xml", color: "#0060ac" },
                                yaml: { extension: "yaml", color: "#cb171e" },
                                markdown: { extension: "md", color: "#083fa1" },
                                plaintext: { extension: "txt", color: "#333333" },
                            };

                            if (!language) return { extension: "txt", langMap };
                            return { extension: langMap[language.toLowerCase()]?.extension || language, langMap }
                        }

                        const handleDownload = () => {
                            const text = getText(children);
                            const blob = new Blob([text], { type: "text/plain" });
                            const url = URL.createObjectURL(blob);
                            const link = document.createElement("a");
                            link.href = url;
                            link.download = `code.${getExtension(lang).extension}`;
                            link.click();
                            URL.revokeObjectURL(url);
                        };
                        return (
                            <>
                                {lang && (
                                    <div
                                        className="flex items-center justify-between border-b pb-3 text-xs  text-muted mb-1">
                                        <span
                                            className={`px-3 py-1 flex gap-2 bg-muted items-center text-foreground border-muted border-2   rounded-full`}>

                                            <Code2 size={15} /> {lang.toUpperCase()}
                                        </span>
                                        <div className="space-x-4">
                                            {
                                                getExtension(lang).langMap.hasOwnProperty(lang.toLowerCase()) && (
                                                    <button
                                                        title="Download"
                                                        onClick={handleDownload}
                                                        className="p-1 text-muted-foreground hover:text-muted-foreground cursor-pointer"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                    </button>
                                                )
                                            }

                                            <CopyButton content={getText(children)} variant={"default"} className="size-7 bg-transparent text-muted-foreground hover:bg-muted-foreground/10 rounded p-1 cursor-pointer" />
                                        </div>
                                    </div>
                                )}
                                <code style={{ whiteSpace: "pre-wrap" }} className={className} {...props}>
                                    {children}
                                </code>
                            </>
                        );
                    },
                }}
            >
                {msg.content}

            </ReactMarkdown>
        </>
    )
}

export default MarkdownComponent
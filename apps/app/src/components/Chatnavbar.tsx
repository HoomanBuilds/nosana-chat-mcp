"use client"

import React from 'react'
import { Button } from './ui/button'
import { ArrowRightFromLine, Download, LayoutGrid } from 'lucide-react'
import { useChatStore } from '@/store/chat.store'
import { useSettingsStore } from '@/store/setting.store'
import { cn } from '@/lib/utils'
import { TemplatePopUP } from './TemplatePop'

interface ChatNavBarProps {
    className?: string;
    onTemplateSelect?: (jobDefinition: Record<string, any>) => void;
}

function ChatNavBar({ className, onTemplateSelect }: ChatNavBarProps) {
    const { selectedChatId, exportThread, currentChat, tool } = useChatStore()
    const { toggleMobile, toggleTemplate, templateOpen } = useSettingsStore()

    return (
        <>
            <div
                className={cn(
                    "sticky top-0 z-30 flex h-14 w-full items-center justify-between border-b border-dashed bg-background/85 px-3 py-2 text-start backdrop-blur lg:justify-end",
                    className
                )}
            >
                <button
                    onClick={() => toggleMobile()}
                    type="button"
                    className="rounded-md p-2 transition-colors hover:bg-muted-foreground/10 lg:hidden"
                >
                    <ArrowRightFromLine className={cn("cursor-pointer text-muted-foreground")} />
                </button>

                <div className='flex items-center gap-2 sm:gap-5'>
                    {tool == "deployer" && (
                        <button
                            onClick={() => toggleTemplate()}
                            type="button"
                            aria-label="Toggle deployment templates"
                            className="rounded-md p-2 transition-colors hover:bg-muted-foreground/10"
                        >
                            <LayoutGrid className='text-green-500' />
                        </button>
                    )}

                    {currentChat.length > 0 && <Button
                        title="Export chat"
                        onClick={() => selectedChatId && currentChat?.length > 0 && exportThread(selectedChatId)}
                        className="h-9 bg-green-500 text-sm cursor-pointer items-center hover:bg-green-400 sm:scale-90"><span className="hidden xl:block">export </span> <Download />
                    </Button>}
                </div>
            </div>

            {templateOpen && onTemplateSelect && (
                <TemplatePopUP
                    toggleTemplate={toggleTemplate}
                    onSelectTemplate={onTemplateSelect}
                />
            )}
        </>
    )
}

export default ChatNavBar

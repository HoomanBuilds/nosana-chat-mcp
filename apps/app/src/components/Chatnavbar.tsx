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
                    "border-dashed flex h-14 justify-between items-center border-b bg-transparent cursor-pointer text-start px-3 z-40 w-full py-2",
                    className
                )}
            >
                <button onClick={() => toggleMobile()}>
                    <ArrowRightFromLine className={cn("cursor-pointer lg:hidden text-muted-foreground")} />
                </button>

                <div className='flex items-center gap-5'>
                    {tool == "deployer" && (
                        <button
                            onClick={() => toggleTemplate()}
                            aria-label="Toggle deployment templates"
                            className="p-1 hover:bg-muted-foreground/10 rounded transition-colors"
                        >
                            <LayoutGrid className='text-green-500' />
                        </button>
                    )}

                    {currentChat.length > 0 && <Button
                        title="Export chat"
                        onClick={() => selectedChatId && currentChat?.length > 0 && exportThread(selectedChatId)}
                        className="scale-90 bg-green-500 items-center text-sm cursor-pointer hover:bg-green-400"><span className="xl:block hidden">export </span> <Download />
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
"use client";

import React, { useEffect, useState, useMemo } from "react";
import { redirect } from "next/navigation";
import { useChatStore } from "@/store/chat.store";
import { useShallow } from "zustand/shallow";
import { useRouter } from "next/navigation";
import { LoginDropDown } from "./SettingDropdown";
import { Button } from "./ui/button";
import SearchPopup from "./SearchPopup";
import { cn } from "@/lib/utils";
import { useSettingsStore } from "@/store/setting.store";
import { TemplatePopUP } from "./TemplatePop";
import CurrentChatSection from "./sidebar/CurrentChat";
import SidebarActions from "./sidebar/SidebarActions";
import SidebarHeader from "./sidebar/SidebarHeader";
import ChatListItem from "./sidebar/ChatListItem";
import { Rocket } from "lucide-react";

interface SideBarProps {
  onTemplateSelect?: (jobDefinition: Record<string, any>) => void;
}

export default function SideBar({ onTemplateSelect }: SideBarProps) {
  const router = useRouter();
  const {
    loadChatHistory,
    chatHistory,
    deletethread,
    selectedChatId,
    exportThread,
    updateThreadTitle,
  } = useChatStore(
    useShallow((state) => ({
      loadChatHistory: state.loadChatHistory,
      chatHistory: state.chatHistory,
      deletethread: state.deletethread,
      selectedChatId: state.selectedChatId,
      exportThread: state.exportThread,
      updateThreadTitle: state.updateThreadTitle,
    })),
  );
  const { mobileOpen, toggleMobile, toggleTemplate, templateOpen } =
    useSettingsStore(
      useShallow((state) => ({
        mobileOpen: state.mobileOpen,
        toggleMobile: state.toggleMobile,
        toggleTemplate: state.toggleTemplate,
        templateOpen: state.templateOpen,
      })),
    );
  const [barOpen, setBarOpen] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState<string>("");
  const [popupOpen, setPopupOpen] = useState(false);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    loadChatHistory().catch(console.error);
  }, [loadChatHistory]);

  useEffect(() => {
    setHeight(window.innerHeight);
    const handleResize = () => setHeight(window.innerHeight);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleOldChat = (id: string) => {
    useChatStore.getState().setSelectedChatId(id);
    const chat = chatHistory.find((c) => c.thread_id === id);
    const toolParam = chat?.tool === "deployer" ? "?tool=deployer" : "";
    router.push(`/ask/${id}${toolParam}`);
    if (mobileOpen) toggleMobile();
  };

  const handleDelete = (id: string) => {
    deletethread(id)
      .then(() => {
        const { selectedChatId, setSelectedChatId } = useChatStore.getState();
        if (selectedChatId === id) {
          setSelectedChatId(null);
          router.push("/ask");
        }
      })
      .catch(console.error);
  };

  const handleExport = (id: string) => {
    exportThread(id).catch(console.error);
  };

  const handleNewChat = () => {
    if (mobileOpen) toggleMobile();
    redirect("/ask");
  };

  const handleEditSave = (id: string, title: string) => {
    updateThreadTitle(id, title);
    setEditingId(null);
  };

  const handleEditCancel = () => {
    setEditingId(null);
  };

  const getTimeLabel = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffDays = Math.floor(
      (now.setHours(0, 0, 0, 0) - date.setHours(0, 0, 0, 0)) /
        (24 * 60 * 60 * 1000),
    );

    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Yesterday";
    if (diffDays < 7) return "Last Week";
    return "Last Month";
  };

  const groupedChats = useMemo(() => {
    const groups: Record<string, typeof chatHistory> = {};
    [...chatHistory]
      .sort((a, b) => Number(b.thread_id) - Number(a.thread_id))
      .forEach((item) => {
        const label = getTimeLabel(Number(item.thread_id));
        if (!groups[label]) groups[label] = [];
        groups[label].push(item);
      });
    return groups;
  }, [chatHistory]);

  return (
    <>
      <div
        id="sidebar-container"
        className={cn(
          "flex flex-col justify-between h-full bg-muted text-muted-foreground border-r border-muted-foreground/10",
          "transition-[width,opacity] duration-300 ease-in-out lg:relative",
          mobileOpen ? "fixed top-0 left-0 z-50 shadow-lg" : "hidden lg:flex",
          barOpen ? "w-[260px] opacity-100" : "w-[60px] opacity-90",
        )}
        style={{ height: height ? `${height}px` : undefined }}
      >
        <div className="py-4 px-3 flex flex-col gap-4">
          <SidebarHeader
            barOpen={barOpen}
            setBarOpen={setBarOpen}
            toggleMobile={toggleMobile}
            router={router}
          />
          <SidebarActions
            barOpen={barOpen}
            setBarOpen={setBarOpen}
            setPopupOpen={setPopupOpen}
            handleNewChat={handleNewChat}
          />
        </div>

        {barOpen && (
          <div className="px-3">
            <Button
              onClick={() => router.push("/ask?tool=deployer")}
              className="w-full rounded mb-2 border  text-green-950 border-muted-foreground bg-green-500 hover:bg-green-600 cursor-pointer"
            >
              nosana deployer
              <Rocket className="text-green-800" />
            </Button>
          </div>
        )}

        <CurrentChatSection
          barOpen={barOpen}
          selectedChatId={selectedChatId}
          chatHistory={chatHistory}
          onExport={handleExport}
          onDelete={handleDelete}
          setEditingId={setEditingId}
          setEditContent={setEditContent}
        />

        <div
          hidden={!barOpen}
          className="flex-1 overflow-y-auto scrollbar-hide px-3 
                        [&::-webkit-scrollbar]:hidden [&::-webkit-scrollbar-thumb]:hidden 
                        [&::-webkit-scrollbar-track]:hidden [scrollbar-width:none]"
        >
          {Object.entries(groupedChats).map(([label, items]) => (
            <div key={label} className="mb-4">
              <div className="text-muted-foreground/40 text-xs mb-2">
                {label}
              </div>
              {items.map((item) => (
                <ChatListItem
                  key={item.thread_id}
                  item={item}
                  isSelected={selectedChatId === item.thread_id}
                  onChatClick={handleOldChat}
                  editingId={editingId}
                  editContent={editContent}
                  onEditSave={handleEditSave}
                  onEditCancel={handleEditCancel}
                  onEditStart={setEditingId}
                  setEditContent={setEditContent}
                  onExport={handleExport}
                  onRename={updateThreadTitle}
                  onDelete={handleDelete}
                  barOpen={barOpen}
                />
              ))}
            </div>
          ))}
        </div>

        {popupOpen && (
          <SearchPopup setPopupOpen={setPopupOpen} chatHistory={chatHistory} />
        )}
        {templateOpen && onTemplateSelect && (
          <TemplatePopUP
            toggleTemplate={toggleTemplate}
            onSelectTemplate={onTemplateSelect}
          />
        )}

        <div className="p-3">
          <LoginDropDown barOpen={barOpen} router={router} />
        </div>
      </div>
    </>
  );
}

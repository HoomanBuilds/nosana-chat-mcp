import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Conversation, useChatStore } from "@/store/chat.store";

export const useConversations = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentChat = useChatStore(state => state.currentChat);



  return { conversations: currentChat, scrollRef };
};

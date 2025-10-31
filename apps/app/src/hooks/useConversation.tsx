import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { Conversation, useChatStore } from "@/store/chat.store";

export const useConversations = () => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const currentChat = useChatStore(state => state.currentChat);

  useEffect(() => {
    setConversations(currentChat);
  }, [currentChat]);

  // Use useLayoutEffect to scroll after DOM updates
  useLayoutEffect(() => {
    if (conversations.length > 0 && scrollRef.current) {
      // Use requestAnimationFrame to ensure scroll happens after layout is complete
      requestAnimationFrame(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTo({
            top: scrollRef.current.scrollHeight,
            behavior: "smooth",
          });
        }
      });
    }
  }, [conversations]);

  return { conversations, scrollRef };
};

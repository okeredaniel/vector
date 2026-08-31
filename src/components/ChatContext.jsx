import { createContext, useContext, useState, useCallback } from "react";

const ChatContext = createContext(null);

function makeMessageId() {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function ChatProvider({ children }) {
  const [messages, setMessages] = useState([]);

  // NOTE: this is a best-guess reconstruction — I never saw your real
  // ChatContext.jsx, so merge this with whatever else it already does
  // (API calls, streaming assistant replies, etc.) rather than replacing it wholesale.
  //
  // `attachments` is a new second param: the array built in ChatTab.jsx
  // (kind: "text" | "image" | "file"). It's stored on the message object
  // as-is so the bubble can render the same chip UI the composer uses.
  const sendMessage = useCallback((text, attachments = []) => {
    const userMessage = {
      id: makeMessageId(),
      sender: "user",
      text: text?.trim() || "",
      attachments,
    };

    setMessages((prev) => [...prev, userMessage]);

    // TODO: wire this up to your actual backend/agent call.
    // If attachments include real File objects (images/pdfs), you'll want to
    // upload them here (e.g. FormData) rather than just holding the in-memory
    // File reference, since that won't survive a refresh or be sendable as JSON.
  }, []);

  return (
    <ChatContext.Provider value={{ messages, sendMessage }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used within a ChatProvider");
  return ctx;
}
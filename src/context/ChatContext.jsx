import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { getStatusForStep } from "./agentStatus.js";
import { supabase } from "./supabaseClient.js";

const ChatContext = createContext(null);

const RENDER_BASE = "https://vector-backend-8neo.onrender.com";
const LOCAL_BASE = import.meta.env.VITE_LOCAL_API_URL || "http://localhost:8000";
const LOCAL_ONLY_AGENTS = ["ollama", "ollama_local", "github"];
const FALLBACK_CHAIN = [
  "dev", "siliconflow", "openrouter", "zai", "mistral",
  "cohere", "nvidia", "huggingface", "gemini_research",
];
const LAST_ACTIVE_SESSION_KEY = "vector_last_active_session";

function getBaseForAgent(agentId) {
  return LOCAL_ONLY_AGENTS.includes(agentId) ? LOCAL_BASE : RENDER_BASE;
}

function buildTaskText(text, attachments) {
  const textBlocks = (attachments || [])
    .filter((a) => a.kind === "text")
    .map((a) => a.text);

  if (textBlocks.length === 0) return text;

  const combined = textBlocks.join("\n\n");
  return text ? `${text}\n\n${combined}` : combined;
}

async function runAgent(agentId, task, requestId, signal, imageUrls) {
  const base = getBaseForAgent(agentId);
  let url = `${base}/agents/${agentId}/run?task=${encodeURIComponent(task)}&request_id=${encodeURIComponent(requestId)}`;
  if (imageUrls && imageUrls.length > 0) {
    url += `&images=${encodeURIComponent(imageUrls.join(","))}`;
  }
  const res = await fetch(url, { method: "POST", signal });

  if (!res.ok) {
    throw new Error(`Agent request failed (${res.status})`);
  }

  const data = await res.json();
  return data.result ?? "No response from agent.";
}

async function runWithFallback(agentId, task, requestId, signal) {
  const priority = [agentId, ...FALLBACK_CHAIN.filter((id) => id !== agentId)];
  const url = `${RENDER_BASE}/run-with-fallback?task=${encodeURIComponent(task)}&agents=${encodeURIComponent(priority.join(","))}&request_id=${encodeURIComponent(requestId)}`;
  const res = await fetch(url, { method: "POST", signal });

  if (!res.ok) {
    throw new Error(`Fallback request failed (${res.status})`);
  }

  const data = await res.json();
  if (!data.result || data.agent_used === null) {
    throw new Error("All agents in the fallback chain failed.");
  }
  return data.result;
}

async function uploadFile(base, file) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${base}/uploads`, { method: "POST", body: formData });
  if (!res.ok) {
    throw new Error(`File upload failed (${res.status})`);
  }
  return res.json(); // { file_id, url, original_name, content_type }
}

function makeTitle(text, attachments) {
  const source = (text || attachments?.[0]?.name || "New chat").trim();
  return source.length > 30 ? source.slice(0, 30) + "..." : source;
}

function makeEmptySession() {
  const id = crypto.randomUUID();
  return {
    id,
    title: "New chat",
    messages: [],
    createdAt: Date.now(),
    messagesLoaded: true,
  };
}

function toRow(sessionId, message) {
  return {
    id: message.id,
    session_id: sessionId,
    sender: message.sender,
    text: message.text,
    attachments: message.attachments || [],
    status: message.status,
    time: message.time,
    done_time: message.doneTime ?? null,
  };
}

function fromRow(row) {
  return {
    id: row.id,
    sender: row.sender,
    text: row.text,
    attachments: row.attachments || [],
    status: row.status,
    time: row.time,
    doneTime: row.done_time ?? null,
    steps: [],
  };
}

function getLastActiveSessionId() {
  try {
    return localStorage.getItem(LAST_ACTIVE_SESSION_KEY);
  } catch {
    return null;
  }
}

function setLastActiveSessionId(sessionId) {
  try {
    if (sessionId) {
      localStorage.setItem(LAST_ACTIVE_SESSION_KEY, sessionId);
    } else {
      localStorage.removeItem(LAST_ACTIVE_SESSION_KEY);
    }
  } catch {}
}

function sortSessions(sessionsObj) {
  return Object.values(sessionsObj).sort((a, b) => {
    if (!!b.pinned !== !!a.pinned) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
    return b.createdAt - a.createdAt;
  });
}

export function ChatProvider({ children }) {
  const [sessions, setSessions] = useState({});
  const [activeSessionId, setActiveSessionId] = useState(null);
  const [isSending, setIsSending] = useState(false);
  // `loaded` distinguishes "still fetching history from Supabase" from
  // "genuinely empty new chat" — consumed by ChatTab to show a loader.
  const [loaded, setLoaded] = useState(false);
  const [permissionRequest, setPermissionRequest] = useState(null);

  const pendingByRequestId = useRef(new Map());
  const socketsRef = useRef(new Map());
  const seenStepsRef = useRef(new Set());
  const activeControllerRef = useRef(null);
  // Tracks which sessions have been deleted, so an in-flight message's
  // eventual persistSession() call (fired after you already deleted the
  // chat) doesn't resurrect the row in Supabase.
  const deletedSessionIds = useRef(new Set());
  const draftsRef = useRef(new Map());
  const freshlyCompletedIds = useRef(new Set());

  const getDraft = useCallback((sessionId) => {
    return draftsRef.current.get(sessionId) || "";
  }, []);

  const consumeFreshFlag = useCallback((messageId) => {
    const wasFresh = freshlyCompletedIds.current.has(messageId);
    freshlyCompletedIds.current.delete(messageId); // one-time — never animate the same message twice
    return wasFresh;
  }, []);

  const setDraft = useCallback((sessionId, text) => {
    if (!sessionId) return;
    if (!text) {
      draftsRef.current.delete(sessionId);
    } else {
      draftsRef.current.set(sessionId, text);
    }
  }, []);

  // Load only the session list + the active session's messages on mount.
  // Every other session's messages are fetched lazily the first time the
  // user clicks into that chat (see switchChat) — this is what makes
  // startup fast even with a lot of history.
  useEffect(() => {
    (async () => {
      const { data: sessionRows, error: sessionErr } = await supabase
        .from("chat_sessions")
        .select("*")
        .order("created_at", { ascending: false });

      if (sessionErr || !sessionRows || sessionRows.length === 0) {
        const fresh = makeEmptySession();
        setSessions({ [fresh.id]: fresh });
        setActiveSessionId(fresh.id);
        setLastActiveSessionId(fresh.id);
        setLoaded(true);
        return;
      }

      // Session skeletons only — no messages yet. Cheap and fast.
      const grouped = {};
      for (const row of sessionRows) {
        grouped[row.id] = {
          id: row.id,
          title: row.title,
          pinned: row.pinned || false,
          createdAt: new Date(row.created_at).getTime(),
          messages: [],
          messagesLoaded: false, // tracks whether we've fetched this one yet
        };
      }

      const sorted = sortSessions(grouped);
      const lastActiveId = getLastActiveSessionId();
      const initialActive = (lastActiveId && grouped[lastActiveId])
        ? lastActiveId
        : (sorted[0]?.id ?? null);

      // Only load the active session's messages up front.
      if (initialActive) {
        const { data: activeMessageRows } = await supabase
          .from("chat_messages")
          .select("*")
          .eq("session_id", initialActive)
          .order("time", { ascending: true });

        grouped[initialActive].messages = (activeMessageRows || []).map(fromRow);
        grouped[initialActive].messagesLoaded = true;
      }

      setSessions(grouped);
      setActiveSessionId(initialActive);
      setLastActiveSessionId(initialActive);
      setLoaded(true);
    })();
  }, []);

  const persistSession = useCallback(async (sessionId, title, messagesToSave, createdAt) => {
    if (deletedSessionIds.current.has(sessionId)) return;

    const sessionRow = { id: sessionId, title };
    if (createdAt) {
      sessionRow.created_at = new Date(createdAt).toISOString();
    }

    const { error: sessionError } = await supabase
      .from("chat_sessions")
      .upsert(sessionRow);
    if (sessionError) {
      console.error("[chat] failed to save session:", sessionError);
      return;
    }

    if (messagesToSave && messagesToSave.length > 0) {
      const { error: msgError } = await supabase
        .from("chat_messages")
        .upsert(messagesToSave.map((m) => toRow(sessionId, m)));
      if (msgError) {
        console.error("[chat] failed to save messages:", msgError);
      }
    }
  }, []);

  const updateMessage = useCallback((sessionId, messageId, updater) => {
    setSessions((prev) => {
      const session = prev[sessionId];
      if (!session) return prev;
      return {
        ...prev,
        [sessionId]: {
          ...session,
          messages: session.messages.map((m) =>
            m.id === messageId ? updater(m) : m,
          ),
        },
      };
    });
  }, []);

    const respondToPermission = useCallback((decision) => {
    setPermissionRequest((current) => {
      if (!current) return current;
      const ws = socketsRef.current.get(current.base);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({
          type: "permission_response",
          request_id: current.request_id,
          decision, // "allow_once" | "allow_forever" | "deny"
        }));
      } else {
        console.error("[permission] socket not open, could not send response");
      }
      return null;
    });
  }, []);

  const getOrConnectSocket = useCallback((base, { allowRetry }) => {
    const existing = socketsRef.current.get(base);
    if (existing && existing.readyState <= WebSocket.OPEN) {
      return existing;
    }

    const wsBase = base.replace(/^http/, "ws");
    const ws = new WebSocket(`${wsBase}/ws`);
    socketsRef.current.set(base, ws);

    ws.onopen = () => console.log("[ws] connected to", wsBase);

    ws.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch {
        return;
      }

      console.log("[ws] received:", data);

      if (data.type === "permission_request") {
        // Track which base this request came from so we reply on the
        // same socket — permission_broker's _pending map lives in that
        // specific backend process's memory.
        setPermissionRequest({ ...data, base });
        return;
      }

if (data.type === "agent_step" && data.step_type === "stream_delta" && data.request_id) {
  const pending = pendingByRequestId.current.get(data.request_id);
  if (pending) {
    updateMessage(pending.sessionId, pending.messageId, (m) => ({
      ...m,
      text: (m.text || "") + data.content,
    }));
  }
  return;
}
      const pending = pendingByRequestId.current.get(data.request_id);
      if (!pending) return;

      // Deduplicate steps from overlapping sockets using a stable key
      const stepKey = `${data.request_id}:${data.step_type}:${data.content || ""}:${data.tool || ""}:${JSON.stringify(data.args || {})}`;
      if (seenStepsRef.current.has(stepKey)) {
        console.debug("[ws] duplicate step ignored", stepKey);
        return; // duplicate broadcast from an overlapping socket - ignore it
      }
      seenStepsRef.current.add(stepKey);

      const status = getStatusForStep(data);

      updateMessage(pending.sessionId, pending.messageId, (m) => ({
        ...m,
        steps: [...(m.steps || []), data],
        statusLabel: status.label,
        statusIcon: status.icon,
      }));
    };

    ws.onclose = () => {
      socketsRef.current.delete(base);
      if (allowRetry) {
        setTimeout(() => getOrConnectSocket(base, { allowRetry }), 3000);
      }
    };

    ws.onerror = () => {
      ws.close();
    };

    return ws;
  }, [updateMessage]);

  useEffect(() => {
    getOrConnectSocket(RENDER_BASE, { allowRetry: true });
    return () => {
      socketsRef.current.forEach((ws) => ws.close());
      socketsRef.current.clear();
    };
  }, [getOrConnectSocket]);

  const sendMessage = useCallback((text, attachments = [], agentId = "dev", useFallback = false) => {
    let sessionId = activeSessionId;
    if (!sessionId) {
      const fresh = makeEmptySession();
      sessionId = fresh.id;
      setSessions((prev) => ({ ...prev, [fresh.id]: fresh }));
      setActiveSessionId(fresh.id);
      setLastActiveSessionId(fresh.id);
    }

    setDraft(sessionId, "");

    const userMessage = {
      id: crypto.randomUUID(),
      sender: "user",
      text,
      attachments,
      time: Date.now(),
    };

    const requestId = crypto.randomUUID();
    const pendingId = crypto.randomUUID();
    const pendingMessage = {
      id: pendingId,
      sender: "assistant",
      text: "",
      attachments: [],
      time: userMessage.time + 1, 
      status: "pending",
      requestId,
      steps: [],
      statusLabel: "Contemplating",
      statusIcon: "sparkle",
    };

    pendingByRequestId.current.set(requestId, { sessionId, messageId: pendingId });

    let sessionTitle = "";
    const bumpedAt = Date.now();
    setSessions((prev) => {
      const session = prev[sessionId];
      if (!session) return prev;
      const isFirstMessage = session.messages.length === 0;
      sessionTitle = isFirstMessage ? makeTitle(text, attachments) : session.title;
      return {
        ...prev,
        [sessionId]: {
          ...session,
          title: sessionTitle,
          createdAt: bumpedAt,
          messages: [...session.messages, userMessage, pendingMessage],
        },
      };
    });
    setIsSending(true);

    // Persist session and bump its created_at so it moves to top of recents
    persistSession(sessionId, sessionTitle, [userMessage], bumpedAt);

    const base = getBaseForAgent(agentId);
    if (base === LOCAL_BASE) {
      getOrConnectSocket(LOCAL_BASE, { allowRetry: false });
    }

    const session = sessions[sessionId];
    const priorMessages = (session?.messages || []).filter(
      (m) => m.status !== "pending" && m.text
    );

    let contextBlock = "";
    if (priorMessages.length > 0) {
      const recent = priorMessages.slice(-10); // last 10 messages, tune as needed
      contextBlock = recent
        .map((m) => `${m.sender === "user" ? "User" : "Assistant"}: ${m.text}`)
        .join("\n");
    }

        const MAX_UPLOAD_BYTES = 50 * 1024 * 1024; // 50MB

    const rawTaskText = buildTaskText(text, attachments);
    const fileAttachments = (attachments || []).filter((a) => a.kind !== "text");
    const oversizedFiles = fileAttachments.filter((a) => a.file && a.file.size > MAX_UPLOAD_BYTES);
    const validFileAttachments = fileAttachments.filter((a) => !a.file || a.file.size <= MAX_UPLOAD_BYTES);

    (async () => {
      let uploadedRefs = [];
      if (validFileAttachments.length > 0) {
        try {
          uploadedRefs = await Promise.all(
            validFileAttachments.map((a) => uploadFile(base, a.file))
          );
        } catch (err) {
          console.error("[upload] failed:", err);
          // fall through with whatever succeeded / empty — don't block sending text
        }
      }

      const oversizeNote = oversizedFiles.length > 0
        ? `\n\n[Note: ${oversizedFiles.map((f) => f.name).join(", ")} ${oversizedFiles.length > 1 ? "were" : "was"} too large to upload (over 50MB) and ${oversizedFiles.length > 1 ? "were" : "was"} skipped.]`
        : "";

      const fileNote = uploadedRefs.length > 0
        ? `\n\nAttached files:\n${uploadedRefs.map((f) => {
            if (f.extracted_text) {
              return `- ${f.original_name}:\n${f.extracted_text}`;
            }
            return `- ${f.original_name} (${f.url})`;
          }).join("\n\n")}`
        : "";

      // Images get sent as real image content to vision-capable agents,
      // separate from the text-note fallback above. Always build the URL
      // from RENDER_BASE (not `base`) since cloud providers like Mistral's
      // Pixtral need a URL they can actually fetch over the internet —
      // a localhost URL means nothing to their servers.
      const imageUrls = uploadedRefs
        .filter((f) => f.content_type && f.content_type.startsWith("image/"))
        .map((f) => f.url);

      const taskText = contextBlock
        ? `Conversation so far:\n${contextBlock}\n\nNew message: ${rawTaskText}${fileNote}${oversizeNote}`
        : `${rawTaskText}${fileNote}${oversizeNote}`;

      const controller = new AbortController();
      activeControllerRef.current = controller;

      // Note: image support currently only flows through runAgent (a
      // single specific agent). runWithFallback doesn't accept images yet —
      // that's a separate follow-up if vision needs to work through the
      // fallback chain too.
      const runner = useFallback
        ? runWithFallback(agentId, taskText, requestId, controller.signal)
        : runAgent(agentId, taskText, requestId, controller.signal, imageUrls);

      runner
        .then((resultText) => {
          const finalMessage = { ...pendingMessage, text: resultText, status: "done", doneTime: Date.now() };
          freshlyCompletedIds.current.add(pendingId); // ← add this
          updateMessage(sessionId, pendingId, () => finalMessage);
          persistSession(sessionId, sessionTitle, [finalMessage]);
        })
        .catch((err) => {
          const wasAborted = err && err.name === "AbortError";
          const finalMessage = {
            ...pendingMessage,
            text: wasAborted ? "Stopped." : `Something went wrong: ${err.message}`,
            status: wasAborted ? "stopped" : "error",
            doneTime: Date.now(),
          };
          updateMessage(sessionId, pendingId, () => finalMessage);
          persistSession(sessionId, sessionTitle, [finalMessage]);
        })
        .finally(() => {
          pendingByRequestId.current.delete(requestId);
          activeControllerRef.current = null;
          // Clean up dedupe entries for this request now that it's done
          for (const key of [...seenStepsRef.current]) {
            if (key.startsWith(`${requestId}:`)) {
              seenStepsRef.current.delete(key);
            }
          }
          setIsSending(false);
        });
    })();
  }, [activeSessionId, sessions, getOrConnectSocket, updateMessage, persistSession, setDraft]);

  const startNewChat = useCallback(() => {
    const fresh = makeEmptySession();
    setSessions((prev) => ({ ...prev, [fresh.id]: fresh }));
    setActiveSessionId(fresh.id);
    setLastActiveSessionId(fresh.id);
  }, []);

  const editAndResend = useCallback((messageId, newText, agentId, useFallback = false) => {
    const sessionId = activeSessionId;
    const session = sessions[sessionId];
    if (!session) return;

    const msgIndex = session.messages.findIndex((m) => m.id === messageId);
    if (msgIndex === -1) return;

    const keptMessages = session.messages.slice(0, msgIndex);

    setSessions((prev) => ({
      ...prev,
      [sessionId]: { ...prev[sessionId], messages: keptMessages },
    }));

    setTimeout(() => sendMessage(newText, [], agentId, useFallback), 0);
  }, [activeSessionId, sessions, sendMessage]);

  // Switching chats is instant if that session's messages were already
  // fetched. Otherwise (a session sitting untouched since page load), it
  // fetches that one session's messages on demand, right when clicked.
  const switchChat = useCallback(async (sessionId) => {
    const target = sessions[sessionId];
    if (!target) return;

    setActiveSessionId(sessionId);
    setLastActiveSessionId(sessionId);

    if (target.messagesLoaded) return; // already fetched — nothing more to do

    const { data: messageRows, error } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("session_id", sessionId)
      .order("time", { ascending: true });

    if (error) {
      console.error("[chat] failed to load messages for session:", error);
      return;
    }

    setSessions((prev) => {
      const current = prev[sessionId];
      if (!current) return prev;
      return {
        ...prev,
        [sessionId]: {
          ...current,
          messages: (messageRows || []).map(fromRow),
          messagesLoaded: true,
        },
      };
    });
  }, [sessions]);

  // Duplicate an existing session into a brand new session so the user can
  // continue chatting on it and have that new session persisted independently.
  const duplicateSession = useCallback(async (sourceSessionId) => {
    const source = sessions[sourceSessionId];
    if (!source) return null;

    // If this session was never opened, its messages haven't been fetched
    // yet (lazy-loading) — pull them from Supabase first so we don't
    // duplicate an empty chat.
    let sourceMessages = source.messages;
    if (!source.messagesLoaded) {
      const { data: messageRows, error } = await supabase
        .from("chat_messages")
        .select("*")
        .eq("session_id", sourceSessionId)
        .order("time", { ascending: true });

      if (error) {
        console.error("[chat] failed to load messages before duplicating:", error);
      }
      sourceMessages = (messageRows || []).map(fromRow);
    }

    const newId = crypto.randomUUID();
    const copiedMessages = sourceMessages.map((m) => ({ ...m, id: crypto.randomUUID() }));
    // Preserve the source session's createdAt so the duplicate doesn't jump to the top
    const newCreatedAt = source.createdAt || Date.now();

    const newSession = {
      id: newId,
      title: source.title || "New chat",
      createdAt: newCreatedAt,
      messages: copiedMessages,
      messagesLoaded: true,
    };

    // Add to local state and activate
    setSessions((prev) => ({ ...prev, [newId]: newSession }));
    setActiveSessionId(newId);
    setLastActiveSessionId(newId);

    // Persist session row and messages so it survives reloads
    try {
      await persistSession(newId, newSession.title, copiedMessages, newCreatedAt);
    } catch (err) {
      console.error("[chat] failed to persist duplicated session:", err);
    }

    return newId;
  }, [sessions, persistSession]);

  const regenerate = useCallback((messageId, agentId, useFallback = false) => {
    const sessionId = activeSessionId;
    const session = sessions[sessionId];
    if (!session) return;

    const msgIndex = session.messages.findIndex((m) => m.id === messageId);
    if (msgIndex <= 0) return;

    const priorUserMsg = session.messages[msgIndex - 1];
    if (!priorUserMsg || priorUserMsg.sender !== "user") return;

    const keptMessages = session.messages.slice(0, msgIndex - 1);
    setSessions((prev) => ({
      ...prev,
      [sessionId]: { ...prev[sessionId], messages: keptMessages },
    }));

    setTimeout(() => sendMessage(priorUserMsg.text, priorUserMsg.attachments || [], agentId, useFallback), 0);
  }, [activeSessionId, sessions, sendMessage]);

  const searchHistory = useCallback((query) => {
    const q = query.trim().toLowerCase();
    if (!q) return [];

    const results = [];
    for (const session of Object.values(sessions)) {
      for (const msg of session.messages) {
        if (msg.text && msg.text.toLowerCase().includes(q)) {
          results.push({
            sessionId: session.id,
            sessionTitle: session.title,
            messageId: msg.id,
            snippet: msg.text.slice(0, 100),
          });
        }
      }
    }
    return results;
  }, [sessions]);

  const togglePin = useCallback((sessionId) => {
    setSessions((prev) => {
      const s = prev[sessionId];
      if (!s) return prev;
      const updated = { ...s, pinned: !s.pinned };
      // Persist the pinned flag directly — persistSession doesn't include pinned in its payload
      supabase.from("chat_sessions").upsert({ id: sessionId, title: s.title, pinned: updated.pinned });
      return { ...prev, [sessionId]: updated };
    });
  }, []);

  const deleteChat = useCallback(async (sessionId) => {
    deletedSessionIds.current.add(sessionId);

    // Delete messages first (belt-and-suspenders alongside the FK's ON
    // DELETE CASCADE), then the session row itself. Both are awaited and
    // checked - a silently-swallowed error here was the previous bug:
    // the chat vanished from the UI but was never actually removed from
    // Supabase, so it reappeared on the next reload's fetch.
    const { error: msgError } = await supabase
      .from("chat_messages")
      .delete()
      .eq("session_id", sessionId);
    if (msgError) {
      console.error("[chat] failed to delete messages:", msgError);
    }

    const { error: sessionError } = await supabase
      .from("chat_sessions")
      .delete()
      .eq("id", sessionId);
    if (sessionError) {
      console.error("[chat] failed to delete session:", sessionError);
    }

    setSessions((prev) => {
      const remaining = { ...prev };
      delete remaining[sessionId];

      if (Object.keys(remaining).length === 0) {
        const fresh = makeEmptySession();
        remaining[fresh.id] = fresh;
        setActiveSessionId(fresh.id);
        setLastActiveSessionId(fresh.id);
        return remaining;
      }

      setActiveSessionId((current) => {
        if (current !== sessionId) return current;
        const nextId = Object.keys(remaining)[0];
        setLastActiveSessionId(nextId);
        return nextId;
      });

      return remaining;
    });
  }, []);

  const activeSession = activeSessionId ? sessions[activeSessionId] : null;
    // True once the active session's own messages have been fetched.
  // A session not yet clicked into has messagesLoaded === false, so this
  // lets ChatTab show a loading state instead of the "new chat" welcome
  // screen while messages are still on their way.
  const activeSessionLoaded = activeSession ? activeSession.messagesLoaded !== false : true;
  const sessionList = sortSessions(sessions);

  const stopSending = useCallback(() => {
    if (activeControllerRef.current) {
      activeControllerRef.current.abort();
    }
  }, []);

  return (
    <ChatContext.Provider
      value={{
        messages: activeSession ? activeSession.messages : [],
        sendMessage,
        stopSending,
        isSending,
        sessionList,
        activeSessionId,
        startNewChat,
        switchChat,
        deleteChat,
        duplicateSession,
        editAndResend,
        regenerate,
        searchHistory,
        togglePin,
        getDraft,
        setDraft,
        loaded,
        activeSessionLoaded,
        permissionRequest,  
        respondToPermission,  
                consumeFreshFlag, 
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error("useChat must be used inside a ChatProvider");
  return ctx;
}
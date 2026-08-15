import {
  ArrowUp,
  Bot,
  Check,
  ChevronDown,
  CircleUserRound,
  FileText,
  Menu,
  MessageSquarePlus,
  MoreHorizontal,
  Paperclip,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { api } from "./api";
import type { Conversation, MeResponse, Message } from "./types";

const starterPrompts = [
  { icon: FileText, title: "Write and improve", text: "Help me write a clear professional email" },
  { icon: Search, title: "Learn something", text: "Explain a difficult topic in simple terms" },
  { icon: FileText, title: "Summarize text", text: "Summarize this text into concise key points" },
  { icon: Sparkles, title: "Brainstorm", text: "Give me creative ideas for a new project" },
];

type PendingAttachment = {
  name: string;
  mimeType: string;
  dataUrl: string;
  size: number;
  purpose: "analyze" | "edit";
};

const acceptedAttachmentTypes = new Set([
  "image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf", "text/plain",
  "text/markdown", "text/csv", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
]);

function formatDate(value: string): string {
  const date = new Date(value);
  const now = new Date();
  return date.toDateString() === now.toDateString()
    ? "Today"
    : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export default function App() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [streamText, setStreamText] = useState("");
  const [sending, setSending] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [planOpen, setPlanOpen] = useState(false);
  const [mode, setMode] = useState<"fast" | "advanced">("fast");
  const [me, setMe] = useState<MeResponse>();
  const [error, setError] = useState<string>();
  const [purchasingPlan, setPurchasingPlan] = useState<"monthly" | "annual">();
  const [syncingStore, setSyncingStore] = useState(false);
  const [storeOpened, setStoreOpened] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [attachment, setAttachment] = useState<PendingAttachment>();

  const refreshConversations = useCallback(async () => {
    const result = await api.conversations();
    setConversations(result.conversations);
    return result.conversations;
  }, []);

  useEffect(() => {
    Promise.all([refreshConversations(), api.me()])
      .then(async ([items, profile]) => {
        setMe(profile);
        if (items[0]) setActiveId(items[0].id);
        if (window.microsoftStore?.getCollectionsId) {
          try {
            const ticket = await api.storeCollectionsTicket();
            const storeIdKey = await window.microsoftStore.getCollectionsId(
              ticket.serviceTicket,
              ticket.publisherUserId,
            );
            setMe(await api.verifyStoreSubscription(storeIdKey));
          } catch {
            // Store services are unavailable in development and for sideloaded builds.
          }
        }
      })
      .catch((cause: Error) => setError(cause.message));
  }, [refreshConversations]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }
    api.messages(activeId)
      .then((result) => setMessages(result.messages))
      .catch((cause: Error) => setError(cause.message));
  }, [activeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, streamText]);

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === activeId),
    [activeId, conversations],
  );

  async function newChat() {
    setError(undefined);
    const result = await api.createConversation();
    setConversations((current) => [result.conversation, ...current]);
    setActiveId(result.conversation.id);
    setMessages([]);
    setDraft("");
  }

  async function deleteChat(id: string) {
    await api.deleteConversation(id);
    const remaining = conversations.filter((item) => item.id !== id);
    setConversations(remaining);
    if (activeId === id) {
      setActiveId(remaining[0]?.id);
      setMessages([]);
    }
  }

  async function reportMessage(messageId: string) {
    const reason = window.prompt(
      "What is wrong with this response? Do not include personal or sensitive information.",
    );
    if (!reason?.trim()) return;
    try {
      await api.reportMessage(messageId, reason.trim());
      window.alert("Thank you. Your report was submitted for review.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not submit the report.");
    }
  }

  async function send(content = draft) {
    const clean = content.trim();
    if ((!clean && !attachment) || sending) return;
    setError(undefined);
    setSending(true);
    setDraft("");
    setStreamText("");

    try {
      let conversationId = activeId;
      if (!conversationId) {
        const created = await api.createConversation();
        conversationId = created.conversation.id;
        setActiveId(conversationId);
        setConversations((current) => [created.conversation, ...current]);
      }
      const userMessage: Message = {
        id: crypto.randomUUID(),
        conversationId,
        role: "user",
        content: attachment ? `${clean || "Please analyze this attachment."}\n\n📎 ${attachment.name}` : clean,
        createdAt: new Date().toISOString(),
      };
      setMessages((current) => [...current, userMessage]);

      await api.streamMessage(conversationId, clean, mode, attachment && {
        name: attachment.name,
        mimeType: attachment.mimeType,
        dataUrl: attachment.dataUrl,
        purpose: attachment.purpose,
      }, {
        onDelta: (text) => setStreamText((current) => current + text),
        onImage: () => undefined,
        onDone: (message) => {
          setMessages((current) => [...current, message]);
          setStreamText("");
        },
      });
      setAttachment(undefined);
      await Promise.all([refreshConversations(), api.me().then(setMe)]);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Something went wrong.");
    } finally {
      setSending(false);
    }
  }

  function chooseAttachment() {
    if (me?.plan.id === "free") {
      setPlanOpen(true);
      return;
    }
    fileInputRef.current?.click();
  }

  async function selectAttachment(file?: File) {
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setError("Attachments must be 5 MB or smaller.");
      return;
    }
    if (!acceptedAttachmentTypes.has(file.type)) {
      setError("Supported files: JPG, PNG, WEBP, GIF, PDF, TXT, Markdown, CSV, DOCX, XLSX, and PPTX.");
      return;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => reject(new Error("Could not read the selected file."));
      reader.readAsDataURL(file);
    });
    setAttachment({ name: file.name, mimeType: file.type, dataUrl, size: file.size, purpose: "analyze" });
    setError(undefined);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void send();
  }

  function changeMode() {
    if (!me?.plan.allowedModes.includes("advanced")) {
      setPlanOpen(true);
      return;
    }
    setMode((current) => current === "fast" ? "advanced" : "fast");
  }

  async function openStorePlan(plan: "monthly" | "annual") {
    setError(undefined);
    setPurchasingPlan(plan);
    try {
      const opened = await window.microsoftStore?.openPlan(plan);
      if (!opened) {
        throw new Error("Microsoft Store purchases are available in the installed Windows app.");
      }
      setStoreOpened(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not open Microsoft Store.");
    } finally {
      setPurchasingPlan(undefined);
    }
  }

  async function refreshStoreAccess() {
    setError(undefined);
    setSyncingStore(true);
    try {
      if (!window.microsoftStore?.getCollectionsId) {
        throw new Error("Microsoft Store verification is available in the installed Windows app.");
      }
      const ticket = await api.storeCollectionsTicket();
      const storeIdKey = await window.microsoftStore.getCollectionsId(
        ticket.serviceTicket,
        ticket.publisherUserId,
      );
      const profile = await api.verifyStoreSubscription(storeIdKey);
      setMe(profile);
      setStoreOpened(false);
      if (profile.plan.id === "free") {
        setError("No active subscription was found. Complete the purchase in Microsoft Store, then try again.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not verify Microsoft Store access.");
    } finally {
      setSyncingStore(false);
    }
  }

  return (
    <div className="app-shell">
      <aside className={`sidebar ${sidebarOpen ? "open" : "closed"}`}>
        <div className="brand-row">
          <div className="brand-mark"><img src="/logo.png" alt="" /></div>
          <div className="brand-copy"><strong>AI Chatbot・Ask AI Anything</strong><span>Personal assistant</span></div>
          <button className="icon-button close-sidebar" onClick={() => setSidebarOpen(false)} aria-label="Close sidebar"><X size={18} /></button>
        </div>
        <button className="new-chat" onClick={() => void newChat()}><MessageSquarePlus size={17} />New chat</button>
        <button className="search-button"><Search size={16} /><span>Search conversations</span><kbd>⌘ K</kbd></button>

        <div className="conversation-list">
          {conversations.length > 0 && <div className="section-label">Recent</div>}
          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              className={`conversation-item ${conversation.id === activeId ? "active" : ""}`}
              onClick={() => setActiveId(conversation.id)}
            >
              <span><strong>{conversation.title}</strong><small>{formatDate(conversation.updatedAt)}</small></span>
              <span className="conversation-actions" onClick={(event) => event.stopPropagation()}>
                <button aria-label="Delete conversation" onClick={() => void deleteChat(conversation.id)}><Trash2 size={14} /></button>
              </span>
            </button>
          ))}
        </div>

        <div className="sidebar-footer">
          <button className="upgrade-card" onClick={() => setPlanOpen(true)}>
            <span className="upgrade-icon"><Sparkles size={16} /></span>
            <span><strong>{me?.user.subscription.status === "trial" ? "Free trial active" : me?.plan.name ?? "Your plan"}</strong><small>{me ? `${me.usage.messages} of ${me.plan.messageLimit} ${me.plan.limitPeriod === "day" ? "daily" : "monthly"} messages used` : "View plans"}</small></span>
            <ChevronDown size={15} />
          </button>
          <button className="profile-row"><CircleUserRound size={20} /><span><strong>Personal account</strong><small>Settings & data</small></span><Settings size={16} /></button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          {!sidebarOpen && <button className="icon-button" onClick={() => setSidebarOpen(true)} aria-label="Open sidebar"><Menu size={19} /></button>}
          <button className="model-picker" onClick={changeMode}><span className="status-dot" />{mode === "fast" ? "Fast" : "Advanced"} <ChevronDown size={14} /></button>
          <div className="topbar-spacer" />
          <button className="share-button" onClick={() => setPlanOpen(true)}><Sparkles size={15} />Upgrade</button>
          <button className="icon-button"><MoreHorizontal size={19} /></button>
        </header>

        <div className="chat-scroll" ref={scrollRef}>
          {messages.length === 0 && !streamText ? (
            <section className="welcome">
              <div className="hero-mark"><img src="/logo.png" alt="" /></div>
              <h1>How can I help you today?</h1>
              <p>Ask questions, create content, analyze ideas, and get work done.</p>
              <div className="prompt-grid">
                {starterPrompts.map((prompt) => (
                  <button key={prompt.title} onClick={() => void send(prompt.text)}>
                    <prompt.icon size={18} />
                    <span><strong>{prompt.title}</strong><small>{prompt.text}</small></span>
                    <ArrowUp size={15} />
                  </button>
                ))}
              </div>
            </section>
          ) : (
            <section className="message-thread">
              <div className="thread-title">{activeConversation?.title}</div>
              {messages.map((message) => (
                <article key={message.id} className={`message ${message.role}`}>
                  <div className="avatar">{message.role === "assistant" ? <Bot size={18} /> : <CircleUserRound size={18} />}</div>
                  <div className="message-body">
                    <div className="message-name">{message.role === "assistant" ? "AI Assistant" : "You"}</div>
                    {message.role === "assistant" ? (
                      <>
                        <ReactMarkdown>{message.content}</ReactMarkdown>
                        {message.imageDataUrl && <img className="generated-image" src={message.imageDataUrl} alt="AI-edited result" />}
                        <button className="report-button" onClick={() => void reportMessage(message.id)}>Report response</button>
                      </>
                    ) : <p>{message.content}</p>}
                  </div>
                </article>
              ))}
              {streamText && (
                <article className="message assistant">
                  <div className="avatar"><Bot size={18} /></div>
                  <div className="message-body"><div className="message-name">AI Assistant</div><ReactMarkdown>{streamText}</ReactMarkdown><span className="cursor" /></div>
                </article>
              )}
            </section>
          )}
        </div>

        <div className="composer-area">
          {error && <div className="error-banner"><span>{error}</span><button onClick={() => setError(undefined)}><X size={15} /></button></div>}
          <form className="composer" onSubmit={onSubmit}>
            <input
              ref={fileInputRef}
              className="file-input"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,.pdf,.txt,.md,.csv,.docx,.xlsx,.pptx"
              onChange={(event) => void selectAttachment(event.target.files?.[0])}
            />
            {attachment && (
              <div className="attachment-chip">
                <FileText size={15} />
                <span>{attachment.name}</span>
                <small>{(attachment.size / 1024 / 1024).toFixed(1)} MB</small>
                {attachment.mimeType.startsWith("image/") && (
                  <button
                    type="button"
                    className="attachment-purpose"
                    onClick={() => setAttachment((current) => current && ({
                      ...current,
                      purpose: current.purpose === "analyze" ? "edit" : "analyze",
                    }))}
                  >{attachment.purpose === "analyze" ? "Analyze" : "Edit"}</button>
                )}
                <button type="button" aria-label="Remove attachment" onClick={() => setAttachment(undefined)}><X size={14} /></button>
              </div>
            )}
            <textarea
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  void send();
                }
              }}
              placeholder="Message AI Assistant"
              rows={1}
            />
            <div className="composer-tools">
              <button type="button" aria-label="Attach an image or document" onClick={chooseAttachment}><Paperclip size={18} /></button>
              <span className="tool-divider" />
              <span className="mode-label"><Sparkles size={14} />{mode === "fast" ? "Fast" : "Advanced"}</span>
              <div className="composer-spacer" />
              <span className="shortcut">Shift + Enter for new line</span>
              <button className="send-button" type="submit" disabled={(!draft.trim() && !attachment) || sending}><ArrowUp size={18} /></button>
            </div>
          </form>
          <p className="disclaimer">AI can make mistakes. Check important information. Independent app powered by OpenAI API.</p>
        </div>
      </main>

      {planOpen && (
        <div className="modal-backdrop" onMouseDown={() => setPlanOpen(false)}>
          <section className="plan-modal" onMouseDown={(event) => event.stopPropagation()}>
            <button className="modal-close" onClick={() => setPlanOpen(false)}><X size={18} /></button>
            <div className="modal-icon"><img src="/logo.png" alt="" /></div>
            <h2>Choose your plan</h2>
            <p>Get full access to the assistant on Windows.</p>
            <div className="plans">
              <div className="plan-card">
                <div><strong>Free</strong><span>No payment required</span></div>
                <div className="price"><b>$0</b><small>/forever</small></div>
                <ul><li><Check size={15} />5 questions each day</li><li><Check size={15} />Fast AI mode</li><li><Check size={15} />Conversation history</li></ul>
                <button disabled>{me?.plan.id === "free" ? "Current plan" : "Free plan"}</button>
              </div>
              <div className="plan-card">
                <div><strong>Monthly</strong><span>7 days free</span></div>
                <div className="price"><b>$14.99</b><small>/month</small></div>
                <ul><li><Check size={15} />1,000 messages each month</li><li><Check size={15} />Fast and Advanced modes</li><li><Check size={15} />Images and documents</li></ul>
                <button
                  disabled={Boolean(purchasingPlan) || me?.plan.id === "monthly"}
                  onClick={() => void openStorePlan("monthly")}
                >
                  {me?.plan.id === "monthly"
                    ? "Current plan"
                    : purchasingPlan === "monthly" ? "Opening Store…" : "Start 7-day trial"}
                </button>
              </div>
              <div className="plan-card featured">
                <span className="best-value">BEST VALUE</span>
                <div><strong>Annual</strong><span>Save $99.89 per year</span></div>
                <div className="price"><b>$79.99</b><small>/year</small></div>
                <ul><li><Check size={15} />1,000 messages each month</li><li><Check size={15} />Fast and Advanced modes</li><li><Check size={15} />Images and documents</li></ul>
                <button
                  disabled={Boolean(purchasingPlan) || me?.plan.id === "annual"}
                  onClick={() => void openStorePlan("annual")}
                >
                  {me?.plan.id === "annual"
                    ? "Current plan"
                    : purchasingPlan === "annual" ? "Opening Store…" : "Choose annual"}
                </button>
              </div>
            </div>
            <small className="billing-note">Purchases and recurring billing are completed and managed by Microsoft Store.</small>
            <button
              className="refresh-access"
              disabled={syncingStore}
              onClick={() => void refreshStoreAccess()}
            >
              <RefreshCw size={14} className={syncingStore ? "spinning" : ""} />
              {syncingStore
                ? "Verifying Microsoft Store…"
                : storeOpened ? "I completed the purchase — refresh access" : "Refresh subscription access"}
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

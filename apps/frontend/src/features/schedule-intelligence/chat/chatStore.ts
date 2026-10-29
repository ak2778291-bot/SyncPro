import { makeAutoObservable, runInAction } from "mobx";
import { deleteChatSession, getChatSessions, saveChatSession } from "@/shared/api/client";
import type {
  AgentClarification,
  AnswerBlock,
  AnswerCitation,
  AnswerConfidence,
  AnswerEvidence,
  AnswerTier,
  TurnState,
} from "@/shared/api/client";

export type ChatResponseMeta = {
  answer?: string;
  tableData?: Record<string, unknown>[];
  cypher?: string;
  suggestions?: string[];
  followUpQuestions?: string[];
  error?: string;
  // ── v2 ── absent when the backend runs the v1 engine, so every renderer
  // treats these as optional rather than the two having to ship together.
  blocks?: AnswerBlock[];
  tier?: AnswerTier;
  tierMeaning?: string;
  citations?: AnswerCitation[];
  evidence?: AnswerEvidence;
  confidence?: AnswerConfidence;
  caveats?: string[];
  clarification?: AgentClarification | null;
  /** The question this answer came from. Kept so a clarification chip can
   * re-ask the original rather than the chip's own label. */
  askedFor?: string;
};

export type ChatMessage = {
  id: string;
  sender: "user" | "assistant" | "system";
  text: string;
  timestamp: number;
  meta?: ChatResponseMeta;
  feedback?: "up" | "down";
};

export type ChatSession = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt?: number;
  messages: ChatMessage[];
  memorySummary?: string;
  /** What this conversation has already settled — a resolved activity, the last
   * intent. Sent back with each turn so "and its successors?" has a referent
   * and the agent never asks the same question twice. */
  turnState?: TurnState;
};

type ServerChatSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
  memorySummary?: string;
};

const greeting = (): ChatMessage => ({
  id: crypto.randomUUID(),
  sender: "assistant",
  text: "Hello - ask me about this project's schedule.",
  timestamp: Date.now(),
});

class ChatStore {
  sessions: ChatSession[] = [];
  activeId: string | null = null;
  userId: string | null = null;
  projectId: string | null = null;
  hydratedFromServer = false;

  constructor() {
    makeAutoObservable(this);
  }

  setUser(userId: string | null) {
    // Guarded on an actual change: `App.tsx` calls this whenever the `user`
    // object from AuthContext changes identity, which includes a same-id
    // refresh (e.g. after email verification) — without this check, that
    // would silently reload the session list out from under an active chat.
    if (userId === this.userId) return;
    this.userId = userId;
    if (this.projectId) void this.loadSessions();
  }

  setProject(projectId: string | null) {
    if (this.projectId && this.userId) {
      void this.persistAll();
    }
    this.projectId = projectId;
    this.sessions = [];
    this.activeId = null;
    this.hydratedFromServer = false;
    if (projectId) void this.loadSessions();
  }

  get activeSession() {
    return this.sessions.find((s) => s.id === this.activeId) ?? null;
  }

  private get storageKey(): string | null {
    if (!this.userId || !this.projectId) return null;
    return `chat_sessions_${this.userId}_${this.projectId}`;
  }

  createSession(title?: string) {
    const session: ChatSession = {
      id: crypto.randomUUID(),
      title: title || `Chat ${new Date().toLocaleString()}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: [greeting()],
      memorySummary: "",
    };
    this.sessions.unshift(session);
    this.activeId = session.id;
    this.saveToStorage();
    void this.persistSession(session);
    return session.id;
  }

  deleteSession(sessionId: string) {
    this.sessions = this.sessions.filter((s) => s.id !== sessionId);
    if (this.activeId === sessionId) this.activeId = this.sessions[0]?.id ?? null;
    this.saveToStorage();
    void this.deleteServerSession(sessionId);
  }

  setActive(sessionId: string) {
    this.activeId = sessionId;
    this.saveToStorage();
  }

  addMessage(sessionIdOrMsg: string | ChatMessage, msg?: ChatMessage) {
    const sid = typeof sessionIdOrMsg === "string" ? sessionIdOrMsg : this.activeId;
    const message = typeof sessionIdOrMsg === "string" ? msg : sessionIdOrMsg;
    if (!sid || !message) return;

    const session = this.sessions.find((x) => x.id === sid);
    if (!session) return;

    session.messages.push(message);
    session.updatedAt = Date.now();
    session.memorySummary = summarizeMessages(session.messages);
    this.saveToStorage();
    void this.persistSession(session);
  }

  updateMessage(sessionId: string, messageId: string, patch: Partial<ChatMessage>) {
    const session = this.sessions.find((x) => x.id === sessionId);
    const message = session?.messages.find((m) => m.id === messageId);
    if (!session || !message) return;
    Object.assign(message, patch);
    session.updatedAt = Date.now();
    this.saveToStorage();
    void this.persistSession(session);
  }

  /** Carry the agent's turn state forward. Not persisted to the server: it is
   * conversation working memory, cheap to rebuild, and a stale binding restored
   * from last week would silently answer about the wrong activity. */
  setTurnState(sessionId: string, state: TurnState) {
    const session = this.sessions.find((x) => x.id === sessionId);
    if (!session) return;
    session.turnState = state;
  }

  renameSession(sessionId: string, title: string) {
    const session = this.sessions.find((x) => x.id === sessionId);
    if (!session) return;
    session.title = title;
    session.updatedAt = Date.now();
    this.saveToStorage();
    void this.persistSession(session);
  }

  clearSessionMessages(sessionId: string) {
    const session = this.sessions.find((x) => x.id === sessionId);
    if (!session) return;
    session.messages = [];
    session.memorySummary = "";
    this.saveToStorage();
    void this.persistSession(session);
  }

  buildHistory(session: ChatSession) {
    const recent = session.messages.slice(-10).map((m) => ({
      role: m.sender === "user" ? "user" : "assistant",
      content: m.text,
    }));
    return session.memorySummary
      ? [{ role: "system", content: `Conversation memory: ${session.memorySummary}` }, ...recent]
      : recent;
  }

  async loadSessions() {
    this.loadFromStorage();
    if (!this.userId || !this.projectId) return;

    try {
      const data = await getChatSessions(this.projectId);
      const sessions = ((data.sessions || []) as ServerChatSession[]).map((s) => ({
        id: s.id,
        title: s.title,
        createdAt: Date.parse(s.createdAt) || Date.now(),
        updatedAt: Date.parse(s.updatedAt) || Date.now(),
        messages: Array.isArray(s.messages) ? s.messages : [greeting()],
        memorySummary: s.memorySummary || "",
      }));

      runInAction(() => {
        if (sessions.length) {
          this.sessions = sessions;
          this.activeId = sessions[0].id;
        } else if (!this.sessions.length) {
          this.createSession("New Chat");
        }
        this.hydratedFromServer = true;
        this.saveToStorage();
      });
    } catch {
      if (!this.sessions.length) this.createSession("New Chat");
    }
  }

  saveToStorage() {
    try {
      const key = this.storageKey;
      if (!key) return;
      localStorage.setItem(key, JSON.stringify({ sessions: this.sessions, activeId: this.activeId }));
    } catch (e) {
      console.warn("Failed to save chat sessions:", e);
    }
  }

  loadFromStorage() {
    try {
      const key = this.storageKey;
      if (!key) return;
      const raw = localStorage.getItem(key);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      runInAction(() => {
        this.sessions = parsed.sessions || [];
        this.activeId = parsed.activeId || (this.sessions[0]?.id ?? null);
      });
    } catch (e) {
      console.warn("Failed to load chat sessions:", e);
    }
  }

  private async persistAll() {
    await Promise.all(this.sessions.map((session) => this.persistSession(session)));
  }

  private async persistSession(session: ChatSession) {
    if (!this.userId || !this.projectId) return;
    try {
      await saveChatSession({
        projectId: this.projectId,
        sessionId: session.id,
        title: session.title,
        messages: session.messages,
        memorySummary: session.memorySummary,
      });
    } catch (e) {
      console.warn("Failed to persist chat session:", e);
    }
  }

  private async deleteServerSession(sessionId: string) {
    if (!this.userId) return;
    try {
      await deleteChatSession(sessionId);
    } catch (e) {
      console.warn("Failed to delete server chat session:", e);
    }
  }
}

function summarizeMessages(messages: ChatMessage[]) {
  const meaningful = messages
    .filter((m) => m.sender !== "system")
    .slice(-8)
    .map((m) => `${m.sender}: ${m.text.replace(/\s+/g, " ").slice(0, 160)}`);
  return meaningful.join(" | ").slice(0, 900);
}

const chatStore = new ChatStore();
export default chatStore;
export const useChatStore = () => chatStore;

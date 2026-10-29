// The assistant surface: ask questions, or file a field report.
//
// One conversation, two intents, chosen explicitly. Report mode posts to
// `/shadow/field-reports`, which derives the reporter's identity from the auth
// token — so a site engineer reports as themselves and as nobody else — and runs
// the same extract → disambiguate → corroborate → gate pipeline a WhatsApp message
// does. The toggle only appears for someone holding `evidence:submit`.
//
// Layout is a centred reading column rather than a bubble thread: answers here are
// tables, Cypher and confidence breakdowns, and those need width more than chrome.
import { useCallback, useEffect, useRef, useState } from "react";
import { observer } from "mobx-react-lite";
import { saveAs } from "file-saver";
import * as XLSX from "xlsx";
import {
  ArrowUp,
  Loader2,
  MessageSquare,
  ChevronDown,
  FolderOpen,
  Table2,
  Network,
  Radio,
  Sparkles,
  ShieldAlert,
  Square,
  RotateCcw,
} from "lucide-react";
import { useChatStore } from "./chatStore";
import ChatMessageComponent from "./ChatMessage";
import type { ChatMessage, ChatResponseMeta } from "./chatStore";
import { useSchedule } from "@/features/projects/ScheduleContext";
import {
  getModels,
  sendChatFeedback,
  sendChatMessage,
  streamAgentAsk,
  submitFieldReport,
  type FieldReportResult,
} from "@/shared/api/client";
import type {
  AgentClarification,
  AgentStatus,
  ChatAgentResponse,
  ModelInfo,
  TurnState,
} from "@/shared/api/client";
import { useProjectCapabilities, CAP } from "@/features/shadow-schedule/useProjectCapabilities";
import ReportComposer, { type ActivityOption } from "@/features/shadow-schedule/ReportComposer";

const ASK_SUGGESTIONS = [
  "Show all critical path tasks",
  "Which tasks finish this week?",
  "What are the top-level WBS items?",
  "Are there tasks with zero float?",
];

const REPORT_SUGGESTIONS = [
  "Footing on level 3 is about 60% done",
  "Slab shuttering finished today",
  "Excavation held up by rain since Monday",
];

type Mode = "ask" | "report";

type Clarification = {
  text: string;
  options: Array<{ uid: string; name: string; score: number }>;
};

/** One stage of the agent's work, in the words a planner would use.
 *
 * "running schedule_health" is an implementation detail; "checking schedule
 * quality" is what the user asked for. The tool name still appears in the
 * evidence panel for anyone who wants it. */
function describeStage(s: AgentStatus): string {
  const TOOL_LABEL: Record<string, string> = {
    schedule_query: "reading the schedule",
    schedule_overdue: "checking what is late",
    schedule_facts: "reading the project facts",
    schedule_dependencies: "tracing the logic",
    schedule_lags: "checking lags and leads",
    schedule_progress: "measuring progress",
    schedule_float_profile: "measuring float",
    schedule_wbs: "reading the work breakdown",
    schedule_health: "running the quality checks",
    schedule_whatif: "simulating the delay",
    schedule_changes: "reading the change log",
    schedule_narrative: "writing the briefing",
    field_evidence: "reading field reports",
  };
  switch (s.stage) {
    case "understanding":
      return "Working out what you are asking";
    case "checking":
      return "Checking I have what I need";
    case "planning":
      return "Choosing which tools to use";
    case "running":
      return `Running ${(s.tools || []).map((t) => TOOL_LABEL[t] || t).join(" and ")}`;
    case "tool":
      return `${TOOL_LABEL[s.tool || ""] || s.tool} — ${s.rows ?? 0} rows`;
    case "drafting":
      return "Writing the answer";
    case "verifying":
      return "Checking every figure against the data";
    case "explaining":
      return "Explaining the concept";
    default:
      return s.stage;
  }
}

/** How the pipeline's verdict reads to the person who just reported. */
function reportVerdict(r: FieldReportResult): string {
  const where = r.resolved_activity_name ? ` against **${r.resolved_activity_name}**` : "";
  if (r.route === "duplicate") {
    return "That report was already filed — nothing was recorded twice.";
  }
  if (r.committed) {
    return `Logged${where} and committed to the shadow schedule (confidence ${r.commit_confidence.toFixed(2)}).`;
  }
  if (r.route === "proposal_queued") {
    return `Logged${where}. This project is in **proposal-only** mode, so nothing commits automatically — a planner will review it.`;
  }
  const reason = r.review_reason ? ` — ${r.review_reason}` : "";
  // Only quote a commit confidence that was actually computed. A claim rejected at
  // the resolution floor never reaches corroboration, so its commit_confidence is
  // 0 because nothing scored it — printing "confidence 0.00" would read as "we
  // judged this claim worthless", which is a different and untrue statement.
  const scored = r.commit_confidence > 0;
  const score = scored
    ? ` (confidence ${r.commit_confidence.toFixed(2)}, gate 0.80)`
    : "";
  return `Logged${where}. Queued for a planner to confirm${score}${reason}.`;
}

const ChatWindow = observer(() => {
  const store = useChatStore();
  const session = store.activeSession;
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [showModelMenu, setShowModelMenu] = useState(false);
  // What the agent is doing right now, and how to stop it. Perceived speed is
  // visible progress: a planner watching "reading schedule health - 20 checks
  // over 216 activities" waits more happily than one watching a spinner.
  const [trace, setTrace] = useState<AgentStatus[]>([]);
  const abortRef = useRef<(() => void) | null>(null);
  // An outstanding question from the agent, plus the question that prompted it
  // so a tapped chip can re-ask the original rather than the chip's own label.
  const [pendingAsk, setPendingAsk] = useState<(AgentClarification & { askedFor: string }) | null>(null);
  const [lastAsked, setLastAsked] = useState("");
  const { activeProjectId, projects, setActiveProjectId, userId } = useSchedule();
  const activeProject = projects.find((p) => p.id === activeProjectId);
  const lastMessageText = session?.messages.at(-1)?.text;

  const { can } = useProjectCapabilities(activeProjectId);
  const canReport = can(CAP.evidenceSubmit);
  const canAdjudicate = can(CAP.queueAdjudicate);

  const [mode, setMode] = useState<Mode>("ask");
  const [selectedActivity, setSelectedActivity] = useState<ActivityOption | null>(null);
  const [percent, setPercent] = useState("");
  // Optional actual completion/observation date. It is stored as the field
  // event's canonical captured_at, so a late report compares against the plan
  // on the day the work happened rather than the day it was submitted.
  const [completedOn, setCompletedOn] = useState("");
  const [pendingClarification, setPendingClarification] = useState<Clarification | null>(null);

  // Two rules, and the order matters.
  //
  // A capability change (switching to a project you only read) must not leave the
  // composer in a mode the server would refuse — so losing `evidence:submit`
  // always forces Ask.
  //
  // And someone whose *only* write capability is reporting arrives here to report,
  // not to ask: opening in Ask mode would make them find the toggle before they
  // could do the one thing they came for (UX_FLOW §4.4). Anyone who can also rule
  // on the queue keeps Ask as the default, because for them the assistant is
  // primarily a question box.
  useEffect(() => {
    if (!canReport) {
      setMode("ask");
    } else if (!canAdjudicate) {
      setMode("report");
    }
  }, [canReport, canAdjudicate]);

  useEffect(() => {
    getModels()
      .then((data) => {
        setModels(data.models || []);
        setSelectedModel(data.default || data.models?.[0]?.id || "");
      })
      .catch(() => {
        // Fallback only for when /models itself is unreachable. Kept in step with
        // the server's DEFAULT_MODEL — a stale id here 404s at call time, which
        // surfaces as an error bubble rather than a startup failure.
        setModels([
          { id: "groq/openai/gpt-oss-120b", name: "GPT-OSS 120B", provider: "Groq" },
        ]);
        setSelectedModel("groq/openai/gpt-oss-120b");
      });
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [session?.messages.length, lastMessageText]);

  // Auto-grow the composer, capped so a long paste cannot push the conversation
  // off screen.
  useEffect(() => {
    const el = taRef.current;
    if (!el) return;
    el.style.height = "0px";
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
  }, [prompt]);

  // The typewriter that used to reveal a finished answer character by character
  // is gone. It existed to make one blocking response feel alive, and the live
  // stage trace now does that job earlier and more honestly — it shows work
  // actually happening rather than animating work already done. Running both
  // would animate the same answer twice.

  const toMeta = (data: ChatAgentResponse): ChatResponseMeta => ({
    answer: data.answer || data.response || "",
    tableData: data.tableData || data.data || [],
    cypher: data.cypher || data.query || "",
    suggestions: data.suggestions || [],
    followUpQuestions: data.followUpQuestions || [],
    error: data.error,
    // v2 fields, undefined when the backend is running v1.
    blocks: data.blocks,
    tier: data.tier,
    tierMeaning: data.tierMeaning,
    citations: data.citations,
    evidence: data.evidence,
    confidence: data.confidence,
    caveats: data.caveats,
    clarification: data.clarification,
  });

  /** Ask a question and stream the answer.
   *
   * `clarify` is set when the user taps a chip: the *original* question is
   * re-asked with the ambiguity removed, because answering a clarification is
   * the same question again rather than a new one.
   */
  const handleSendText = async (
    text: string,
    clarify?: { slot: string; value: string },
  ) => {
    if (!text.trim() || loading || !session) return;
    const sessionId = session.id;

    if (!clarify) {
      store.addMessage(sessionId, {
        id: crypto.randomUUID(),
        sender: "user",
        text,
        timestamp: Date.now(),
      });
    }
    setPrompt("");
    setLoading(true);
    setTrace([]);
    setPendingAsk(null);
    setLastAsked(text);

    const assistantId = crypto.randomUUID();
    let settled = false;

    const finish = (data: ChatAgentResponse, state?: TurnState) => {
      if (settled) return;
      settled = true;
      const meta: ChatResponseMeta = { ...toMeta(data), askedFor: text };
      const answer = data.error
        ? `**Error:** ${data.error}${data.fallback ? `\n\n${data.fallback}` : ""}`
        : data.answer || data.response || "No response received.";
      store.addMessage(sessionId, {
        id: assistantId,
        sender: "assistant",
        // Blocks carry their own prose, so the typewriter would duplicate it.
        text: meta.blocks?.length ? "" : answer,
        timestamp: Date.now(),
        meta,
      });
      if (state) store.setTurnState(sessionId, state);
      if (data.clarification) setPendingAsk({ ...data.clarification, askedFor: text });
      setLoading(false);
      setTrace([]);
      abortRef.current = null;
    };

    // Streaming first: the value is the visible trace, not the raw latency.
    // A backend without /agent/ask, or a network that cannot stream, falls back
    // to the single request the v1 client always used.
    abortRef.current = streamAgentAsk(
      {
        prompt: text,
        model: selectedModel,
        projectId: activeProjectId,
        sessionId,
        turnState: session.turnState ?? null,
        clarifySlot: clarify?.slot,
        clarifyValue: clarify?.value,
      },
      {
        onStatus: (status) => setTrace((t) => [...t, status]),
        onClarification: (c) => setPendingAsk({ ...c, askedFor: text }),
        onDone: (envelope, state) => finish(envelope, state),
        onError: async () => {
          if (settled) return;
          try {
            const data = await sendChatMessage({
              prompt: text,
              model: selectedModel,
              projectId: activeProjectId,
              history: store.buildHistory(session),
              sessionId,
              turnState: session.turnState ?? null,
              clarifySlot: clarify?.slot,
              clarifyValue: clarify?.value,
            });
            finish(data, data.turnState);
          } catch (err) {
            if (settled) return;
            settled = true;
            store.addMessage(sessionId, {
              id: assistantId,
              sender: "assistant",
              text: err instanceof Error ? err.message : "Request failed.",
              timestamp: Date.now(),
            });
            setLoading(false);
            setTrace([]);
            abortRef.current = null;
          }
        },
      },
    );
  };

  /** Stop the answer in flight. Not an error — the turn simply ends. */
  const stopAnswer = () => {
    abortRef.current?.();
    abortRef.current = null;
    setLoading(false);
    setTrace([]);
  };

  /** File a field report. `uidOverride` is how an inline clarification answers:
   * the reporter picks from the candidates the engine was torn between, and the
   * same observation is re-filed with the ambiguity removed. */
  const handleSendReport = useCallback(
    async (text: string, uidOverride?: string) => {
      if (loading || !session || !activeProjectId) return;
      const uid = uidOverride ?? selectedActivity?.uid ?? "";
      if (!text.trim() && !uid) return;

      const raw = percent.trim();
      const pct = raw === "" ? null : Number(raw);
      const named = uidOverride ? uidOverride : (selectedActivity?.name ?? uid);

      store.addMessage(session.id, {
        id: crypto.randomUUID(),
        sender: "user",
        text: text || `(reporting on ${named})`,
        timestamp: Date.now(),
      });
      setPrompt("");
      setLoading(true);
      try {
        const r = await submitFieldReport({
          projectId: activeProjectId,
          // One key per submission, not per keystroke: a retry must collapse onto
          // the same event, a genuinely new report must not.
          idempotencyKey: crypto.randomUUID(),
          text,
          selectedActivityUid: uid || undefined,
          claimedPercentComplete: pct !== null && Number.isFinite(pct) ? pct : null,
          capturedAt: completedOn || undefined,
        });
        store.addMessage(session.id, {
          id: crypto.randomUUID(),
          sender: "assistant",
          text: reportVerdict(r),
          timestamp: Date.now(),
        });
        // The engine was torn — resolve it here and now rather than over the
        // 24-hour round trip WhatsApp is stuck with.
        if (!r.resolved_activity_uid && r.candidate_alternatives.length >= 2) {
          setPendingClarification({ text, options: r.candidate_alternatives.slice(0, 4) });
        } else {
          setPendingClarification(null);
        }
        setSelectedActivity(null);
        setPercent("");
        setCompletedOn("");
      } catch (err) {
        store.addMessage(session.id, {
          id: crypto.randomUUID(),
          sender: "assistant",
          text: err instanceof Error ? err.message : "Could not file that report.",
          timestamp: Date.now(),
        });
      } finally {
        setLoading(false);
      }
    },
    [loading, session, activeProjectId, selectedActivity, percent, completedOn, store],
  );

  const submit = () => {
    if (mode === "report") void handleSendReport(prompt);
    else void handleSendText(prompt);
  };

  const handleFeedback = async (message: ChatMessage, rating: "up" | "down") => {
    if (!session || !userId) return;
    store.updateMessage(session.id, message.id, { feedback: rating });
    const previousUserPrompt =
      [...session.messages].reverse().find((m) => m.sender === "user")?.text || "";
    await sendChatFeedback({
      projectId: activeProjectId,
      sessionId: session.id,
      messageId: message.id,
      rating,
      prompt: previousUserPrompt,
      answer: message.text,
      cypher: message.meta?.cypher,
    }).catch(() => undefined);
  };

  const exportRows = (rows: Record<string, unknown>[], label = "chat_results") => {
    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Results");
    const buffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buffer]), `${label}.xlsx`);
  };

  const jumpToSchedule = () =>
    window.dispatchEvent(new CustomEvent("schedule-assistant:set-tab", { detail: "table" }));
  const jumpToGraph = () =>
    window.dispatchEvent(new CustomEvent("schedule-assistant:set-tab", { detail: "graph" }));

  const suggestions = mode === "report" ? REPORT_SUGGESTIONS : ASK_SUGGESTIONS;
  const isEmpty = (session?.messages.length ?? 0) <= 1 && !loading;
  const canSubmit =
    !loading && (prompt.trim().length > 0 || (mode === "report" && !!selectedActivity));

  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center h-full">
        <MessageSquare className="w-10 h-10 text-gray-700 mb-3" />
        <p className="text-sm text-gray-400">Select or create a chat to start</p>
      </div>
    );
  }

  const composer = (
    <div className="rounded-2xl bg-slate-900 border border-white/[0.08] shadow-lg shadow-black/20 focus-within:border-blue-500/40 transition-colors">
      {mode === "report" && (
        <div className="px-3 pt-3">
          <ReportComposer
            projectId={activeProjectId}
            selected={selectedActivity}
            onSelect={setSelectedActivity}
            percent={percent}
            onPercent={setPercent}
            completedOn={completedOn}
            onCompletedOn={setCompletedOn}
            disabled={loading}
          />
        </div>
      )}

      <textarea
        ref={taRef}
        rows={1}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            submit();
          }
        }}
        placeholder={
          mode === "report"
            ? "What happened on site? e.g. footing on level 3 is about 60% done"
            : "Ask about tasks, dates, critical path…"
        }
        disabled={loading}
        className="w-full resize-none bg-transparent px-4 py-3.5 text-sm text-gray-100 placeholder-gray-600 focus:outline-none"
      />

      <div className="flex items-center justify-between gap-2 px-3 pb-3">
        <div className="flex items-center gap-2">
          {canReport && (
            <div className="flex items-center rounded-lg bg-white/[0.04] border border-white/[0.08] p-0.5">
              {(["ask", "report"] as Mode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] transition-colors ${
                    mode === m
                      ? m === "report"
                        ? "bg-emerald-500/15 text-emerald-300"
                        : "bg-white/[0.08] text-gray-100"
                      : "text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {m === "report" ? (
                    <Radio className="w-3 h-3" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  {m === "report" ? "Report" : "Ask"}
                </button>
              ))}
            </div>
          )}

          <div className="relative">
            <button
              onClick={() => setShowModelMenu(!showModelMenu)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              {models.find((m) => m.id === selectedModel)?.name || "Model"}
              <ChevronDown className="w-3 h-3" />
            </button>
            {showModelMenu && (
              <div className="absolute left-0 bottom-full mb-1 z-50 w-56 bg-slate-800 border border-white/[0.08] rounded-xl shadow-xl overflow-hidden max-h-72 overflow-y-auto">
                {Object.entries(
                  models.reduce(
                    (acc, m) => {
                      (acc[m.provider] = acc[m.provider] || []).push(m);
                      return acc;
                    },
                    {} as Record<string, ModelInfo[]>,
                  ),
                ).map(([provider, providerModels]) => (
                  <div key={provider}>
                    <div className="px-3 py-1.5 text-[10px] font-semibold text-gray-600 uppercase tracking-wider bg-slate-900/50">
                      {provider}
                    </div>
                    {providerModels.map((m) => (
                      <button
                        key={m.id}
                        onClick={() => {
                          setSelectedModel(m.id);
                          setShowModelMenu(false);
                        }}
                        className={`w-full text-left px-3 py-2 text-xs hover:bg-white/[0.05] transition-colors ${
                          selectedModel === m.id ? "text-blue-400 bg-blue-500/10" : "text-gray-300"
                        }`}
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={submit}
          disabled={!canSubmit}
          title={mode === "report" ? "Submit report" : "Send"}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors disabled:opacity-30 ${
            mode === "report"
              ? "bg-emerald-600 hover:bg-emerald-500"
              : "bg-blue-600 hover:bg-blue-500"
          }`}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin text-white" />
          ) : (
            <ArrowUp className="w-4 h-4 text-white" />
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex-shrink-0 flex items-center justify-between gap-3 px-6 py-3 border-b border-white/[0.06]">
        <div className="min-w-0">
          <div className="text-sm font-medium text-gray-200 truncate">{session.title}</div>
          <div className="text-[11px] text-gray-600">
            {session.memorySummary ? "Memory on · " : ""}
            {new Date(session.createdAt).toLocaleString()}
          </div>
        </div>
        {activeProject ? (
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.06] text-[11px] text-gray-400 shrink-0">
            <FolderOpen className="w-3 h-3" />
            <span className="max-w-[180px] truncate">{activeProject.name}</span>
          </div>
        ) : (
          <button
            onClick={() => projects[0] && setActiveProjectId(projects[0].id)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-amber-500/5 border border-amber-500/10 text-[11px] text-amber-400/70 shrink-0"
          >
            <FolderOpen className="w-3 h-3" /> No project
          </button>
        )}
      </div>

      {isEmpty ? (
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto px-6 h-full flex flex-col items-center justify-center">
            <h2 className="text-2xl font-semibold text-gray-200 mb-1.5">
              {mode === "report" ? "What happened on site?" : "Ask about this schedule"}
            </h2>
            <p className="text-xs text-gray-600 mb-7 text-center max-w-md">
              {mode === "report"
                ? "Your report runs the same checks a WhatsApp message does — matched to an activity, corroborated, then gated before anything is committed."
                : "Questions are answered from this project's knowledge graph. Nothing you ask here changes the schedule."}
            </p>
            <div className="w-full">{composer}</div>
            <div className="flex flex-wrap gap-2 justify-center mt-4">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() =>
                    mode === "report" ? void handleSendReport(s) : void handleSendText(s)
                  }
                  className="text-[11px] px-3 py-1.5 rounded-full border border-white/[0.08] bg-white/[0.02] text-gray-500 hover:bg-white/[0.05] hover:text-gray-300 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 py-6 space-y-5">
              {session.messages.map((m) => (
                <ChatMessageComponent
                  key={m.id}
                  message={m}
                  onSuggestion={mode === "report" ? handleSendReport : handleSendText}
                  onFeedback={handleFeedback}
                  onExport={exportRows}
                  onOpenTable={jumpToSchedule}
                  onOpenGraph={jumpToGraph}
                />
              ))}

              {pendingClarification && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-3.5">
                  <p className="text-xs text-amber-200/90 flex items-center gap-1.5 mb-2">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    Which activity did you mean?
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {pendingClarification.options.map((o) => (
                      <button
                        key={o.uid}
                        onClick={() => {
                          const t = pendingClarification.text;
                          setPendingClarification(null);
                          void handleSendReport(t, o.uid);
                        }}
                        className="text-[11px] px-2.5 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-gray-300 hover:bg-white/[0.06] transition-colors"
                      >
                        {o.name}
                        <span className="ml-1.5 text-gray-600 tabular-nums">
                          {o.score.toFixed(2)}
                        </span>
                      </button>
                    ))}
                    <button
                      onClick={() => setPendingClarification(null)}
                      className="text-[11px] px-2.5 py-1.5 rounded-lg text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      None of these
                    </button>
                  </div>
                  <p className="text-[10px] text-gray-600 mt-2">
                    Leaving this unanswered is fine — a planner sees it either way.
                  </p>
                </div>
              )}

              {/* The agent's own question, as one-tap chips. Tapping re-asks the
                  original question with the ambiguity removed; "None of these"
                  is mandatory, because without it the shortlist manufactures a
                  confirmation the user never gave. */}
              {pendingAsk && !loading && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/[0.05] p-3.5">
                  <p className="text-xs text-amber-200/90 flex items-center gap-1.5 mb-2">
                    <ShieldAlert className="w-3.5 h-3.5 shrink-0" />
                    {pendingAsk.question}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {pendingAsk.options.map((o) => (
                      <button
                        key={o.value}
                        onClick={() => {
                          const asked = pendingAsk.askedFor;
                          const slot = pendingAsk.slot;
                          setPendingAsk(null);
                          void handleSendText(asked, { slot, value: o.value });
                        }}
                        className="text-left text-[11px] px-2.5 py-1.5 rounded-lg border border-white/[0.08] bg-white/[0.03] text-gray-300 hover:bg-white/[0.06] transition-colors"
                      >
                        {o.label}
                        {o.detail ? (
                          <span className="ml-1.5 text-gray-600">{o.detail}</span>
                        ) : null}
                      </button>
                    ))}
                    {pendingAsk.allow_none && (
                      <button
                        onClick={() => {
                          const asked = pendingAsk.askedFor;
                          const slot = pendingAsk.slot;
                          setPendingAsk(null);
                          void handleSendText(asked, { slot, value: "NONE" });
                        }}
                        className="text-[11px] px-2.5 py-1.5 rounded-lg text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        None of these
                      </button>
                    )}
                  </div>
                  {pendingAsk.assumption ? (
                    <p className="text-[10px] text-gray-600 mt-2">{pendingAsk.assumption}</p>
                  ) : null}
                </div>
              )}

              {loading && (
                <div className="space-y-1.5">
                  {/* The trace, not a spinner. Each stage names what is actually
                      happening, so a slow answer reads as work rather than as a
                      hang. */}
                  {trace.map((s, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-2 text-[11px] ${
                        i === trace.length - 1 ? "text-gray-400" : "text-gray-600"
                      }`}
                    >
                      {i === trace.length - 1 ? (
                        <Loader2 className="w-3 h-3 animate-spin text-blue-400 shrink-0" />
                      ) : (
                        <span className="w-3 text-center text-emerald-500/70 shrink-0">✓</span>
                      )}
                      {describeStage(s)}
                    </div>
                  ))}
                  {!trace.length && (
                    <div className="flex items-center text-xs text-gray-500">
                      <Loader2 className="w-3.5 h-3.5 animate-spin mr-2 text-blue-400" />
                      {mode === "report" ? "Matching against the schedule…" : "Thinking…"}
                    </div>
                  )}
                  <button
                    onClick={stopAnswer}
                    className="inline-flex items-center gap-1.5 mt-1 px-2 py-1 rounded-md border border-white/[0.08] text-[11px] text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <Square className="w-2.5 h-2.5 fill-current" /> Stop
                  </button>
                </div>
              )}

              {!loading && !pendingAsk && lastAsked && mode === "ask" && (
                <button
                  onClick={() => void handleSendText(lastAsked)}
                  className="inline-flex items-center gap-1.5 text-[11px] text-gray-600 hover:text-gray-300 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" /> Ask again
                </button>
              )}
              <div ref={bottomRef} />
            </div>
          </div>

          <div className="flex-shrink-0 px-6 pb-5 pt-2">
            <div className="max-w-3xl mx-auto">
              {session.messages.some((m) => (m.meta?.tableData?.length || 0) > 0) && (
                <div className="flex gap-3 mb-2">
                  <button
                    onClick={jumpToSchedule}
                    className="inline-flex items-center gap-1 text-[11px] text-gray-600 hover:text-gray-300"
                  >
                    <Table2 className="w-3 h-3" /> Open schedule table
                  </button>
                  <button
                    onClick={jumpToGraph}
                    className="inline-flex items-center gap-1 text-[11px] text-gray-600 hover:text-gray-300"
                  >
                    <Network className="w-3 h-3" /> Jump to graph
                  </button>
                </div>
              )}
              {composer}
              <p className="text-[10px] text-gray-700 text-center mt-2">
                {mode === "report"
                  ? "Reports are evidence: attributed to you, gated before commit, and never approved by the person who filed them."
                  : "Answers come from this project's graph and can be wrong — check anything load-bearing."}
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
});

export default ChatWindow;

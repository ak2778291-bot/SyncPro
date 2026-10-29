/** Research benchmark API — backs the internal /evaluation page.
 *
 * Every endpoint requires a platform operator; a 403 means the signed-in user
 * is not on PLATFORM_OPERATOR_EMAILS, and the page says so rather than
 * rendering an empty dashboard. */
import { API_BASE, getAuthToken } from "@/shared/api/client";

const BASE = `${API_BASE}/research/eval`;

export class ForbiddenError extends Error {}

async function call<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init.headers || {}),
    },
  });
  const raw = await res.text();
  let data: { detail?: string } | null = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }
  if (res.status === 403) throw new ForbiddenError(data?.detail || "Forbidden");
  if (!res.ok) throw new Error(data?.detail || raw || `Request failed with ${res.status}`);
  return data as T;
}

// ── types ────────────────────────────────────────────────────────────────────
export type Mode = "pipeline" | "model_first";

export type BankQuestion = {
  id: string;
  text: string;
  category: string;
  difficulty: string;
  skill: string;
  persona: string;
  behaviour: string;
  tools_any: string[];
  tools_none: string[];
  args: Record<string, unknown>;
  args_absent: string[];
  facts: string[];
  terms: string[][];
  forbid: string[];
  forbid_affirmed: string[];
  forbid_columns: string[];
  setup: string[];
  needs: string[];
  note: string;
};

export type Bank = {
  summary: {
    total: number;
    by_category: Record<string, number>;
    by_difficulty: Record<string, number>;
    by_skill: Record<string, number>;
    by_persona: Record<string, number>;
  };
  vocabulary: {
    categories: string[];
    difficulties: string[];
    skills: string[];
    personas: string[];
    modes: Mode[];
  };
  questions: BankQuestion[];
};

export type BenchModel = {
  id: string;
  name: string;
  owned_by?: string;
  context_window?: number;
  chat: boolean;
  default: boolean;
  note: string;
};

export type ModelStatus = {
  status: string;
  done?: number;
  total?: number;
  tokens?: number;
  note?: string | null;
};

export type Run = {
  run_id: string;
  label?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  finished_at?: string | null;
  project_id: string;
  project_name?: string | null;
  models: string[];
  modes: Mode[];
  question_count: number;
  question_ids: string[];
  model_status: Record<string, ModelStatus>;
  tpm_budget: number;
  error?: string | null;
  cancel_requested: boolean;
};

export type LaneStats = {
  n: number;
  scored: number;
  score: number | null;
  pass_rate: number | null;
  p50_ms: number | null;
  p95_ms: number | null;
  tokens_per_q: number | null;
  model_used_pct: number | null;
  errors: number;
  unscored: number;
  skipped: number;
};

export type LeaderRow = LaneStats & { lane: string; model: string; mode: Mode };

export type QuestionLane = {
  status: string;
  score: number | null;
  passed: boolean | null;
  result_id: string;
  latency_ms: number;
};

export type QuestionRow = {
  question_id: string;
  question: string;
  category: string;
  difficulty: string;
  skill: string;
  persona: string;
  lanes: Record<string, QuestionLane>;
  disagreement: boolean;
};

export type Winner = { model: string; score: number; pass_rate: number | null; tied: string[] };

export type RunDetail = {
  run: Run;
  ground_truth: { facts?: Record<string, unknown>; slots?: Record<string, unknown>; notes?: string[] };
  summary: {
    leaderboard: LeaderRow[];
    breakdown: Record<"category" | "difficulty" | "skill" | "persona", Record<string, Record<string, LaneStats>>>;
    winners: Record<string, Record<string, Winner>>;
    questions: QuestionRow[];
  };
  counts: { results: number; expected: number };
};

export type Check = { name: string; passed: boolean; detail: string; weight: number };

export type Result = {
  result_id: string;
  run_id: string;
  model: string;
  mode: Mode;
  question_id: string;
  question: string;
  category: string;
  difficulty: string;
  skill: string;
  persona: string;
  status: string;
  note?: string | null;
  score: number | null;
  passed: boolean | null;
  behaviour?: string | null;
  checks?: Check[] | null;
  answer?: string | null;
  tier?: string | null;
  route?: string | null;
  intent?: string | null;
  tool_calls?: { tool: string; args: Record<string, unknown>; ok: boolean; rows: number }[] | null;
  caveats?: string[] | null;
  latency_ms: number;
  llm_calls: number;
  prompt_tokens: number;
  completion_tokens: number;
  llm_errors?: string[] | null;
  retries: number;
  created_at: string;
};

export type RunRequest = {
  project_id: string;
  models: string[];
  modes: Mode[];
  categories?: string[];
  difficulties?: string[];
  skills?: string[];
  question_ids?: string[];
  limit?: number;
  tpm_budget?: number;
  label?: string;
};

// ── calls ────────────────────────────────────────────────────────────────────
export const getBank = () => call<Bank>("/bank");
export const getModels = () => call<{ models: BenchModel[] }>("/models");
export const listRuns = () => call<{ runs: Run[]; active: string | null }>("/runs");
export const getRun = (id: string) => call<RunDetail>(`/runs/${id}`);
export const getResults = (id: string, params: { question_id?: string; model?: string; mode?: string } = {}) => {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v) as [string, string][],
  ).toString();
  return call<{ results: Result[] }>(`/runs/${id}/results${qs ? `?${qs}` : ""}`);
};
export const createRun = (body: RunRequest) =>
  call<Run>("/runs", { method: "POST", body: JSON.stringify(body) });
export const cancelRun = (id: string) => call<Run>(`/runs/${id}/cancel`, { method: "POST" });
export const resumeRun = (id: string) => call<Run>(`/runs/${id}/resume`, { method: "POST" });
export const regradeRun = (id: string) =>
  call<{ regraded: number; changed: number }>(`/runs/${id}/regrade`, { method: "POST" });
export const deleteRun = (id: string) => call<{ deleted: string }>(`/runs/${id}`, { method: "DELETE" });

// src/components/EvalDashboard.tsx
import { useState } from "react";
import { useSchedule } from "@/features/projects/ScheduleContext";
import { motion, AnimatePresence } from "framer-motion";
import {
  FlaskConical, Play, Download, CheckCircle2,
  Loader2, Clock, Zap, Target, Hash
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { API_BASE as BACKEND } from "@/shared/api/client";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";

const TEST_QUESTIONS = [
  { id: "cp_01", category: "Critical Path", question: "Show all critical path tasks",                         check_type: "row_count" },
  { id: "cp_02", category: "Critical Path", question: "Which task finishes last on the critical path?",       check_type: "exact_match" },
  { id: "cp_03", category: "Critical Path", question: "How many tasks are on the critical path?",             check_type: "scalar" },
  { id: "wbs_01", category: "WBS",          question: "List all top-level WBS items",                         check_type: "row_count" },
  { id: "wbs_02", category: "WBS",          question: "What are the child tasks under the first WBS group?",  check_type: "row_count" },
  { id: "date_01", category: "Date Filter", question: "Which tasks start in the first month of the project?", check_type: "row_count" },
  { id: "date_02", category: "Date Filter", question: "Show tasks finishing in the last month of the project",check_type: "row_count" },
  { id: "float_01", category: "Float",      question: "Show tasks with zero total float",                     check_type: "row_count" },
  { id: "float_02", category: "Float",      question: "Which tasks have the most total float?",               check_type: "top_n_match" },
  { id: "rel_01", category: "Relationships",question: "What tasks must finish before Excavation can start?",  check_type: "row_count" },
  { id: "rel_02", category: "Relationships",question: "What are the successors of the first task?",           check_type: "row_count" },
  { id: "agg_01", category: "Aggregation",  question: "How many total tasks are in the project?",             check_type: "scalar" },
  { id: "agg_02", category: "Aggregation",  question: "How many WBS groups are there?",                       check_type: "scalar" },
  { id: "llm_01", category: "LLM Reasoning", question: "Give me the five activities with the largest scheduling slack.", check_type: "top_n_match" },
  { id: "llm_02", category: "LLM Reasoning", question: "Which WBS area contains the most activities?",         check_type: "exact_match" },
  { id: "llm_03", category: "LLM Reasoning", question: "How many dependency links exist between activities?", check_type: "scalar" },
];

const MODELS = [
  { id: "groq/llama-3.3-70b-versatile", name: "Llama 3.3 70B", provider: "Groq" },
  { id: "groq/llama-3.1-8b-instant",    name: "Llama 3.1 8B",  provider: "Groq" },
  { id: "groq/openai/gpt-oss-120b",      name: "GPT-OSS 120B",  provider: "Groq" },
  { id: "groq/openai/gpt-oss-20b",       name: "GPT-OSS 20B",   provider: "Groq" },
  { id: "groq/meta-llama/llama-4-scout-17b-16e-instruct", name: "Llama 4 Scout 17B", provider: "Groq Preview" },
  { id: "groq/qwen/qwen3-32b",           name: "Qwen3 32B",     provider: "Groq Preview" },
];

const CATEGORY_COLORS: Record<string, string> = {
  "Critical Path": "text-red-400 bg-red-500/10 border-red-500/20",
  "WBS":           "text-blue-400 bg-blue-500/10 border-blue-500/20",
  "Date Filter":   "text-green-400 bg-green-500/10 border-green-500/20",
  "Float":         "text-amber-400 bg-amber-500/10 border-amber-500/20",
  "Relationships": "text-purple-400 bg-purple-500/10 border-purple-500/20",
  "Aggregation":   "text-teal-400 bg-teal-500/10 border-teal-500/20",
  "LLM Reasoning": "text-fuchsia-400 bg-fuchsia-500/10 border-fuchsia-500/20",
};

// ── Types ────────────────────────────────────────────────────────
type GroundTruthEntry = {
  question: string;
  check_type: string;
  cypher?: string;
  difficulty?: string;
  model_sensitive?: boolean;
  data: any[];
  row_count: number;
  scalar_value: number | null;
  top_names: string[];
  error?: string;
};

type QuestionResult = {
  id: string;
  question: string;
  category: string;
  // accuracy
  accuracy_score: number;
  row_count_score: number;
  value_score: number;
  scalar_score: number | null;
  execution_exact_score: number;
  result_f1_score: number;
  cypher_similarity_score: number | null;
  grade: "A" | "B" | "C" | "F";
  reasons: string[];
  // raw
  passed: boolean;
  has_data: boolean;
  row_count: number;
  gt_count: number | null;
  latency_ms: number;
  error: string;
  response: string;
  cypher: string;
  difficulty: string;
  model_sensitive: boolean;
  cypher_attempts: number;
};

type CategoryScore = {
  passed: number;
  total: number;
  avg_accuracy: number;
};

type ModelResult = {
  model_id: string;
  model_name: string;
  results: QuestionResult[];
  avg_latency: number;
  avg_accuracy: number;
  overall_score: number;
  model_sensitive_accuracy: number;
  execution_exact_rate: number;
  avg_result_f1: number;
  avg_cypher_similarity: number;
  pass_rate: number;
  total_passed: number;
  by_category: Record<string, CategoryScore>;
};

// ── Scoring logic (mirrors backend eval_scorer.py) ───────────────
function scoreAnswer(
  checkType: string,
  gt: GroundTruthEntry,
  aiData: any[],
  aiResponse: string,
  aiCypher: string
): Omit<QuestionResult, "id"|"question"|"category"|"passed"|"has_data"|"row_count"|"gt_count"|"latency_ms"|"error"|"response"|"cypher"|"difficulty"|"model_sensitive"|"cypher_attempts"> {
  const gtCount  = gt.row_count;
  const gtNames  = new Set(gt.top_names ?? []);
  const aiCount  = aiData.length;
  const reasons: string[] = [];

  // 1. Row count score
  let rowCountScore = 0;
  if (gtCount === 0) {
    rowCountScore = aiCount === 0 ? 100 : 0;
  } else {
    rowCountScore = Math.round((Math.min(aiCount, gtCount) / Math.max(aiCount, gtCount)) * 100);
  }
  if (rowCountScore < 50) reasons.push(`row count: got ${aiCount}, expected ${gtCount}`);

  // 2. Value overlap score
  let valueScore = 50;
  if (gtNames.size > 0 && aiData.length > 0) {
    const aiNames = new Set(
      aiData.slice(0, 10)
        .map((r: any) => Object.values(r)[0])
        .filter((v): v is string => typeof v === "string")
    );
    const overlap = [...gtNames].filter(n => aiNames.has(n)).length;
    valueScore = Math.round((overlap / gtNames.size) * 100);
    if (valueScore < 50) reasons.push(`${overlap}/${gtNames.size} expected values matched`);
  } else if (gtCount === 0 && aiCount === 0) {
    valueScore = 100;
  }

  // 3. Scalar score
  let scalarScore: number | null = null;
  if (checkType === "scalar" && gt.scalar_value !== null && gt.scalar_value !== undefined) {
    const gtScalar = Number(gt.scalar_value);

    // Try to read scalar from data first
    let aiScalar: number | null = null;
    if (aiData[0]) {
      const firstVal = Object.values(aiData[0])[0];
      const parsed = Number(firstVal);
      if (!isNaN(parsed)) aiScalar = parsed;
    }

    // Fallback: search response text for the number
    if (aiScalar === null) {
      const nums = (aiResponse || "").match(/\b(\d+)\b/g)?.map(Number) ?? [];
      if (nums.length) {
        aiScalar = nums.reduce((a, b) =>
          Math.abs(a - gtScalar) <= Math.abs(b - gtScalar) ? a : b
        );
      }
    }

    if (aiScalar !== null) {
      if (aiScalar === gtScalar) {
        scalarScore = 100;
      } else {
        const diff = Math.abs(aiScalar - gtScalar) / gtScalar;
        scalarScore = Math.max(0, Math.round((1 - diff) * 100));
        reasons.push(`count: got ${aiScalar}, expected ${gtScalar}`);
      }
    } else {
      scalarScore = 0;
      reasons.push(`could not find count in response, expected ${gtScalar}`);
    }
  }

  const { exact: executionExactScore, f1: resultF1Score } = compareResultSets(gt.data || [], aiData);
  const cypherSimilarityScore = gt.cypher ? similarity(gt.cypher, aiCypher) : null;

  // 4. Weighted final
  let final: number;
  if (checkType === "scalar") {
    final = (scalarScore ?? 0) * 0.6 + rowCountScore * 0.4;
  } else if (checkType === "exact_match") {
    final = valueScore * 0.7 + rowCountScore * 0.3;
  } else if (checkType === "top_n_match") {
    final = valueScore * 0.8 + rowCountScore * 0.2;
  } else {
    final = rowCountScore * 0.5 + valueScore * 0.5;
  }
  // Keep strict row-shape and Cypher similarity as diagnostics only. The final
  // accuracy follows the question's intended check type.
  final = Math.round(final);

  const grade = final >= 90 ? "A" : final >= 75 ? "B" : final >= 50 ? "C" : "F";

  return {
    accuracy_score: final,
    row_count_score: rowCountScore,
    value_score: valueScore,
    scalar_score: scalarScore,
    execution_exact_score: executionExactScore,
    result_f1_score: resultF1Score,
    cypher_similarity_score: cypherSimilarityScore,
    grade,
    reasons,
  };
}

function compareResultSets(gtData: any[], aiData: any[]) {
  const normalize = (row: any) =>
    JSON.stringify(Object.entries(row).sort(([a], [b]) => a.localeCompare(b)));
  const gtRows = new Set((gtData || []).map(normalize));
  const aiRows = new Set((aiData || []).map(normalize));

  if (gtRows.size === 0 && aiRows.size === 0) return { exact: 100, f1: 100 };

  const overlap = [...gtRows].filter((row) => aiRows.has(row)).length;
  const precision = aiRows.size ? overlap / aiRows.size : 0;
  const recall = gtRows.size ? overlap / gtRows.size : 0;
  const f1 = precision + recall ? Math.round((2 * precision * recall / (precision + recall)) * 100) : 0;
  return { exact: gtRows.size === aiRows.size && overlap === gtRows.size ? 100 : 0, f1 };
}

function similarity(a: string, b: string) {
  const left = normalizeText(a);
  const right = normalizeText(b);
  if (!left || !right) return 0;
  const leftTokens = new Set(left.split(" "));
  const rightTokens = new Set(right.split(" "));
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return Math.round((overlap / union) * 100);
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

// ── Component ────────────────────────────────────────────────────
export default function EvalDashboard() {
  const { activeProjectId } = useSchedule();
  const [running, setRunning]           = useState(false);
  const [currentTest, setCurrentTest]   = useState("");
  const [progress, setProgress]         = useState(0);
  const [modelResults, setModelResults] = useState<ModelResult[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>(MODELS.map(m => m.id));
  const [expandedRow, setExpandedRow]   = useState<string | null>(null);

  const categories = [...new Set(TEST_QUESTIONS.map(q => q.category))];

  const toggleModel = (id: string) =>
    setSelectedModels(prev => prev.includes(id) ? prev.filter(m => m !== id) : [...prev, id]);

  // ── Run evaluation ─────────────────────────────────────────────
  const runEval = async () => {
    if (!activeProjectId) return;
    setRunning(true);
    setModelResults([]);
    setProgress(0);

    // Step 1: fetch ground truth once
    let groundTruth: Record<string, GroundTruthEntry> = {};
    try {
      const gtRes = await fetch(`${BACKEND}/eval/ground-truth/${activeProjectId}`);
      groundTruth = await gtRes.json();
    } catch {
      // Ground truth unavailable — scoring will be degraded
    }

    const activeModels = MODELS.filter(m => selectedModels.includes(m.id));
    const totalSteps = activeModels.length * TEST_QUESTIONS.length;
    let step = 0;
    const allResults: ModelResult[] = [];

    for (const model of activeModels) {
      const questionResults: QuestionResult[] = [];

      for (const q of TEST_QUESTIONS) {
        setCurrentTest(`${model.name} — ${q.question}`);
        const t0 = performance.now();

        try {
          const form = new FormData();
          form.append("prompt",     q.question);
          form.append("model",      model.id);
          form.append("project_id", activeProjectId);
          form.append("history",    "[]");

          const res  = await fetch(`${BACKEND}/cypher-agent`, { method: "POST", body: form });
          const data = await res.json();
          const latency  = Math.round(performance.now() - t0);
          const aiData   = Array.isArray(data.data) ? data.data : [];
          const aiResp   = data.response || "";
          const aiCypher = data.cypher || data.query || "";
          const gt       = groundTruth[q.id];

          // Score
          let scored = {
            accuracy_score: 0, row_count_score: 0, value_score: 0,
            scalar_score: null as number | null,
            execution_exact_score: 0,
            result_f1_score: 0,
            cypher_similarity_score: null as number | null,
            grade: "F" as "A"|"B"|"C"|"F",
            reasons: [] as string[],
          };

          if (gt && !gt.error) {
            scored = scoreAnswer(q.check_type, gt, aiData, aiResp, aiCypher);
          } else if (aiData.length > 0) {
            // No ground truth — fall back to has-data check
            scored = {
              accuracy_score: 50,
              row_count_score: 50,
              value_score: 50,
              scalar_score: null,
              execution_exact_score: 0,
              result_f1_score: 50,
              cypher_similarity_score: null,
              grade: "C",
              reasons: ["no ground truth available"],
            };
          }

          questionResults.push({
            id:              q.id,
            question:        q.question,
            category:        q.category,
            accuracy_score:  scored.accuracy_score,
            row_count_score: scored.row_count_score,
            value_score:     scored.value_score,
            scalar_score:    scored.scalar_score,
            execution_exact_score: scored.execution_exact_score,
            result_f1_score: scored.result_f1_score,
            cypher_similarity_score: scored.cypher_similarity_score,
            grade:           scored.grade,
            reasons:         scored.reasons,
            passed:          scored.accuracy_score >= 75,
            has_data:        aiData.length > 0,
            row_count:       aiData.length,
            gt_count:        gt?.row_count ?? null,
            latency_ms:      latency,
            error:           data.error || "",
            response:        aiResp,
            cypher:          aiCypher,
            difficulty:      gt?.difficulty || "standard",
            model_sensitive: Boolean(gt?.model_sensitive),
            cypher_attempts: data.attempts || 1,
          });

        } catch (e: any) {
          questionResults.push({
            id: q.id, question: q.question, category: q.category,
            accuracy_score: 0, row_count_score: 0, value_score: 0,
            scalar_score: null, execution_exact_score: 0, result_f1_score: 0,
            cypher_similarity_score: null, grade: "F", reasons: [e.message],
            passed: false, has_data: false, row_count: 0, gt_count: null,
            latency_ms: Math.round(performance.now() - t0),
            error: e.message, response: "", cypher: "", difficulty: "unknown",
            model_sensitive: q.category === "LLM Reasoning", cypher_attempts: 0,
          });
        }

        step++;
        setProgress(Math.round((step / totalSteps) * 100));
      }

      // Aggregate
      const byCategory: Record<string, CategoryScore> = {};
      for (const r of questionResults) {
        if (!byCategory[r.category]) byCategory[r.category] = { passed: 0, total: 0, avg_accuracy: 0 };
        byCategory[r.category].total++;
        if (r.passed) byCategory[r.category].passed++;
        byCategory[r.category].avg_accuracy += r.accuracy_score;
      }
      for (const cat of Object.keys(byCategory)) {
        byCategory[cat].avg_accuracy = Math.round(
          byCategory[cat].avg_accuracy / byCategory[cat].total
        );
      }

      const totalPassed  = questionResults.filter(r => r.passed).length;
      const avgAccuracy  = Math.round(questionResults.reduce((s, r) => s + r.accuracy_score, 0) / questionResults.length);
      const avgLatency   = Math.round(questionResults.reduce((s, r) => s + r.latency_ms, 0) / questionResults.length);
      const modelSensitive = questionResults.filter((r) => r.model_sensitive);
      const modelSensitiveAccuracy = modelSensitive.length
        ? Math.round(modelSensitive.reduce((s, r) => s + r.accuracy_score, 0) / modelSensitive.length)
        : avgAccuracy;
      const executionExactRate = Math.round(
        questionResults.reduce((s, r) => s + r.execution_exact_score, 0) / questionResults.length
      );
      const avgResultF1 = Math.round(
        questionResults.reduce((s, r) => s + r.result_f1_score, 0) / questionResults.length
      );
      const cypherScores = questionResults
        .map((r) => r.cypher_similarity_score)
        .filter((score): score is number => typeof score === "number");
      const avgCypherSimilarity = cypherScores.length
        ? Math.round(cypherScores.reduce((s, r) => s + r, 0) / cypherScores.length)
        : 0;
      const latencyScore = Math.max(0, Math.min(100, Math.round(100 - avgLatency / 100)));
      const overallScore = Math.round(
        avgAccuracy * 0.45 +
        modelSensitiveAccuracy * 0.25 +
        avgResultF1 * 0.15 +
        executionExactRate * 0.1 +
        latencyScore * 0.05
      );

      allResults.push({
        model_id:     model.id,
        model_name:   model.name,
        results:      questionResults,
        avg_latency:  avgLatency,
        avg_accuracy: avgAccuracy,
        overall_score: overallScore,
        model_sensitive_accuracy: modelSensitiveAccuracy,
        execution_exact_rate: executionExactRate,
        avg_result_f1: avgResultF1,
        avg_cypher_similarity: avgCypherSimilarity,
        pass_rate:    Math.round((totalPassed / questionResults.length) * 100),
        total_passed: totalPassed,
        by_category:  byCategory,
      });

      setModelResults([...allResults]);
    }

    setRunning(false);
    setCurrentTest("");
  };

  // ── Export ─────────────────────────────────────────────────────
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      modelResults.map(m => ({
        Model:              m.model_name,
        "Overall Score":    m.overall_score,
        "Avg Accuracy (%)": m.avg_accuracy,
        "Model-Sensitive Accuracy (%)": m.model_sensitive_accuracy,
        "Execution Exact Rate (%)": m.execution_exact_rate,
        "Avg Result F1 (%)": m.avg_result_f1,
        "Avg Cypher Similarity (%)": m.avg_cypher_similarity,
        "Pass Rate (%)":    m.pass_rate,
        "Tests Passed":     m.total_passed,
        "Total Tests":      TEST_QUESTIONS.length,
        "Avg Latency (ms)": m.avg_latency,
      }))
    ), "Summary");

    // Sheet 2: Per-question detail
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      modelResults.flatMap(m => m.results.map(r => ({
        Model:                m.model_name,
        "Question ID":        r.id,
        Category:             r.category,
        Question:             r.question,
        "Accuracy Score (%)": r.accuracy_score,
        Grade:                r.grade,
        "Row Count Score":    r.row_count_score,
        "Value Overlap Score":r.value_score,
        "Scalar Score":       r.scalar_score ?? "N/A",
        "Execution Exact":     r.execution_exact_score,
        "Result F1":           r.result_f1_score,
        "Cypher Similarity":   r.cypher_similarity_score ?? "N/A",
        Difficulty:            r.difficulty,
        "Model Sensitive":     r.model_sensitive ? "Yes" : "No",
        "AI Row Count":       r.row_count,
        "GT Row Count":       r.gt_count ?? "N/A",
        "Latency (ms)":       r.latency_ms,
        "Cypher Attempts":    r.cypher_attempts,
        "Generated Cypher":    r.cypher,
        "Fail Reasons":       r.reasons.join("; "),
        Error:                r.error,
      })))
    ), "Detail");

    // Sheet 3: Category accuracy
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(
      modelResults.map(m => {
        const row: any = { Model: m.model_name };
        categories.forEach(c => {
          const s = m.by_category[c];
          row[`${c} Accuracy`] = s ? `${s.avg_accuracy}%` : "0%";
          row[`${c} Passed`]   = s ? `${s.passed}/${s.total}` : "0/0";
        });
        return row;
      })
    ), "By Category");

    // Sheet 4: Chart-ready data
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
      ["Category", ...modelResults.map(m => m.model_name)],
      ...categories.map(cat => [
        cat,
        ...modelResults.map(m => m.by_category[cat]?.avg_accuracy ?? 0),
      ]),
    ]), "Chart Data");

    const buf = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    saveAs(new Blob([buf]), `eval_accuracy_${Date.now()}.xlsx`);
  };

  // ── Score badge helper ─────────────────────────────────────────
  const gradeBadge = (score: number) => {
    if (score >= 90) return "bg-green-500/20 text-green-400 border-green-500/20";
    if (score >= 75) return "bg-blue-500/20 text-blue-400 border-blue-500/20";
    if (score >= 50) return "bg-amber-500/20 text-amber-400 border-amber-500/20";
    return "bg-red-500/20 text-red-400 border-red-500/20";
  };

  const gradeLabel = (score: number) =>
    score >= 90 ? "A" : score >= 75 ? "B" : score >= 50 ? "C" : "F";

  const rankedModels = [...modelResults].sort((a, b) => b.overall_score - a.overall_score);
  const bestModel = rankedModels[0];

  // ── Render ─────────────────────────────────────────────────────
  return (
    <motion.div
      className="space-y-6"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-gray-500" />
            Model Evaluation
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {TEST_QUESTIONS.length} questions · {MODELS.length} models · accuracy scored against ground truth
          </p>
        </div>
        <div className="flex gap-2">
          {modelResults.length > 0 && (
            <Button onClick={exportExcel} variant="outline"
              className="bg-transparent border-white/[0.08] text-gray-400 hover:bg-white/[0.04] text-xs">
              <Download className="w-3.5 h-3.5 mr-1.5" />Export Excel
            </Button>
          )}
          <Button onClick={runEval}
            disabled={running || !activeProjectId || selectedModels.length === 0}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-xs">
            {running
              ? <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Running...</>
              : <><Play className="w-3.5 h-3.5 mr-1.5" />Run Evaluation</>}
          </Button>
        </div>
      </div>

      {!activeProjectId && (
        <div className="rounded-xl border border-amber-500/10 bg-amber-500/5 px-4 py-3 text-xs text-amber-400/80">
          Open a project first — evaluation needs a knowledge graph to query against.
        </div>
      )}

      {/* Model selector */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wider">Models to evaluate</p>
        <div className="flex flex-wrap gap-2">
          {MODELS.map(m => (
            <button key={m.id} onClick={() => toggleModel(m.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs transition-colors ${
                selectedModels.includes(m.id)
                  ? "bg-blue-500/10 border-blue-500/20 text-blue-300"
                  : "bg-white/[0.02] border-white/[0.06] text-gray-500"
              }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${selectedModels.includes(m.id) ? "bg-blue-400" : "bg-gray-600"}`} />
              <span className="font-medium">{m.name}</span>
              <span className="text-gray-600">{m.provider}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Test questions */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
        <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wider">
          Test questions ({TEST_QUESTIONS.length})
        </p>
        <div className="grid grid-cols-1 gap-1.5">
          {TEST_QUESTIONS.map(q => (
            <div key={q.id} className="flex items-center gap-3 text-xs">
              <span className={`px-2 py-0.5 rounded border text-[10px] font-medium w-24 text-center flex-shrink-0 ${CATEGORY_COLORS[q.category]}`}>
                {q.category}
              </span>
              <span className="text-gray-400">{q.question}</span>
              <span className="text-[10px] text-gray-600 ml-auto flex-shrink-0">{q.check_type}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Progress */}
      {running && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-400 truncate max-w-[80%]">{currentTest}</span>
            <span className="text-gray-500">{progress}%</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
            <motion.div className="h-full bg-blue-500 rounded-full"
              animate={{ width: `${progress}%` }} transition={{ duration: 0.3 }} />
          </div>
        </div>
      )}

      {/* Results */}
      <AnimatePresence>
        {modelResults.length > 0 && (
          <motion.div className="space-y-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>

            {bestModel && (
              <div className="rounded-xl border border-green-500/20 bg-green-500/[0.04] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-green-400/80 font-semibold">
                      Best model by composite score
                    </p>
                    <h3 className="text-lg font-semibold text-gray-100 mt-1">{bestModel.model_name}</h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Winner uses: 45% average accuracy, 25% LLM-only questions, 15% result F1,
                      10% exact execution, and 5% latency. This avoids ties caused by deterministic routes.
                    </p>
                  </div>
                  <div className="grid grid-cols-5 gap-2 text-center min-w-[520px]">
                    {[
                      ["Overall", bestModel.overall_score],
                      ["LLM cases", bestModel.model_sensitive_accuracy],
                      ["Result F1", bestModel.avg_result_f1],
                      ["Exact exec", bestModel.execution_exact_rate],
                      ["Cypher sim", bestModel.avg_cypher_similarity],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-lg border border-white/[0.06] bg-black/10 px-3 py-2">
                        <div className="text-sm font-bold text-green-300">{value}%</div>
                        <div className="text-[10px] text-gray-500">{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Summary cards */}
            <div className={`grid gap-3 ${modelResults.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
              {modelResults.map(m => (
                <motion.div key={m.model_id}
                  className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>

                  {/* Model name + headline score */}
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <div className="text-sm font-semibold text-gray-200">{m.model_name}</div>
                      <div className="text-[11px] text-gray-500 mt-0.5">{m.model_id}</div>
                    </div>
                    <div className="text-right">
                      <div className={`text-2xl font-bold ${
                        m.overall_score >= 80 ? "text-green-400" :
                        m.overall_score >= 60 ? "text-amber-400" : "text-red-400"
                      }`}>
                        {m.overall_score}%
                      </div>
                      <div className="text-[10px] text-gray-600">overall score</div>
                    </div>
                  </div>

                  {/* Stat row */}
                  <div className="grid grid-cols-4 gap-2 mb-4">
                    {[
                      { icon: Target,       label: "Accuracy",    value: `${m.avg_accuracy}%`,  color: "text-green-400" },
                      { icon: CheckCircle2, label: "LLM cases", value: `${m.model_sensitive_accuracy}%`, color: "text-blue-400" },
                      { icon: Clock,        label: "Avg latency", value: `${m.avg_latency}ms`,  color: "text-purple-400" },
                      { icon: Zap,          label: "Result F1",   value: `${m.avg_result_f1}%`, color: "text-amber-400" },
                    ].map(({ icon: Icon, label, value, color }) => (
                      <div key={label} className="rounded-lg bg-white/[0.03] border border-white/[0.04] p-2.5 text-center">
                        <Icon className={`w-3.5 h-3.5 mx-auto mb-1 ${color}`} />
                        <div className="text-xs font-semibold text-gray-200">{value}</div>
                        <div className="text-[10px] text-gray-600">{label}</div>
                      </div>
                    ))}
                  </div>

                  {/* Category breakdown — now shows accuracy % */}
                  <div className="space-y-1.5">
                    {categories.map(cat => {
                      const s = m.by_category[cat] || { passed: 0, total: 0, avg_accuracy: 0 };
                      return (
                        <div key={cat} className="flex items-center gap-2">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded border w-24 text-center flex-shrink-0 ${CATEGORY_COLORS[cat]}`}>
                            {cat}
                          </span>
                          <div className="flex-1 h-1.5 rounded-full bg-white/[0.06] overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all duration-500 ${
                                s.avg_accuracy >= 80 ? "bg-green-500/70" :
                                s.avg_accuracy >= 60 ? "bg-amber-500/70" : "bg-red-500/70"
                              }`}
                              style={{ width: `${s.avg_accuracy}%` }}
                            />
                          </div>
                          <span className="text-[10px] text-gray-400 w-10 text-right font-medium">
                            {s.avg_accuracy}%
                          </span>
                          <span className="text-[10px] text-gray-600 w-8 text-right">
                            {s.passed}/{s.total}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Question-by-question table */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                <p className="text-xs font-medium text-gray-400">Question-by-question accuracy</p>
                <p className="text-[10px] text-gray-600">
                  A ≥90% · B ≥75% · C ≥50% · F &lt;50% · hover score for breakdown
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/[0.06]">
                      <th className="text-left px-4 py-2.5 text-gray-500 font-medium">Question</th>
                      <th className="text-left px-3 py-2.5 text-gray-500 font-medium">Category</th>
                      {modelResults.map(m => (
                        <th key={m.model_id} className="px-3 py-2.5 text-gray-500 font-medium text-center min-w-[100px]">
                          {m.model_name}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {TEST_QUESTIONS.map(q => (
                      <>
                        <tr
                          key={q.id}
                          className="border-b border-white/[0.04] hover:bg-white/[0.02] cursor-pointer"
                          onClick={() => setExpandedRow(expandedRow === q.id ? null : q.id)}
                        >
                          <td className="px-4 py-2.5 text-gray-300 max-w-[280px]">{q.question}</td>
                          <td className="px-3 py-2.5">
                            <span className={`px-1.5 py-0.5 rounded border text-[10px] ${CATEGORY_COLORS[q.category]}`}>
                              {q.category}
                            </span>
                          </td>
                          {modelResults.map(m => {
                            const r = m.results.find(x => x.id === q.id);
                            return (
                              <td key={m.model_id} className="px-3 py-2.5 text-center">
                                {r ? (
                                  <div className="flex flex-col items-center gap-0.5">
                                    {/* Score badge */}
                                    <span
                                      className={`text-xs font-bold px-2 py-0.5 rounded border ${gradeBadge(r.accuracy_score)}`}
                                      title={[
                                        `Rows: ${r.row_count_score}%`,
                                        `Values: ${r.value_score}%`,
                                        `Result F1: ${r.result_f1_score}%`,
                                        `Exact exec: ${r.execution_exact_score}%`,
                                        r.cypher_similarity_score !== null ? `Cypher: ${r.cypher_similarity_score}%` : null,
                                        r.scalar_score !== null ? `Count: ${r.scalar_score}%` : null,
                                        r.reasons.length ? `Issues: ${r.reasons.join("; ")}` : null,
                                      ].filter(Boolean).join(" · ")}
                                    >
                                      {r.accuracy_score}% {gradeLabel(r.accuracy_score)}
                                    </span>
                                    <span className="text-[10px] text-gray-600">{r.latency_ms}ms</span>
                                    {/* GT vs AI row count */}
                                    {r.gt_count !== null && (
                                      <span className={`text-[9px] ${r.row_count === r.gt_count ? "text-green-600" : "text-amber-600"}`}>
                                        {r.row_count}/{r.gt_count} rows
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <Loader2 className="w-4 h-4 animate-spin text-gray-600 mx-auto" />
                                )}
                              </td>
                            );
                          })}
                        </tr>

                        {/* Expanded detail row */}
                        {expandedRow === q.id && (
                          <tr key={`${q.id}-detail`} className="bg-white/[0.015]">
                            <td colSpan={2 + modelResults.length} className="px-4 py-3">
                              <div className={`grid gap-4 ${modelResults.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
                                {modelResults.map(m => {
                                  const r = m.results.find(x => x.id === q.id);
                                  if (!r) return null;
                                  return (
                                    <div key={m.model_id} className="space-y-1.5">
                                      <div className="text-[11px] font-medium text-gray-400">{m.model_name}</div>

                                      {/* Score breakdown bars */}
                                      <div className="space-y-1">
                                        {[
                                          { label: "Row count",     score: r.row_count_score },
                                          { label: "Value overlap", score: r.value_score },
                                          { label: "Result F1", score: r.result_f1_score },
                                          { label: "Exact execution", score: r.execution_exact_score },
                                          ...(r.cypher_similarity_score !== null ? [{ label: "Cypher similarity", score: r.cypher_similarity_score }] : []),
                                          ...(r.scalar_score !== null ? [{ label: "Count accuracy", score: r.scalar_score }] : []),
                                        ].map(({ label, score }) => (
                                          <div key={label} className="flex items-center gap-2">
                                            <span className="text-[10px] text-gray-600 w-24">{label}</span>
                                            <div className="flex-1 h-1 rounded-full bg-white/[0.06]">
                                              <div className={`h-full rounded-full ${gradeBadge(score).includes("green") ? "bg-green-500/60" : gradeBadge(score).includes("blue") ? "bg-blue-500/60" : gradeBadge(score).includes("amber") ? "bg-amber-500/60" : "bg-red-500/60"}`}
                                                style={{ width: `${score}%` }} />
                                            </div>
                                            <span className="text-[10px] text-gray-500 w-8 text-right">{score}%</span>
                                          </div>
                                        ))}
                                      </div>

                                      {/* Fail reasons */}
                                      {r.reasons.length > 0 && (
                                        <div className="text-[10px] text-amber-400/70 bg-amber-500/5 rounded px-2 py-1">
                                          {r.reasons.map((reason, i) => <div key={i}>• {reason}</div>)}
                                        </div>
                                      )}

                                      {/* AI response preview */}
                                      {r.response && (
                                        <div className="text-[10px] text-gray-600 border border-white/[0.04] rounded px-2 py-1 line-clamp-2">
                                          {r.response}
                                        </div>
                                      )}

                                      {r.error && (
                                        <div className="text-[10px] text-red-400/70 bg-red-500/5 rounded px-2 py-1">
                                          Error: {r.error}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Scoring legend */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-xs text-gray-500 mb-3 font-medium uppercase tracking-wider">How accuracy is calculated</p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-xs text-gray-500">
                <div className="flex items-center gap-2">
                  <Hash className="w-3 h-3 text-gray-600" />
                  <span><span className="text-gray-300">Row count score</span> — AI row count vs ground truth count</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3 h-3 text-gray-600" />
                  <span><span className="text-gray-300">Value overlap</span> — correct task names in top results</span>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="w-3 h-3 text-gray-600" />
                  <span><span className="text-gray-300">Scalar score</span> — exact count/number match (COUNT queries)</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-3 h-3 text-gray-600" />
                  <span><span className="text-gray-300">Final</span> — based on the question check type; Result F1 and Cypher similarity are diagnostics only</span>
                </div>
              </div>
            </div>

          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

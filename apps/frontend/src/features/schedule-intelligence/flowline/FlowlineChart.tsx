import React, { useState } from "react";
import Plot from "react-plotly.js";
import { motion } from "framer-motion";
import { TrendingUp, BarChart3, Layers } from "lucide-react";
import { Button } from "@/shared/ui/button";

interface FlowlineTrace {
  x: (string | null)[];
  y: (string | null)[];
  name: string;
  hovertext: (string | null)[];
  color: string;
  task_count: number;
}

interface TimelineTask {
  name: string;
  start: string;
  finish: string;
  parent: string;
  critical: boolean;
}

interface FlowlineData {
  traces: FlowlineTrace[];
  timeline: TimelineTask[];
  wbs_groups: string[];
  total_tasks: number;
  generated: boolean;
  message?: string;
}

interface FlowlineChartProps {
  flowlineData: FlowlineData | null;
}

const FlowlineChart: React.FC<FlowlineChartProps> = ({ flowlineData }) => {
  const [viewMode, setViewMode] = useState<"flowline" | "gantt">("flowline");

  const renderFlowlineChart = () => {
    if (!flowlineData?.traces?.length) return null;

    const plotData = flowlineData.traces.map((trace) => ({
      x: trace.x,
      y: trace.y,
      type: "scatter" as const,
      mode: "lines+markers" as const,
      name: `${trace.name} (${trace.task_count})`,
      hovertext: trace.hovertext,
      hoverinfo: "text" as const,
      line: { color: trace.color, width: 3 },
      marker: { color: trace.color, size: 6 },
      connectgaps: false,
    }));

    return (
      <Plot
        data={plotData}
        layout={{
          autosize: true,
          height: 600,
          title: {
            text: "Flowline Chart — Tasks by WBS Group",
            font: { size: 16, color: "#1e293b" },
          },
          xaxis: {
            title: "Timeline",
            type: "date",
            gridcolor: "#e2e8f0",
            tickformat: "%b %d, %Y",
          },
          yaxis: {
            title: "WBS Group",
            gridcolor: "#e2e8f0",
            automargin: true,
          },
          plot_bgcolor: "#ffffff",
          paper_bgcolor: "#ffffff",
          legend: {
            orientation: "h",
            y: -0.2,
            font: { size: 10 },
          },
          margin: { l: 200, r: 40, t: 60, b: 80 },
          hovermode: "closest",
        }}
        config={{ responsive: true, displayModeBar: true }}
        style={{ width: "100%" }}
      />
    );
  };

  const renderGanttChart = () => {
    if (!flowlineData?.timeline?.length) return null;

    const tasks = flowlineData.timeline;
    const plotData = [
      {
        type: "scatter" as const,
        mode: "lines" as const,
        name: "Tasks",
        x: tasks.flatMap((t) => (t.critical ? [] : [t.start, t.finish, null])),
        y: tasks.flatMap((t) => (t.critical ? [] : [t.name, t.name, null])),
        line: { color: "#3b82f6", width: 8 },
        hoverinfo: "text" as const,
        hovertext: tasks.flatMap((t) =>
          t.critical
            ? []
            : [
                `${t.name}<br>${t.start} → ${t.finish}<br>Group: ${t.parent}`,
                `${t.name}<br>${t.start} → ${t.finish}<br>Group: ${t.parent}`,
                null,
              ]
        ),
        connectgaps: false,
      },
      {
        type: "scatter" as const,
        mode: "lines" as const,
        name: "Critical Path",
        x: tasks.flatMap((t) => (t.critical ? [t.start, t.finish, null] : [])),
        y: tasks.flatMap((t) => (t.critical ? [t.name, t.name, null] : [])),
        line: { color: "#ef4444", width: 8 },
        hoverinfo: "text" as const,
        hovertext: tasks.flatMap((t) =>
          t.critical
            ? [
                `${t.name}<br>${t.start} → ${t.finish}<br>Group: ${t.parent}<br>CRITICAL`,
                `${t.name}<br>${t.start} → ${t.finish}<br>Group: ${t.parent}<br>CRITICAL`,
                null,
              ]
            : []
        ),
        connectgaps: false,
      },
    ];

    return (
      <Plot
        data={plotData}
        layout={{
          autosize: true,
          height: Math.max(600, tasks.length * 22),
          title: {
            text: "Gantt-style Flowline — All Tasks",
            font: { size: 16, color: "#1e293b" },
          },
          xaxis: {
            title: "Timeline",
            type: "date",
            gridcolor: "#e2e8f0",
            tickformat: "%b %d, %Y",
          },
          yaxis: {
            automargin: true,
            gridcolor: "#f1f5f9",
            tickfont: { size: 9 },
          },
          plot_bgcolor: "#ffffff",
          paper_bgcolor: "#ffffff",
          legend: { orientation: "h", y: -0.1 },
          margin: { l: 250, r: 40, t: 60, b: 60 },
          hovermode: "closest",
        }}
        config={{ responsive: true, displayModeBar: true }}
        style={{ width: "100%" }}
      />
    );
  };

  return (
    <motion.div
      className="space-y-4"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-200 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-gray-500" />
            Flowline Analysis
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {flowlineData?.generated
              ? `${flowlineData.total_tasks} tasks · ${flowlineData.wbs_groups.length} WBS groups`
              : "Location-based scheduling"}
          </p>
        </div>
        {flowlineData?.generated && (
          <div className="flex gap-2">
            <Button
              variant={viewMode === "flowline" ? "default" : "outline"}
              onClick={() => setViewMode("flowline")}
              className={`text-xs ${
                viewMode === "flowline"
                  ? "bg-blue-600 hover:bg-blue-500 text-white"
                  : "bg-transparent border-white/[0.08] text-gray-400 hover:bg-white/[0.04]"
              }`}
            >
              <Layers className="w-3.5 h-3.5 mr-1.5" />
              Flowline
            </Button>
            <Button
              variant={viewMode === "gantt" ? "default" : "outline"}
              onClick={() => setViewMode("gantt")}
              className={`text-xs ${
                viewMode === "gantt"
                  ? "bg-blue-600 hover:bg-blue-500 text-white"
                  : "bg-transparent border-white/[0.08] text-gray-400 hover:bg-white/[0.04]"
              }`}
            >
              <BarChart3 className="w-3.5 h-3.5 mr-1.5" />
              Gantt
            </Button>
          </div>
        )}
      </div>

      {/* Stats */}
      {flowlineData?.generated && (
        <div className="flex gap-3">
          <div className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-gray-400 text-xs">
            {flowlineData.total_tasks} tasks
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-gray-400 text-xs">
            {flowlineData.wbs_groups.length} groups
          </div>
          <div className="px-3 py-1.5 rounded-lg bg-red-500/5 border border-red-500/10 text-red-400/70 text-xs">
            {flowlineData.timeline.filter((t) => t.critical).length} critical
          </div>
        </div>
      )}

      {/* Chart */}
      {flowlineData?.generated ? (
        <motion.div
          className="rounded-xl bg-white p-4 border border-white/[0.06] overflow-x-auto"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
          key={viewMode}
        >
          {viewMode === "flowline" ? renderFlowlineChart() : renderGanttChart()}
        </motion.div>
      ) : (
        <motion.div
          className="flex flex-col items-center justify-center p-16 rounded-xl bg-slate-900 border border-white/[0.06]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        >
          <TrendingUp className="w-10 h-10 text-gray-700 mb-3" />
          <p className="text-sm text-gray-400">
            {flowlineData?.message || "Flowline data not yet available"}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            Upload a schedule to see flowlines
          </p>
        </motion.div>
      )}
    </motion.div>
  );
};

export default FlowlineChart;

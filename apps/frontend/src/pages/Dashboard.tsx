import { useState, useEffect } from "react";
import FileUploader from "@/features/schedule-intelligence/upload/FileUploader";
import ScheduleTable from "@/features/schedule-intelligence/table/ScheduleTable";
import FlowlineChart from "@/features/schedule-intelligence/flowline/FlowlineChart";
import KGViewer from "@/features/schedule-intelligence/graph/KGViewer";
import Sidebar, { visibleGroups } from "@/shared/components/Sidebar";
import TopBar from "@/shared/components/TopBar";
import ProjectOverview from "@/features/projects/ProjectOverview";
import ProjectAccess from "@/features/organization/ProjectAccess";
import { useProjectCapabilities, CAP } from "@/features/shadow-schedule/useProjectCapabilities";
import { useAuth } from "@/shared/context/AuthContext";
import ProjectHub from "@/features/projects/ProjectHub";
import { motion } from "framer-motion";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import * as Papa from "papaparse";
import ChatLayout from "@/features/schedule-intelligence/chat/ChatLayout";
import { useSchedule } from "@/features/projects/ScheduleContext";
import { useOrg } from "@/shared/context/OrgContext";
import { useChatStore } from "@/features/schedule-intelligence/chat/chatStore";
import OrganizationDashboard from "@/features/organization/OrganizationDashboard";
import Profile from "@/features/auth/Profile";
import HealthDashboard from "@/features/schedule-intelligence/health/HealthDashboard";
import ReforecastDashboard from "@/features/schedule-intelligence/reforecast/ReforecastDashboard";
import ShadowDashboard from "@/features/shadow-schedule/ShadowDashboard";
import { getCritical, getFlowline, getProjectTasks, uploadSchedule } from "@/shared/api/client";


const Dashboard = () => {
  const [flowlineData, setFlowlineData] = useState<any>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mode, setMode] = useState<"KG" | "JSON">("KG");
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [graphReady, setGraphReady] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  // Set when the top bar asks for the org screen, which is no longer a
  // project tab and must be reachable with no project open.
  const [showOrg, setShowOrg] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [showUploadWithoutProject, setShowUploadWithoutProject] = useState(false);
  // Set by the onboarding screen, consumed once. A flag rather than a route so a
  // reload does not drop someone back into the welcome state forever.
  const [justOnboarded, setJustOnboarded] = useState(() => {
    try {
      if (localStorage.getItem("syncpro.postOnboarding") === "1") {
        localStorage.removeItem("syncpro.postOnboarding");
        return true;
      }
    } catch {
      /* private mode */
    }
    return false;
  });

  const { activeProjectId, projects, refreshProjects, setActiveProjectId } = useSchedule();
  const { activeOrgId } = useOrg();
  const { user } = useAuth();
  const {
    context: projectCtx,
    can,
    loading: capsLoading,
  } = useProjectCapabilities(activeProjectId);
  const chatStore = useChatStore();

  // Sync chatStore project when activeProjectId changes
  useEffect(() => {
    chatStore.setProject(activeProjectId);
    if (activeProjectId) {
      setShowUploadWithoutProject(false); // Clear flag when project is set
    }
  }, [activeProjectId]);

  useEffect(() => {
    const handler = (event: Event) => {
      const tab = (event as CustomEvent<string>).detail;
      if (tab) setActiveTab(tab);
    };
    window.addEventListener("schedule-assistant:set-tab", handler);
    return () => window.removeEventListener("schedule-assistant:set-tab", handler);
  }, []);

  // Re-fetch data whenever the active project changes
  useEffect(() => {
    if (activeProjectId) {
      fetchAllTasks(activeProjectId);
      fetchCritical(activeProjectId);
      fetchFlowline(activeProjectId);
      setGraphReady(true);
    } else {
      setData([]);
      setFlowlineData(null);
      setGraphReady(false);
    }
  }, [activeProjectId]);

  const fetchAllTasks = async (projectId: string) => {
    try {
      const json = await getProjectTasks(projectId);
      setData(json.tasks || []);
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
    }
  };

  const handleExportExcel = () => {
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "CriticalPath");
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(blob, "critical_path.xlsx");
  };

  const handleExportCSV = () => {
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    saveAs(blob, "critical_path.csv");
  };

  const handleUpload = async () => {
    if (!file) return;
    if (!activeOrgId) {
      console.error("Upload blocked: no active organisation.");
      return;
    }
    setLoading(true);
    try {
      // The project is created into the active org — that binding is what makes
      // every downstream route able to authorize access to it.
      const result = await uploadSchedule(file, activeOrgId);

      if (result.project_id) {
        // Refresh project list and set the new one as active
        await refreshProjects();
        setActiveProjectId(result.project_id);
      }

      setGraphReady(true);
      await fetchCritical(result.project_id);
      await fetchFlowline(result.project_id);
    } catch (e) {
      console.error("Upload failed:", e);
    } finally {
      setLoading(false);
    }
  };

  const fetchCritical = async (projectId?: string) => {
    const pid = projectId || activeProjectId;
    if (!pid) return;
    try {
      const json = await getCritical(pid);
      setData(json.tasks || []);
    } catch (error) {
      console.error("Failed to fetch critical tasks:", error);
    }
  };

  const fetchFlowline = async (projectId?: string) => {
    const pid = projectId || activeProjectId;
    if (!pid) return;
    try {
      const json = await getFlowline(pid);
      setFlowlineData(json);
    } catch (error) {
      console.error("Failed to fetch flowline data:", error);
    }
  };

  // Where someone lands is a decision, not a default (UX_FLOW §4.4). A reporter's
  // whole job is one screen; a planner's day is the queue; everyone else arrives to
  // assess. Chosen once per project, and only after capabilities have loaded so the
  // choice is not made against an empty set.
  const [landedFor, setLandedFor] = useState<string | null>(null);
  useEffect(() => {
    // Guarded on the *resolved context*, not on `loading` — which starts false, so
    // this effect would otherwise run once before the fetch begins, read every
    // capability as absent, and settle on the fallback for everyone.
    if (!activeProjectId || !projectCtx || landedFor === activeProjectId) return;
    const groups = visibleGroups(can);
    const reachable = new Set(groups.flatMap((g) => g.items.map((i) => i.id)));
    let target = "overview";
    if (can(CAP.evidenceSubmit) && !can(CAP.queueAdjudicate)) {
      target = "llm"; // field reporter → the composer
    } else if (can(CAP.queueAdjudicate)) {
      target = "shadow"; // planner → the queue that needs ruling on
    }
    // Never land on something the sidebar will not show.
    setActiveTab(reachable.has(target) ? target : (groups[0]?.items[0]?.id ?? "overview"));
    setLandedFor(activeProjectId);
  }, [activeProjectId, projectCtx, can, landedFor]);

  // Show upload tab when user clicked "Create New" from ProjectHub (before activeProject check)
  if (showUploadWithoutProject && !activeProjectId) {
    return (
      <div className="flex flex-col h-screen bg-slate-950">
        <TopBar
          onOpenProfile={() => setShowProfile(true)}
          onOpenOrg={() => { setShowUploadWithoutProject(false); setShowOrg(true); }}
          onLeaveProject={() => setShowUploadWithoutProject(false)}
        />
        <main className="flex-1 px-8 py-8 overflow-auto">
          <div className="max-w-5xl mx-auto">
            <FileUploader
              file={file}
              setFile={setFile}
              onUpload={handleUpload}
              onExportCSV={handleExportCSV}
              onExportExcel={handleExportExcel}
              onDataUpdate={setData}
              onFlowlineUpdate={setFlowlineData}
              loading={loading}
            />
          </div>
        </main>
      </div>
    );
  }

  // Straight after creating an organisation, show the org rather than the Project
  // Hub. The Hub's dominant control is "New Knowledge Graph", which asks a brand-new
  // admin to upload a programme before their planners even have accounts — and it
  // gives no hint that people, roles or a WhatsApp number exist. Getting the team in
  // is the actual first job. See frontend_docs/UX_FLOW.md §5.1.
  if (justOnboarded) {
    return (
      <div className="flex flex-col h-screen bg-slate-950">
        <TopBar
          onOpenProfile={() => setShowProfile(true)}
          onOpenOrg={() => setJustOnboarded(false)}
          onLeaveProject={() => setJustOnboarded(false)}
        />
        <main className="flex-1 px-8 py-8 overflow-auto">
          <div className="max-w-5xl mx-auto space-y-4">
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/[0.05] px-4 py-3.5 flex items-center justify-between gap-4 flex-wrap">
              <div>
                <p className="text-sm text-blue-100">Your organisation is set up.</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Invite the people who will use it, then upload your first programme.
                </p>
              </div>
              <button
                onClick={() => {
                  setJustOnboarded(false);
                  setShowUploadWithoutProject(true);
                  setActiveTab("upload");
                }}
                className="text-xs px-3 py-2 rounded-lg bg-white/[0.06] border border-white/[0.08] text-gray-200 hover:bg-white/[0.1] transition-colors shrink-0"
              >
                Upload a schedule instead
              </button>
            </div>
            <OrganizationDashboard
              onCreateProject={() => {
                setJustOnboarded(false);
                setShowUploadWithoutProject(true);
                setActiveTab("upload");
              }}
            />
          </div>
        </main>
      </div>
    );
  }

  // Account settings is account-scoped — reachable with no org and no project,
  // and checked before `showOrg` so opening it from the org screen actually
  // leaves that screen rather than rendering underneath it.
  if (showProfile) {
    return (
      <div className="flex flex-col h-screen bg-slate-950">
        <TopBar
          onOpenProfile={() => setShowProfile(true)}
          onOpenOrg={() => {
            setShowProfile(false);
            setShowOrg(true);
          }}
          onLeaveProject={() => setShowProfile(false)}
        />
        <main className="flex-1 px-8 py-8 overflow-auto">
          <div className="max-w-3xl mx-auto">
            <Profile />
          </div>
        </main>
      </div>
    );
  }

  // Organisation is org-scoped, so it is reachable from the top bar whether or not
  // a project is open — the whole point of taking it out of the project sidebar.
  if (showOrg) {
    return (
      <div className="flex flex-col h-screen bg-slate-950">
        <TopBar onOpenProfile={() => setShowProfile(true)} onOpenOrg={() => setShowOrg(true)} onLeaveProject={() => setShowOrg(false)} />
        <main className="flex-1 px-8 py-8 overflow-auto">
          <div className="max-w-5xl mx-auto">
            <OrganizationDashboard
              onCreateProject={() => {
                setShowOrg(false);
                setShowUploadWithoutProject(true);
                setActiveTab("upload");
              }}
            />
          </div>
        </main>
      </div>
    );
  }

  // If no project is selected, show the ProjectHub
  if (!activeProjectId) {
    return (
      <ProjectHub
        onOpenProject={(projectId) => {
          setActiveProjectId(projectId);
          // Deliberately not forced here: the landing effect picks the tab once
          // capabilities for this project have loaded.
          setLandedFor(null);
        }}
        onCreateNew={() => {
          setActiveTab("upload");
          setShowUploadWithoutProject(true);
        }}
      />
    );
  }

  const isChat = activeTab === "llm";

  return (
    <div className="flex flex-col h-screen bg-slate-950">
      <TopBar onOpenProfile={() => setShowProfile(true)} onOpenOrg={() => setShowOrg(true)} onLeaveProject={() => setActiveProjectId(null)} />

      <div className="flex flex-1 min-h-0">
      <Sidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        can={can}
        loading={capsLoading}
      />

      <motion.main
        // Chat runs full-bleed: it is a workspace, not a card on a page, and it
        // manages its own scrolling and reading width. Every other tab keeps the
        // padded, centred column.
        className={
          isChat
            ? "flex-1 min-w-0 min-h-0 overflow-hidden"
            : "flex-1 px-8 py-8 overflow-auto"
        }
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.25 }}
      >
        {isChat ? (
          <ChatLayout />
        ) : (
        <div className="max-w-5xl mx-auto">
          {activeTab === "upload" && (
            <FileUploader
              file={file}
              setFile={setFile}
              onUpload={handleUpload}
              onExportCSV={handleExportCSV}
              onExportExcel={handleExportExcel}
              onDataUpdate={setData}
              onFlowlineUpdate={setFlowlineData}
              loading={loading}
            />
          )}
          {activeTab === "overview" && (
            <ProjectOverview can={can} onNavigate={setActiveTab} />
          )}
          {activeTab === "access" && activeProjectId && (
            <ProjectAccess
              projectId={activeProjectId}
              projectName={projects.find((p) => p.id === activeProjectId)?.name}
              can={can}
              myUserId={user?.id ?? null}
            />
          )}
          {activeTab === "table" && <ScheduleTable data={data} />}
          {activeTab === "health" && <HealthDashboard />}
          {activeTab === "shadow" && <ShadowDashboard />}
          {activeTab === "reforecast" && <ReforecastDashboard />}
          {activeTab === "graph" && (
            <KGViewer mode={mode} setMode={setMode} data={data} graphReady={graphReady} />
          )}
          {activeTab === "flowline" && <FlowlineChart flowlineData={flowlineData} />}
        </div>
        )}
      </motion.main>
      </div>
    </div>
  );
};

export default Dashboard;

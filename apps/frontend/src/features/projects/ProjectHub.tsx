import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  FolderOpen,
  Calendar,
  Trash2,
  ArrowRight,
  BarChart3,
  Clock,
  LogOut,
} from "lucide-react";
import { useSchedule } from "@/features/projects/ScheduleContext";
import { useAuth } from "@/shared/context/AuthContext";
import { useNavigate } from "react-router-dom";

interface ProjectHubProps {
  onOpenProject: (projectId: string) => void;
  onCreateNew: () => void;
}

const ProjectHub: React.FC<ProjectHubProps> = ({ onOpenProject, onCreateNew }) => {
  const { projects, deleteProject, loading } = useSchedule();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const handleLogout = () => {
    logout();
    navigate("/", { replace: true });
  };

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-slate-950/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <BarChart3 className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-semibold text-white tracking-tight">SyncPro</span>
          </div>
          <div className="flex items-center gap-3">
            {user && (
              <>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-gray-400 hover:text-gray-200 hover:bg-white/[0.06] transition-colors text-sm"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign out
                </button>
                <div
                  className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-semibold text-white ring-1 ring-white/10 uppercase"
                  title={user.email}
                >
                  {(user.name || user.email).charAt(0)}
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-6 py-10">
        {/* Page header */}
        <motion.div
          className="mb-10"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          <h1 className="text-2xl font-semibold text-white mb-1">Projects</h1>
          <p className="text-sm text-gray-500">
            Manage your schedule knowledge graphs and project analysis.
          </p>
        </motion.div>

        {/* Create new */}
        <motion.button
          onClick={onCreateNew}
          className="w-full mb-8 group flex items-center gap-4 rounded-xl border border-dashed border-white/10 hover:border-blue-500/40 bg-white/[0.02] hover:bg-blue-500/[0.04] transition-all duration-200 p-5"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.3 }}
        >
          <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
            <Plus className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <div className="text-sm font-medium text-white group-hover:text-blue-300 transition-colors">
              New Knowledge Graph
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              Upload a schedule file (.mpp, .pp, .xml) to create a new project
            </div>
          </div>
        </motion.button>

        {/* Projects list */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          </div>
        ) : projects.length === 0 ? (
          <motion.div
            className="text-center py-20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
          >
            <FolderOpen className="w-10 h-10 text-gray-700 mx-auto mb-3" />
            <p className="text-sm text-gray-400 mb-1">No projects yet</p>
            <p className="text-xs text-gray-600">
              Upload a schedule file to create your first knowledge graph.
            </p>
          </motion.div>
        ) : (
          <div>
            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-4">
              Recent Projects ({projects.length})
            </div>
            <div className="space-y-2">
              <AnimatePresence>
                {projects.map((project, idx) => (
                  <motion.div
                    key={project.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    transition={{ delay: 0.04 * idx, duration: 0.25 }}
                    onMouseEnter={() => setHoveredId(project.id)}
                    onMouseLeave={() => setHoveredId(null)}
                  >
                    <div
                      className="group flex items-center gap-4 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all duration-200 p-4 cursor-pointer"
                      onClick={() => onOpenProject(project.id)}
                    >
                      <div className="w-10 h-10 rounded-lg bg-slate-800 border border-white/[0.06] flex items-center justify-center shrink-0">
                        <FolderOpen className="w-4 h-4 text-gray-400" />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">
                          {project.name}
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Calendar className="w-3 h-3" />
                            {formatDate(project.createdAt)}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Clock className="w-3 h-3" />
                            {project.taskCount} tasks
                          </span>
                          <span className="text-xs text-gray-600 truncate hidden sm:inline">
                            {project.filename}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm(`Delete "${project.name}"?`)) {
                              deleteProject(project.id);
                            }
                          }}
                          className="p-1.5 rounded-md text-gray-600 hover:text-red-400 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                          title="Delete project"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <motion.div
                          className="text-gray-500 group-hover:text-blue-400 transition-colors"
                          animate={{ x: hoveredId === project.id ? 2 : 0 }}
                          transition={{ type: "spring", stiffness: 400 }}
                        >
                          <ArrowRight className="w-4 h-4" />
                        </motion.div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProjectHub;

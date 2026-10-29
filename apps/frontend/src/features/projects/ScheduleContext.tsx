// src/context/ScheduleContext.tsx
import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
import { deleteProject as deleteProjectRequest, getProjects } from "@/shared/api/client";

export type Project = {
  id: string;
  name: string;
  filename: string;
  createdAt: string;
  taskCount: number;
};

type ScheduleContextType = {
  uploadedFile: File | null;
  setUploadedFile: (file: File | null) => void;
  criticalPathData: any[];
  setCriticalPathData: (data: any[]) => void;
  // Project management
  projects: Project[];
  activeProjectId: string | null;
  setActiveProjectId: (id: string | null) => void;
  refreshProjects: () => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  userId: string | null;
  setUserId: (id: string | null) => void;
  loading: boolean;
};

export const ScheduleContext = createContext<ScheduleContextType | null>(null);

export const useSchedule = () => {
  const ctx = useContext(ScheduleContext);
  if (!ctx) throw new Error("useSchedule must be used within ScheduleProvider");
  return ctx;
};

export const ScheduleProvider = ({ children }: { children: React.ReactNode }) => {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [criticalPathData, setCriticalPathData] = useState<any[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const refreshProjects = useCallback(async () => {
    if (!userId) {
      setProjects([]);
      return;
    }
    setLoading(true);
    try {
      // No argument: the backend scopes the list to the caller's own token.
      const data = await getProjects();
      const mapped: Project[] = (data.projects || []).map((p: any) => ({
        id: p.id,
        name: p.name,
        filename: p.filename,
        createdAt: p.createdAt,
        taskCount: p.taskCount,
      }));
      setProjects(mapped);
      // If current active project no longer exists, clear it (don't auto-select)
      if (activeProjectId && !mapped.find((p) => p.id === activeProjectId)) {
        setActiveProjectId(null);
      }
    } catch (err) {
      console.error("Failed to fetch projects:", err);
    } finally {
      setLoading(false);
    }
  }, [userId, activeProjectId]);

  const deleteProject = useCallback(
    async (projectId: string) => {
      try {
        await deleteProjectRequest(projectId);
        await refreshProjects();
      } catch (err) {
        console.error("Failed to delete project:", err);
      }
    },
    [refreshProjects]
  );

  // Fetch projects whenever userId changes
  useEffect(() => {
    if (userId) {
      refreshProjects();
    } else {
      setProjects([]);
      setActiveProjectId(null);
    }
  }, [userId]);

  return (
    <ScheduleContext.Provider
      value={{
        uploadedFile,
        setUploadedFile,
        criticalPathData,
        setCriticalPathData,
        projects,
        activeProjectId,
        setActiveProjectId,
        refreshProjects,
        deleteProject,
        userId,
        setUserId,
        loading,
      }}
    >
      {children}
    </ScheduleContext.Provider>
  );
};

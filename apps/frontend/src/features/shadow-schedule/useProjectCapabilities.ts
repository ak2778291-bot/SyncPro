// What the signed-in user may do on the active project.
//
// The capability set comes from the server (`GET /projects/{id}/context`) and is
// never inferred client-side. Hiding a button is a UX affordance, not access
// control — every capability here is enforced again on the endpoint that uses it,
// so a stale or tampered client can annoy the user but cannot exceed its grant.
import { useCallback, useEffect, useState } from "react";
import { getProjectContext, type ProjectContext } from "@/shared/api/client";

/** Capability names, mirroring `syncpro.core.tenancy.capabilities`. */
export const CAP = {
  projectRead: "project:read",
  scheduleWrite: "schedule:write",
  /** Downloading the programme as a P6/MSPDI file. Deliberately narrower than
   * projectRead — see capabilities.py's note on SCHEDULE_EXPORT. */
  scheduleExport: "schedule:export",
  evidenceSubmit: "evidence:submit",
  queueRead: "queue:read",
  queueReadOwn: "queue:read_own",
  queueAdjudicate: "queue:adjudicate",
  enrollmentManage: "enrollment:manage",
  contractModeSet: "contract_mode:set",
  trustRead: "trust:read",
  trustReadBand: "trust:read_band",
  projectCreate: "project:create",
  projectDelete: "project:delete",
  membersManage: "members:manage",
  orgManage: "org:manage",
} as const;

/** Human labels for the roles a person can hold. Kept beside the capability
 * names because both are read from the same server response. */
export const ORG_ROLE_LABEL: Record<string, string> = {
  owner: "Owner",
  admin: "Admin",
  member: "Member",
};

export const PROJECT_ROLE_LABEL: Record<string, string> = {
  project_admin: "Project admin",
  planner: "Planner",
  field_reporter: "Field reporter",
  viewer: "Viewer",
};

export function useProjectCapabilities(projectId: string | null) {
  const [context, setContext] = useState<ProjectContext | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!projectId) {
      setContext(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setContext(await getProjectContext(projectId));
    } catch (e) {
      setContext(null);
      // A 404 here is the correct answer for a project you are not a member of —
      // it deliberately does not distinguish "no such project" from "not yours".
      setError(e instanceof Error ? e.message : "Could not load project access.");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const can = useCallback(
    (capability: string) => Boolean(context?.capabilities.includes(capability)),
    [context],
  );

  return { context, can, loading, error, refresh };
}

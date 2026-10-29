// What the signed-in user may do at *organisation* scope.
//
// The project-scope equivalent is `useProjectCapabilities`. They are separate
// hooks because they answer different questions against different endpoints: an
// org `member` deliberably holds nothing at project scope, and a `project_admin`
// holds `members:manage` on one project without holding it org-wide. Merging
// them would quietly grant one from the other.
//
// As with project capabilities, the set comes from the server and is never
// inferred client-side — hiding a button is a UX affordance, not access control.
import { useCallback, useEffect, useState } from "react";
import { getOrg, type Org } from "@/shared/api/client";

export function useOrgCapabilities(orgId: string | null) {
  const [org, setOrg] = useState<(Org & { capabilities: string[] }) | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!orgId) {
      setOrg(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setOrg(await getOrg(orgId));
    } catch (e) {
      setOrg(null);
      setError(e instanceof Error ? e.message : "Could not load this organisation.");
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const can = useCallback(
    (capability: string) => Boolean(org?.capabilities.includes(capability)),
    [org],
  );

  return { org, can, loading, error, refresh };
}

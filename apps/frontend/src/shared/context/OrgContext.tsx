// Active organisation + the caller's role in it.
//
// Every project belongs to exactly one org, and a project is created *into* an
// org — so the app needs an active org before an upload can happen at all. A
// signed-in user with no org membership is routed to onboarding rather than shown
// an empty dashboard.
//
// A user with exactly one org never sees a picker: most customers will have one
// org forever and should not be taxed for the multi-org case.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  createOrg as createOrgRequest,
  listOrgs,
  type Org,
} from "@/shared/api/client";
import { useAuth } from "@/shared/context/AuthContext";

const ACTIVE_ORG_KEY = "active_org_id";

type OrgContextType = {
  orgs: Org[];
  activeOrg: Org | null;
  activeOrgId: string | null;
  setActiveOrgId: (id: string) => void;
  createOrg: (input: {
    name: string;
    country?: string;
    industryRole?: string;
    timezone?: string;
    workingWeek?: string;
  }) => Promise<Org>;
  refreshOrgs: () => Promise<void>;
  /** True once the org list has been fetched (or skipped because signed out). */
  isLoaded: boolean;
  /** Signed in but belonging to no organisation — show onboarding. */
  needsOnboarding: boolean;
  error: string | null;
};

const OrgContext = createContext<OrgContextType | null>(null);

export const useOrg = () => {
  const ctx = useContext(OrgContext);
  if (!ctx) throw new Error("useOrg must be used within an OrgProvider");
  return ctx;
};

export const OrgProvider = ({ children }: { children: React.ReactNode }) => {
  const { user, isLoaded: authLoaded } = useAuth();
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setActiveOrgId = useCallback((id: string) => {
    setActiveOrgIdState(id);
    try {
      localStorage.setItem(ACTIVE_ORG_KEY, id);
    } catch {
      /* private mode — the picker just won't persist */
    }
  }, []);

  const refreshOrgs = useCallback(async () => {
    if (!user) {
      setOrgs([]);
      setActiveOrgIdState(null);
      setIsLoaded(true);
      return;
    }
    try {
      const { items } = await listOrgs();
      setOrgs(items);
      setError(null);

      // Keep the remembered org if it is still one the user belongs to,
      // otherwise fall back to the first (which is the only one for most people).
      let remembered: string | null = null;
      try {
        remembered = localStorage.getItem(ACTIVE_ORG_KEY);
      } catch {
        remembered = null;
      }
      const valid = items.find((o) => o.org_id === remembered);
      setActiveOrgIdState(valid ? valid.org_id : items[0]?.org_id ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load organisations.");
      setOrgs([]);
    } finally {
      setIsLoaded(true);
    }
    // Keyed on the user's *id*, not the object — this body only ever checks
    // truthiness. `AuthContext.refreshUser()` (e.g. after email verification)
    // sets a brand-new `user` object with the same id; keying on the whole
    // object made this callback's identity change on every such refresh, which
    // re-fired the mount effect below, flipped `isLoaded` false then true, and
    // remounted whatever screen was reading `needsOnboarding` — resetting
    // OrgOnboarding's step back to "choose" out from under an in-progress form.
  }, [user?.id]);

  useEffect(() => {
    if (!authLoaded) return;
    setIsLoaded(false);
    void refreshOrgs();
  }, [authLoaded, refreshOrgs]);

  const createOrg = useCallback(
    async (input: {
      name: string;
      country?: string;
      industryRole?: string;
      timezone?: string;
      workingWeek?: string;
    }) => {
      const org = await createOrgRequest(input);
      setOrgs((prev) => [...prev, org]);
      setActiveOrgId(org.org_id);
      return org;
    },
    [setActiveOrgId],
  );

  const activeOrg = useMemo(
    () => orgs.find((o) => o.org_id === activeOrgId) ?? null,
    [orgs, activeOrgId],
  );

  const value: OrgContextType = {
    orgs,
    activeOrg,
    activeOrgId,
    setActiveOrgId,
    createOrg,
    refreshOrgs,
    isLoaded,
    needsOnboarding: Boolean(user) && isLoaded && orgs.length === 0,
    error,
  };

  return <OrgContext.Provider value={value}>{children}</OrgContext.Provider>;
};

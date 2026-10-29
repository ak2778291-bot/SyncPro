// First-run screen for a signed-in user who belongs to no organisation.
//
// Organisation comes before project for a reason beyond tidy onboarding: a project
// is created *into* an org, and the WhatsApp Business number that feeds field
// evidence is issued per business account, so the org is the natural owner of the
// ingest channel. A project-first flow would leave that channel unowned.
//
// Two steps rather than one long form. The first asks the only question that can
// send you down a different path — join something that exists, or start something
// new — and the second asks for detail. Putting them on one screen would present
// six fields to someone whose actual answer is "my colleague already set this up".
//
// See `docs/architecture/02_Shadow_Schedule_Engine/frontend_docs/UX_FLOW.md` §5–§7.
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  Check,
  Clock,
  Loader2,
  Mail,
  Plus,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { useOrg } from "@/shared/context/OrgContext";
import { useAuth } from "@/shared/context/AuthContext";
import {
  acceptInvitation,
  cancelMyJoinRequest,
  getMyInvitations,
  getMyJoinRequests,
  getOrgCandidates,
  requestToJoinOrg,
  searchOrgs,
  type OrgCandidate,
  type OrgJoinRequest,
} from "@/shared/api/client";
import VerifyEmailBanner from "@/features/auth/VerifyEmailBanner";
import TopBar from "@/shared/components/TopBar";
import Profile from "@/features/auth/Profile";

const INDUSTRY_ROLES = [
  { value: "gc", label: "General contractor", hint: "You run the site and hold the main contract." },
  { value: "subcontractor", label: "Subcontractor", hint: "You deliver a package for a main contractor." },
  { value: "owner", label: "Owner / developer", hint: "You commissioned the work." },
  { value: "consultant", label: "Consultant / PMC", hint: "You manage or advise on delivery." },
];

// A typo reducer, not a directory: the field stays free text, so a two-person
// subcontractor can still type their own name. Without it, one company arrives as
// "L&T", "L and T" and "Larsen & Toubro" — three organisations that can never be
// merged back together.
const KNOWN_FIRMS = [
  "Larsen & Toubro", "Tata Projects", "Shapoorji Pallonji", "Afcons Infrastructure",
  "Dilip Buildcon", "NCC Limited", "Hindustan Construction Company", "Gammon India",
  "Simplex Infrastructures", "Rites Limited", "Megha Engineering",
  "ARABTEC", "Al Naboodah", "Consolidated Contractors Company", "Nesma & Partners",
  "Bechtel", "Skanska", "Vinci", "Bouygues", "ACS Group", "Balfour Beatty",
  "Turner Construction", "Kiewit", "Fluor", "Lendlease", "Multiplex", "Laing O'Rourke",
];

// Six-day weeks are standard in India and the Gulf; much of the Middle East takes
// Fri–Sat. Every duration, float and "days late" figure depends on this being right.
const WORKING_WEEKS = [
  { value: "mon-sat", label: "Monday – Saturday", hint: "Common in India and South Asia" },
  { value: "mon-fri", label: "Monday – Friday", hint: "Five-day week" },
  { value: "sun-thu", label: "Sunday – Thursday", hint: "Gulf, Friday–Saturday weekend" },
  { value: "sat-thu", label: "Saturday – Thursday", hint: "Gulf, six-day week" },
];

/** The browser already knows this; asking is friction. Editable, never silent. */
function guessTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

function guessCountryFromTz(tz: string): string {
  const map: Record<string, string> = {
    "Asia/Kolkata": "IN", "Asia/Calcutta": "IN", "Asia/Dubai": "AE",
    "Asia/Riyadh": "SA", "Asia/Qatar": "QA", "Asia/Karachi": "PK",
    "Europe/London": "GB", "America/New_York": "US", "America/Chicago": "US",
    "America/Los_Angeles": "US", "Australia/Sydney": "AU", "Asia/Singapore": "SG",
  };
  return map[tz] ?? "";
}

/** A single-line text input inside a `<form>` submits on Enter by default —
 * fine for a login form, wrong here: creating an organisation is a hard
 * action to undo (no merge feature exists), and the fields before the submit
 * button are largely pre-filled guesses the person may never have actually
 * looked at. Pressing Enter while typing the company name should never be
 * the thing that creates it — only an explicit click (or Enter while the
 * button itself has focus, which stays the normal, expected behavior). */
function blockEnterSubmit(e: React.KeyboardEvent<HTMLInputElement>) {
  if (e.key === "Enter") e.preventDefault();
}

type Step = "choose" | "details";

export default function OrgOnboarding() {
  const { createOrg, refreshOrgs, setActiveOrgId } = useOrg();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>("choose");
  // Account settings, reachable before you belong to anywhere — this is
  // exactly where a typo'd display name or an auto-assigned handle from a
  // just-created account wants fixing, and the org screen that normally hosts
  // it is unreachable until an org exists.
  const [showProfile, setShowProfile] = useState(false);
  const [invites, setInvites] = useState<
    Array<{ invitation_id: string; org_name: string | null; org_role: string; token?: string }>
  >([]);
  const [invitesLoading, setInvitesLoading] = useState(true);

  // Domain discovery (UX_FLOW §7): orgs this account might already belong to,
  // by email domain, and any request already in flight — fetched separately
  // from invitations because they answer different questions ("someone
  // offered you access" vs. "we noticed you might belong here already") and
  // fail independently without either blocking the other.
  const [candidates, setCandidates] = useState<OrgCandidate[]>([]);
  const [myRequests, setMyRequests] = useState<OrgJoinRequest[]>([]);
  const [candidatesLoading, setCandidatesLoading] = useState(true);
  const [requestBusy, setRequestBusy] = useState<string | null>(null);

  // Search by name — the way in when the domain nudge above cannot fire
  // (personal email, or nobody from your company has verified yet).
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OrgCandidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);

  const tz = useMemo(guessTimezone, []);
  const [name, setName] = useState("");
  const [industryRole, setIndustryRole] = useState("gc");
  const [country, setCountry] = useState(() => guessCountryFromTz(guessTimezone()));
  const [timezone, setTimezone] = useState(tz);
  const [workingWeek, setWorkingWeek] = useState(() =>
    guessCountryFromTz(guessTimezone()) === "IN" ? "mon-sat" : "mon-fri",
  );
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Someone may have been invited and never opened the link. Showing it here means
  // joining does not depend on them still having the message.
  useEffect(() => {
    let cancelled = false;
    getMyInvitations()
      .then((d) => !cancelled && setInvites(d.items ?? []))
      .catch(() => !cancelled && setInvites([]))
      .finally(() => !cancelled && setInvitesLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const accept = async (token: string) => {
    setLoading(true);
    setError("");
    try {
      await acceptInvitation(token);
      await refreshOrgs();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not accept that invitation.");
    } finally {
      setLoading(false);
    }
  };

  // Deliberately keyed on verification status, not just mount: the server
  // returns no candidates at all for an unverified viewer (an unverified
  // address is not evidence of anything — UX_FLOW §7 rule 2), so someone who
  // verifies *while sitting on this screen* needs a re-fetch to ever see a
  // real match, not just an empty list frozen from before they verified.
  useEffect(() => {
    let cancelled = false;
    setCandidatesLoading(true);
    Promise.all([getOrgCandidates(), getMyJoinRequests()])
      .then(([c, r]) => {
        if (cancelled) return;
        setCandidates(c.items ?? []);
        setMyRequests(r.items ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setCandidates([]);
          setMyRequests([]);
        }
      })
      .finally(() => !cancelled && setCandidatesLoading(false));
    return () => {
      cancelled = true;
    };
  }, [user?.email_verified]);

  // Debounced: one request per pause in typing, not one per keystroke. The
  // server ignores anything under 2 characters, so short queries never leave
  // the browser at all.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearched(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const t = window.setTimeout(() => {
      searchOrgs(q)
        .then((r) => !cancelled && setResults(r.items ?? []))
        .catch(() => !cancelled && setResults([]))
        .finally(() => {
          if (!cancelled) {
            setSearching(false);
            setSearched(true);
          }
        });
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query]);

  const requestToJoin = async (orgId: string) => {
    setRequestBusy(orgId);
    setError("");
    try {
      const req = await requestToJoinOrg(orgId);
      setMyRequests((prev) => [req, ...prev.filter((r) => r.org_id !== orgId)]);
      // Clear the search once a request is in flight — the pending-request
      // panel above now represents this org, and leaving it in both places
      // would show the same org twice in two different states.
      setQuery("");
      setResults([]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send that request.");
    } finally {
      setRequestBusy(null);
    }
  };

  const cancelRequest = async (requestId: string) => {
    setRequestBusy(requestId);
    setError("");
    try {
      await cancelMyJoinRequest(requestId);
      setMyRequests((prev) => prev.filter((r) => r.request_id !== requestId));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not cancel that request.");
    } finally {
      setRequestBusy(null);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Mirrors the submit button's own `disabled` condition — never trust that
    // alone, since Enter inside a form field submits regardless of a button's
    // disabled state. Timezone and country are required here, not just
    // cosmetically: both are load-bearing for the shadow-schedule engine (see
    // the comments on the fields below), so a blank one should never reach
    // `createOrg` even if some future change loosens the button's guard.
    if (!name.trim() || !timezone.trim() || !country.trim()) return;
    setError("");
    setLoading(true);
    try {
      const org = await createOrg({
        name: name.trim(),
        country: country.trim().toUpperCase(),
        industryRole,
        timezone,
        workingWeek,
      });
      setActiveOrgId(org.org_id);
      // OrgContext sets the new org active; the dashboard renders on the next pass
      // and lands on Organisation → People (see UX_FLOW §5.1) rather than an
      // empty file uploader.
      try {
        localStorage.setItem("syncpro.postOnboarding", "1");
      } catch {
        /* private mode — the landing hint is a nicety, not a requirement */
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create the organisation.");
    } finally {
      setLoading(false);
    }
  };

  // The bar is `minimal` here on purpose: there is no organisation and no
  // project yet, so the breadcrumb would have nothing to say. What it does
  // carry is the account menu — without it, someone who signed up with the
  // wrong Google account has no way to sign out and start over.
  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col">
      <TopBar minimal onOpenProfile={() => setShowProfile(true)} />
      <div className="flex-1 flex items-center justify-center px-6 py-10 relative">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[40rem] h-[40rem] rounded-full bg-blue-600/[0.07] blur-3xl" />
        </div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="relative w-full max-w-lg"
        >
          {children}
        </motion.div>
      </div>
    </div>
  );

  if (showProfile) {
    return shell(
      <>
        <button
          onClick={() => setShowProfile(false)}
          className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 mb-4 transition-colors"
        >
          <ArrowLeft className="w-3 h-3" /> Back to setup
        </button>
        <Profile />
      </>,
    );
  }

  // ── Step 1: join something that exists, or start something new ──────────────
  if (step === "choose") {
    return shell(
      <>
        <div className="text-center mb-7">
          <div className="w-11 h-11 rounded-xl bg-blue-600 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-2xl font-semibold mb-1.5">
            Welcome{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
          </h1>
          <p className="text-sm text-gray-400">
            Projects belong to a company. Join yours, or set it up.
          </p>
        </div>

        {error && (
          <div className="text-xs text-red-300 bg-red-500/[0.06] border border-red-500/20 rounded-lg px-3 py-2 mb-3">
            {error}
          </div>
        )}

        {invitesLoading ? (
          <div className="flex items-center justify-center py-6 text-gray-600 text-xs">
            <Loader2 className="w-3.5 h-3.5 animate-spin mr-2" /> Checking for invitations…
          </div>
        ) : invites.length > 0 ? (
          <div className="space-y-2 mb-4">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <Mail className="w-3 h-3" /> You have been invited
            </p>
            {invites.map((inv) => (
              <button
                key={inv.invitation_id}
                disabled={loading || !inv.token}
                onClick={() => inv.token && void accept(inv.token)}
                className="w-full text-left rounded-xl border border-blue-500/25 bg-blue-500/[0.06] hover:bg-blue-500/[0.1] transition-colors px-4 py-3.5 flex items-center justify-between gap-3 disabled:opacity-60"
              >
                <div className="min-w-0">
                  <p className="text-sm text-gray-100 truncate">
                    {inv.org_name ?? "An organisation"}
                  </p>
                  <p className="text-[11px] text-gray-400">Join as {inv.org_role}</p>
                </div>
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin text-blue-300 shrink-0" />
                ) : (
                  <Check className="w-4 h-4 text-blue-300 shrink-0" />
                )}
              </button>
            ))}
          </div>
        ) : null}

        {/* Domain discovery (UX_FLOW §7): a request, never an auto-join — the
            org's admin still decides. Shown only once invitations and
            candidates have both had a chance to load, so it doesn't flash
            the generic fallback hint before the real match arrives. */}
        {!invitesLoading && !candidatesLoading && myRequests.length > 0 && (
          <div className="space-y-2 mb-4">
            <p className="text-[11px] text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
              <Clock className="w-3 h-3" /> Waiting on a decision
            </p>
            {myRequests.map((req) => (
              <div
                key={req.request_id}
                className="w-full rounded-xl border border-amber-500/20 bg-amber-500/[0.05] px-4 py-3.5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-gray-100 truncate">{req.org_name ?? "An organisation"}</p>
                  <p className="text-[11px] text-gray-400">
                    Request sent — an admin there needs to approve it
                  </p>
                </div>
                <button
                  onClick={() => void cancelRequest(req.request_id)}
                  disabled={requestBusy === req.request_id}
                  title="Cancel request"
                  className="p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50 shrink-0"
                >
                  {requestBusy === req.request_id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <X className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}

        {!invitesLoading &&
          !candidatesLoading &&
          candidates
            .filter((c) => !myRequests.some((r) => r.org_id === c.org_id))
            .map((c) => (
              <div
                key={c.org_id}
                className="mb-3 rounded-xl border border-blue-500/25 bg-blue-500/[0.06] px-4 py-3.5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-sm text-gray-100 truncate">
                    {c.member_count} {c.member_count === 1 ? "person" : "people"} at your company
                    already use SyncPro
                  </p>
                  <p className="text-[11px] text-gray-400 truncate">under {c.org_name}</p>
                </div>
                <Button
                  onClick={() => void requestToJoin(c.org_id)}
                  disabled={requestBusy === c.org_id}
                  className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white text-xs"
                >
                  {requestBusy === c.org_id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    "Request to join"
                  )}
                </Button>
              </div>
            ))}

        {/* Search by name — the path in when the domain nudge cannot fire.
            A personal Gmail is the norm for site staff and subcontractors in
            India and the GCC, so "no domain match" is the common case here,
            not the edge case. Deliberately a search box and not a list of
            every organisation: you find the company you already know you
            work for, rather than browsing SyncPro's customer base. */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-4 py-3.5 space-y-2.5">
          <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
            <Users className="w-3 h-3" /> Already using SyncPro at your company?
          </p>
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for your company by name"
          />

          {searching && (
            <p className="text-[10px] text-gray-600 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> Searching…
            </p>
          )}

          {!searching &&
            results
              .filter((r) => !myRequests.some((m) => m.org_id === r.org_id))
              .map((r) => (
                <div
                  key={r.org_id}
                  className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs text-gray-100 truncate">{r.org_name}</p>
                    <p className="text-[10px] text-gray-500">
                      {r.member_count} {r.member_count === 1 ? "member" : "members"}
                    </p>
                  </div>
                  <Button
                    onClick={() => void requestToJoin(r.org_id)}
                    disabled={requestBusy === r.org_id}
                    className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white text-xs"
                  >
                    {requestBusy === r.org_id ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      "Request to join"
                    )}
                  </Button>
                </div>
              ))}

          {!searching && searched && results.length === 0 && (
            <p className="text-[10px] text-gray-600">
              No organisation matches that name. Check the spelling, or set one up below —
              creating a second organisation for a company that already has one splits your
              projects and cannot be undone.
            </p>
          )}

          {!query.trim() && (
            <p className="text-[10px] text-gray-600">
              Requesting sends an approval to that organisation's admin — you don't get
              access until they say yes.
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 my-4">
          <div className="h-px flex-1 bg-white/[0.06]" />
          <span className="text-[10px] text-gray-600">or</span>
          <div className="h-px flex-1 bg-white/[0.06]" />
        </div>

        <button
          onClick={() => setStep("details")}
          className="w-full text-left rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] transition-colors px-4 py-3.5 flex items-center justify-between gap-3"
        >
          <div>
            <p className="text-sm text-gray-100 flex items-center gap-2">
              <Plus className="w-3.5 h-3.5 text-gray-500" />
              Set up a new organisation
            </p>
            <p className="text-[11px] text-gray-500 mt-0.5">
              You become its owner and can invite your team.
            </p>
          </div>
        </button>
      </>,
    );
  }

  // ── Step 2: the details the engine actually needs ───────────────────────────
  return shell(
    <>
      <button
        onClick={() => setStep("choose")}
        className="text-xs text-gray-500 hover:text-gray-300 flex items-center gap-1 mb-4 transition-colors"
      >
        <ArrowLeft className="w-3 h-3" /> Back
      </button>

      <h1 className="text-2xl font-semibold mb-1.5">Your organisation</h1>
      <p className="text-sm text-gray-400 mb-6">
        This is the company your projects and your team belong to.
      </p>

      {/* Creating an org is exactly what verification gates, so the prompt belongs
          on the step that will be refused — not buried in account settings. */}
      <div className="mb-5">
        <VerifyEmailBanner />
      </div>

      {/* Reachable here too, not just on the "choose" step: someone who
          arrived unverified and clicked straight into "set up a new
          organisation" only gets a real candidate list *after* verifying,
          which can happen on this screen via the banner above. Without this,
          that path never sees the nudge at all. */}
      {!candidatesLoading &&
        candidates
          .filter((c) => !myRequests.some((r) => r.org_id === c.org_id))
          .map((c) => (
            <div
              key={c.org_id}
              className="mb-5 rounded-xl border border-blue-500/25 bg-blue-500/[0.06] px-4 py-3.5 flex items-center justify-between gap-3"
            >
              <div className="min-w-0">
                <p className="text-sm text-gray-100 truncate">
                  {c.member_count} {c.member_count === 1 ? "person" : "people"} at your company
                  already use SyncPro, under {c.org_name}
                </p>
                <p className="text-[11px] text-gray-400">
                  Joining them keeps everyone on one set of projects
                </p>
              </div>
              <Button
                onClick={() => void requestToJoin(c.org_id)}
                disabled={requestBusy === c.org_id}
                className="shrink-0 bg-blue-600 hover:bg-blue-500 text-white text-xs"
              >
                {requestBusy === c.org_id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  "Request to join instead"
                )}
              </Button>
            </div>
          ))}

      <form onSubmit={submit} className="space-y-5">
        <div className="space-y-1.5">
          <label className="text-xs text-gray-400">Company name</label>
          <Input
            list="known-firms"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={blockEnterSubmit}
            placeholder="e.g. Larsen & Toubro"
            required
            autoFocus
          />
          <datalist id="known-firms">
            {KNOWN_FIRMS.map((f) => (
              <option key={f} value={f} />
            ))}
          </datalist>
          <p className="text-[10px] text-gray-600">
            Don't see your company? Just type its name — the list is only suggestions,
            not a restriction.
          </p>
        </div>

        <div className="space-y-1.5">
          <label className="text-xs text-gray-400">What you do</label>
          <div className="grid grid-cols-2 gap-2">
            {INDUSTRY_ROLES.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setIndustryRole(r.value)}
                className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
                  industryRole === r.value
                    ? "border-blue-500/40 bg-blue-500/10"
                    : "border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04]"
                }`}
              >
                <span
                  className={`block text-xs ${
                    industryRole === r.value ? "text-blue-200" : "text-gray-300"
                  }`}
                >
                  {r.label}
                </span>
              </button>
            ))}
          </div>
          <p className="text-[10px] text-gray-600">
            {INDUSTRY_ROLES.find((r) => r.value === industryRole)?.hint}
          </p>
        </div>

        {/* Not cosmetic. Field reports carry a capture time and the out-of-order
            gate compares timestamps, so a wrong zone silently mis-orders same-day
            reports. Durations and float depend on the working week. */}
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 space-y-3">
          <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
            <Clock className="w-3 h-3" /> Site calendar
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-500">Timezone</label>
              <Input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                onKeyDown={blockEnterSubmit}
                placeholder="Asia/Kolkata"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] text-gray-500">Country</label>
              <Input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                onKeyDown={blockEnterSubmit}
                placeholder="IN"
                maxLength={2}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] text-gray-500">Working week</label>
            <select
              value={workingWeek}
              onChange={(e) => setWorkingWeek(e.target.value)}
              className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-gray-200 px-3 py-2 focus:outline-none focus:border-blue-500/50"
            >
              {WORKING_WEEKS.map((w) => (
                <option key={w.value} value={w.value} className="bg-slate-900">
                  {w.label} — {w.hint}
                </option>
              ))}
            </select>
          </div>

          <p className="text-[10px] text-gray-600">
            A report saying "done this morning" needs a timezone to be placed on the
            programme, and float depends on which days are worked. Both are editable later.
          </p>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <Button
          type="submit"
          disabled={loading || !name.trim() || !timezone.trim() || !country.trim()}
          className="w-full"
        >
          {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
          Create organisation
        </Button>
        <p className="text-[10px] text-gray-600 text-center">
          You will be its owner. Next you can invite your team or upload a schedule.
        </p>
      </form>
    </>,
  );
}

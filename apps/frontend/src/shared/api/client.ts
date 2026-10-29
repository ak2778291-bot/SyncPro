import type { ChatMessage } from "@/features/schedule-intelligence/chat/chatStore";

const BACKEND = import.meta.env.VITE_BACKEND_API || "http://localhost:8000";

/** Backend base URL — import this instead of re-reading import.meta.env per feature. */
export const API_BASE = BACKEND;

export type ModelInfo = {
  id: string;
  name: string;
  provider: string;
};

export type Project = {
  id: string;
  name: string;
  filename: string;
  createdAt: string;
  taskCount: number;
};

// ---------------- Agent v2 ----------------
// The backend answers in the v1 shape with these alongside, so this file can
// describe both without the two having to ship together.

/** Which rung of the coverage ladder answered. T1-T3 are computed from the
 * schedule, T5 is a definition, T6 is judgement, T7 is an honest refusal. */
export type AnswerTier = "T1" | "T2" | "T3" | "T4" | "T5" | "T6" | "T7";

export type BlockType =
  | "paragraph" | "table" | "metric_row" | "flag_card" | "whatif_card"
  | "activity_card" | "clarification" | "suggestions" | "cypher" | "error";

export type AnswerBlock = {
  type: BlockType;
  text?: string;
  title?: string;
  rows?: Record<string, unknown>[];
  columns?: string[];
  items?: Record<string, unknown>[];
  meta?: Record<string, unknown>;
};

export type AnswerCitation = {
  id: number;
  kind: "row" | "flag" | "event" | "quote" | "tool";
  ref: string;
  label?: string;
  tool?: string;
};

export type AnswerConfidence = {
  route: "fast_path" | "tool_plan" | "generated_cypher" | "knowledge" | "clarify" | "declined";
  score: number;
  verified: boolean;
  checks?: Record<string, boolean>;
};

export type ToolCallRecord = {
  tool: string;
  args?: Record<string, unknown>;
  ok: boolean;
  row_count: number;
  duration_ms: number;
  error?: string;
};

export type AnswerEvidence = {
  project_id?: string | null;
  intent?: string | null;
  slots?: Record<string, unknown>;
  tool_calls?: ToolCallRecord[];
  cypher?: string | null;
  as_of?: string | null;
  as_of_is_data_date?: boolean | null;
};

export type ClarificationOption = {
  label: string;
  value: string;
  detail?: string | null;
  score?: number | null;
};

export type AgentClarification = {
  kind: "referent" | "scope" | "intent";
  question: string;
  slot: string;
  options: ClarificationOption[];
  allow_none: boolean;
  /** What the agent will do if you ignore the chips and just ask again. */
  assumption?: string | null;
};

/** What the agent is doing right now. Rendered live while the answer builds. */
export type AgentStatus = {
  stage: "understanding" | "checking" | "planning" | "running" | "tool" | "drafting" | "verifying" | "explaining";
  tool?: string;
  tools?: string[];
  rows?: number;
  ok?: boolean;
};

export type TurnState = {
  bound?: Record<string, unknown>;
  last_intent?: string | null;
  last_activity_uid?: string | null;
  /** The activity's name, so a follow-up ("and its successors?") can be read by a model. */
  last_activity_name?: string | null;
  /** The last few turns, trimmed by the server. Sent back verbatim; never edited here. */
  history?: { q: string; a: string }[];
};

export type ChatAgentResponse = {
  answer?: string;
  response?: string;
  tableData?: Record<string, unknown>[];
  data?: Record<string, unknown>[];
  cypher?: string;
  query?: string;
  suggestions?: string[];
  followUpQuestions?: string[];
  error?: string;
  fallback?: string;
  // v2 — absent when the backend is running the v1 engine.
  blocks?: AnswerBlock[];
  tier?: AnswerTier;
  tierMeaning?: string;
  citations?: AnswerCitation[];
  evidence?: AnswerEvidence;
  confidence?: AnswerConfidence;
  caveats?: string[];
  clarification?: AgentClarification | null;
  turnState?: TurnState;
};

export type ChatSessionDto = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt?: string;
  messages: ChatMessage[];
  memorySummary?: string;
};

// ---------------- Auth ----------------
export type AuthUser = {
  id: string;
  email: string;
  /** Public handle. Null only for accounts created before handles existed and
   * not yet backfilled. */
  username: string | null;
  /** Gates creating an organisation and (later) domain discovery — never sign-in. */
  email_verified: boolean;
  name: string;
  provider: "credentials" | "google";
};

export type AuthResponse = { token: string; user: AuthUser };

export async function signup(input: {
  email: string;
  password: string;
  name?: string;
  username?: string;
}) {
  return postJson<AuthResponse>("/auth/signup", {
    email: input.email,
    password: input.password,
    name: input.name ?? "",
    username: input.username ?? "",
  });
}

/** `identifier` is an email or a username — the server tells them apart by the
 * presence of "@", since a handle cannot contain one. */
export async function login(input: { identifier: string; password: string }) {
  return postJson<AuthResponse>("/auth/login", input);
}

export async function googleLogin(credential: string) {
  return postJson<AuthResponse>("/auth/google", { credential });
}

/** Ask for a fresh six-digit code, emailed to the account. */
export async function requestEmailCode() {
  return postForm<{ sent: boolean; expires_in_minutes: number }>(
    "/auth/verify/request",
    new FormData(),
  );
}

export async function confirmEmailCode(code: string) {
  return postJson<{ verified: boolean; already: boolean }>("/auth/verify/confirm", { code });
}

/** Unauthenticated by design — a forgotten password is, definitionally, something
 * that happens while signed out. The response never reveals whether `email`
 * has an account, and never returns the code — it's emailed, or not sent. */
export async function requestPasswordReset(email: string) {
  return postJson<{ message: string; expires_in_minutes: number }>(
    "/auth/reset/request",
    { email },
  );
}

export async function confirmPasswordReset(email: string, code: string, newPassword: string) {
  return postJson<{ reset: boolean }>("/auth/reset/confirm", {
    email,
    code,
    new_password: newPassword,
  });
}

export async function getMe() {
  return getJson<{ user: AuthUser }>("/auth/me");
}

/** Change display name and/or handle. Omit a field to leave it untouched —
 * the two save independently. */
export async function updateProfile(fields: { name?: string; username?: string }) {
  return patchJson<{ user: AuthUser }>("/auth/me", fields);
}

/** Change password while signed in. Requires the current one: a session
 * proves a live login, not that the person at the keyboard owns the account.
 * 409s for Google-only accounts, which have no password to change. */
export async function changePassword(currentPassword: string, newPassword: string) {
  return postJson<{ changed: boolean }>("/auth/password", {
    current_password: currentPassword,
    new_password: newPassword,
  });
}

// ---------------- Organizations (tenancy) ----------------
export type OrgRole = "owner" | "admin" | "member";
// `field_reporter` is a site engineer with a login: submits progress, rules on
// nothing. Not the same thing as an enrolled WhatsApp reporter, which is a phone
// number with no account at all (arch §6.5).
export type ProjectRole = "project_admin" | "planner" | "field_reporter" | "viewer";

export type Org = {
  org_id: string;
  name: string;
  slug: string;
  country: string | null;
  industry_role: string | null;
  /** IANA zone. Field-report timestamps are placed on the programme with this. */
  timezone: string | null;
  /** Which days are worked — durations and float depend on it. */
  working_week: string | null;
  wa_phone_number_id: string | null;
  wa_display_number: string | null;
  data_contribution_rights_accepted: boolean;
  org_role: OrgRole;
};

/** Orgs the caller belongs to. An empty list means "route to onboarding", not
 * "show an empty dashboard" — a signed-in user must always land somewhere. */
export async function listOrgs() {
  return getJson<{ items: Org[] }>("/orgs");
}

export async function createOrg(input: {
  name: string;
  country?: string;
  industryRole?: string;
  timezone?: string;
  workingWeek?: string;
}) {
  const form = new FormData();
  form.append("name", input.name);
  if (input.country) form.append("country", input.country);
  if (input.industryRole) form.append("industry_role", input.industryRole);
  if (input.timezone) form.append("timezone", input.timezone);
  if (input.workingWeek) form.append("working_week", input.workingWeek);
  return postForm<Org>("/orgs", form);
}

export async function getOrgProjects(orgId: string) {
  return getJson<{ items: Array<{ project_id: string; name: string; org_id: string }> }>(
    `/orgs/${orgId}/projects`,
  );
}

export type OrgMember = {
  org_id: string;
  user_id: string;
  org_role: OrgRole;
  email: string | null;
  name: string | null;
  joined_at: string | null;
};

export async function listOrgMembers(orgId: string) {
  return getJson<{ items: OrgMember[] }>(`/orgs/${orgId}/members`);
}

export async function addOrgMember(orgId: string, email: string, orgRole: OrgRole) {
  const form = new FormData();
  form.append("email", email);
  form.append("org_role", orgRole);
  return postForm<OrgMember>(`/orgs/${orgId}/members`, form);
}

export async function setOrgMemberRole(orgId: string, userId: string, orgRole: OrgRole) {
  const form = new FormData();
  form.append("org_role", orgRole);
  return patchForm<OrgMember>(`/orgs/${orgId}/members/${userId}`, form);
}

/** Soft-removes, cascading to that user's project memberships in this org.
 * Offboarding is one action or it gets done incompletely. */
export async function removeOrgMember(orgId: string, userId: string) {
  return deleteJson<OrgMember>(`/orgs/${orgId}/members/${userId}`);
}

/** The org itself, plus the caller's org-scope capabilities. */
export async function getOrg(orgId: string) {
  return getJson<Org & { capabilities: string[] }>(`/orgs/${orgId}`);
}

export async function updateOrg(
  orgId: string,
  fields: {
    name?: string;
    country?: string;
    industryRole?: string;
    timezone?: string;
    workingWeek?: string;
    dataContributionRightsAccepted?: boolean;
  },
) {
  const form = new FormData();
  if (fields.name !== undefined) form.append("name", fields.name);
  if (fields.country !== undefined) form.append("country", fields.country);
  if (fields.industryRole !== undefined) form.append("industry_role", fields.industryRole);
  if (fields.timezone !== undefined) form.append("timezone", fields.timezone);
  if (fields.workingWeek !== undefined) form.append("working_week", fields.workingWeek);
  if (fields.dataContributionRightsAccepted !== undefined) {
    form.append(
      "data_contribution_rights_accepted",
      String(fields.dataContributionRightsAccepted),
    );
  }
  return patchForm<Org>(`/orgs/${orgId}`, form);
}

/** Bind the org's WhatsApp Business number. `phoneNumberId` is Meta's id for one
 * of *our* numbers and is the discriminator that makes inbound routing
 * tenant-safe — it is unique across orgs, so a second claim is rejected rather
 * than silently splitting that number's traffic between two tenants. */
export async function claimWhatsappNumber(
  orgId: string,
  phoneNumberId: string,
  displayNumber = "",
) {
  const form = new FormData();
  form.append("phone_number_id", phoneNumberId);
  form.append("display_number", displayNumber);
  return postForm<Org>(`/orgs/${orgId}/whatsapp`, form);
}

/** Archives the organisation — never a hard delete; the server enforces that,
 * this is just the label the UI uses because it's what people expect from
 * GitHub/Notion-style products. `confirmName` must match the org's name
 * exactly (server-checked, not just a disabled button client-side) — the
 * same type-to-confirm pattern those products use before anything this
 * destructive goes through. */
export async function deleteOrg(orgId: string, confirmName: string) {
  return deleteJson<{ org_id: string; archived_at: string }>(
    `/orgs/${orgId}?confirm_name=${encodeURIComponent(confirmName)}`,
  );
}

export type OrgInvitation = {
  invitation_id: string;
  org_id: string;
  email: string;
  org_role: OrgRole;
  project_id: string | null;
  project_role: ProjectRole | null;
  status: "pending" | "accepted" | "expired" | "revoked";
  invited_by: string;
  created_at: string | null;
  expires_at: string | null;
  accepted_at: string | null;
  accepted_by: string | null;
  /** Returned once, to the inviter, so they can pass on the link. */
  token?: string;
};

export async function listOrgInvitations(orgId: string) {
  return getJson<{ items: OrgInvitation[] }>(`/orgs/${orgId}/invitations`);
}

/** Offer access to someone who may not have an account yet. Unlike
 * `addOrgMember` this grants nothing until accepted, and can carry the project
 * role so "put them on Highrise Tower as a field reporter" is one act. */
export async function createOrgInvitation(input: {
  orgId: string;
  email: string;
  orgRole: OrgRole;
  projectId?: string;
  projectRole?: ProjectRole;
}) {
  const form = new FormData();
  form.append("email", input.email);
  form.append("org_role", input.orgRole);
  if (input.projectId) form.append("project_id", input.projectId);
  if (input.projectRole) form.append("project_role", input.projectRole);
  return postForm<OrgInvitation>(`/orgs/${input.orgId}/invitations`, form);
}

export async function revokeOrgInvitation(orgId: string, invitationId: string) {
  return deleteJson<OrgInvitation>(`/orgs/${orgId}/invitations/${invitationId}`);
}

export type InvitationPreview = {
  status: "pending" | "accepted" | "expired" | "revoked";
  email: string;
  org_id: string;
  org_name: string | null;
  org_role: OrgRole;
  project_id: string | null;
  project_name: string | null;
  project_role: ProjectRole | null;
  expires_at: string | null;
};

/** What a link offers, before signing in. Unauthenticated by design — an invitee
 * must be able to see which company is inviting them before making an account. */
export async function peekInvitation(token: string) {
  return getJson<InvitationPreview>(`/invitations/${token}`);
}

export async function acceptInvitation(token: string) {
  return postForm<OrgInvitation & { already_accepted: boolean }>(
    `/invitations/${token}/accept`,
    new FormData(),
  );
}

// ---------------- Join requests (domain discovery — UX_FLOW §7) ----------------
export type OrgCandidate = { org_id: string; org_name: string; member_count: number };

/** Orgs the signed-in user might already belong to, by email domain — the data
 * behind the "request to join instead" nudge. Empty for a consumer domain, an
 * unverified account, or no match; never an error. */
export async function getOrgCandidates() {
  return getJson<{ items: OrgCandidate[] }>("/me/org-candidates");
}

/** Find an organisation by name — the path in when email domain can't
 * identify you (a personal Gmail, which is the norm for site staff and
 * subcontractors in India and the GCC). Returns nothing below 2 characters:
 * search, deliberately not a browsable customer list. */
export async function searchOrgs(q: string) {
  return getJson<{ items: OrgCandidate[] }>(`/orgs/search?q=${encodeURIComponent(q)}`);
}

export type OrgJoinRequest = {
  request_id: string;
  org_id: string;
  user_id: string;
  domain: string;
  status: "pending" | "approved" | "denied" | "withdrawn";
  requested_at: string | null;
  decided_by: string | null;
  approved_at: string | null;
  denied_at: string | null;
  withdrawn_at: string | null;
  /** Present on the admin-facing list only. */
  user_email?: string;
  user_name?: string;
  /** Present on the requester-facing "my requests" list only. */
  org_name?: string;
};

export async function requestToJoinOrg(orgId: string) {
  return postForm<OrgJoinRequest>(`/orgs/${orgId}/join-requests`, new FormData());
}

export async function listOrgJoinRequests(orgId: string) {
  return getJson<{ items: OrgJoinRequest[] }>(`/orgs/${orgId}/join-requests`);
}

export async function approveOrgJoinRequest(orgId: string, requestId: string) {
  return postForm<OrgJoinRequest>(
    `/orgs/${orgId}/join-requests/${requestId}/approve`,
    new FormData(),
  );
}

export async function denyOrgJoinRequest(orgId: string, requestId: string) {
  return postForm<OrgJoinRequest>(
    `/orgs/${orgId}/join-requests/${requestId}/deny`,
    new FormData(),
  );
}

/** This account's own pending join requests — so an "asked to join" state
 * survives a page reload instead of living only in one component. */
export async function getMyJoinRequests() {
  return getJson<{ items: OrgJoinRequest[] }>("/me/join-requests");
}

export async function cancelMyJoinRequest(requestId: string) {
  return deleteJson<OrgJoinRequest>(`/me/join-requests/${requestId}`);
}

/** Invitations addressed to this account, so joining does not depend on still
 * having the link someone sent. */
export async function getMyInvitations() {
  return getJson<{ items: Array<OrgInvitation & { org_name: string | null }> }>(
    "/me/invitations",
  );
}

export type ProjectMember = {
  project_id: string;
  user_id: string;
  project_role: ProjectRole;
  email: string | null;
  name: string | null;
  granted_at: string | null;
  granted_by: string | null;
};

export async function listProjectMembers(projectId: string) {
  return getJson<{ items: ProjectMember[] }>(`/projects/${projectId}/members`);
}

/** The target must already be a member of the owning org — project access is
 * granted within an org, never across one. */
export async function addProjectMember(
  projectId: string,
  email: string,
  projectRole: ProjectRole,
) {
  const form = new FormData();
  form.append("email", email);
  form.append("project_role", projectRole);
  return postForm<ProjectMember>(`/projects/${projectId}/members`, form);
}

export async function removeProjectMember(projectId: string, userId: string) {
  return deleteJson<ProjectMember>(`/projects/${projectId}/members/${userId}`);
}

/** What the caller may do on this project. The UI renders itself from this —
 * capabilities come from the server and are never inferred client-side. Hiding a
 * button is a UX affordance; every capability is enforced again server-side. */
export type ProjectContext = {
  project_id: string;
  org_id: string;
  user_id: string;
  org_role: OrgRole;
  project_role: ProjectRole | null;
  capabilities: string[];
};

export async function getProjectContext(projectId: string) {
  return getJson<ProjectContext>(`/projects/${projectId}/context`);
}

// ---------------- Shadow Schedule Engine (field reality) ----------------
export type ReviewQueueItem = {
  event_id: string;
  project_id: string;
  raw_text: string;
  source_channel: string | null;
  reporter_id: string | null;
  captured_at: string | null;
  resolved_activity_uid: string | null;
  resolved_activity_name: string | null;
  /** How confident the engine is that it matched the RIGHT activity. */
  resolution_confidence: number;
  /** How credible the claim is once corroborated. Not a probability unless a
   *  calibration curve has been fit — check `GET /shadow/calibration`. */
  commit_confidence: number;
  review_status: string;
  /** Why the engine refused to auto-commit. The most useful column on screen. */
  review_reason: string | null;
};

/** Pending claims. `mine` restricts to the caller's own submissions — which is
 * all a `field_reporter` can see anyway, since they hold `queue:read_own` rather
 * than `queue:read`. Passing it as a planner narrows the same endpoint. */
export async function getReviewQueue(projectId: string, mine = false) {
  return getJson<{ items: ReviewQueueItem[] }>(
    `/review-queue?project_id=${encodeURIComponent(projectId)}${mine ? "&mine=1" : ""}`,
  );
}

export type MyReportCounts = {
  pending: number;
  approved: number;
  rejected: number;
  retracted: number;
};

/** The caller's own submissions in **every** state, with counts.
 *
 * Not `getReviewQueue(id, true)`: that is pending-only because it is a work
 * list, so an approved report disappears from it — which is precisely the
 * outcome the person who walked the site wants to see confirmed. */
export async function getMyReports(projectId: string) {
  return getJson<{ items: ReviewQueueItem[]; counts: MyReportCounts; total: number }>(
    `/my-reports?project_id=${encodeURIComponent(projectId)}`,
  );
}

/** Activity names + uids for the report composer's picker.
 *
 * Not `getProjectTasks`: that returns eight fields per row and no UID at all, so
 * it cannot populate a picker whose whole job is to hand back a uid — and a real
 * programme here is ~15,000 activities. Filtering happens server-side so the
 * payload stays bounded. */
export async function getShadowActivities(projectId: string, q = "", limit = 200) {
  const qs = new URLSearchParams({ project_id: projectId, limit: String(limit) });
  if (q) qs.set("q", q);
  return getJson<{ items: Array<{ uid: string; name: string }> }>(
    `/shadow/activities?${qs.toString()}`,
  );
}

export type CandidateActivity = {
  uid: string;
  name: string;
  score: number;
  signals?: Record<string, number>;
};

export type FieldReportResult = {
  event_id: string;
  project_id: string;
  source_channel: string;
  route:
    | "auto_commit"
    | "human_review"
    | "proposal_queued"
    | "rejected"
    | "duplicate"
    | "clarification_sent";
  committed: boolean;
  resolved_activity_uid: string | null;
  resolved_activity_name: string | null;
  resolution_confidence: number;
  commit_confidence: number;
  contract_mode: "standard" | "proposal_only";
  requires_human_review: boolean;
  review_reason: string | null;
  /** When the engine was torn between activities, these are what it was torn
   * between — the web composer resolves that inline instead of asking over a
   * round trip the way WhatsApp must. */
  candidate_alternatives: CandidateActivity[];
  message: string;
};

/** File a progress report as the signed-in project member.
 *
 * Deliberately takes no reporter identity: the server derives it from the token,
 * so this cannot file evidence under anyone else's name. `idempotencyKey` is
 * required — generate one per submission (not per keystroke) so a double-click or
 * a retry cannot file the same observation twice. */
export async function submitFieldReport(input: {
  projectId: string;
  idempotencyKey: string;
  text?: string;
  selectedActivityUid?: string;
  claimedPercentComplete?: number | null;
  claimedStatus?: string;
  capturedAt?: string;
}) {
  const form = new FormData();
  form.append("project_id", input.projectId);
  form.append("idempotency_key", input.idempotencyKey);
  if (input.text) form.append("text", input.text);
  if (input.selectedActivityUid) {
    form.append("selected_activity_uid", input.selectedActivityUid);
  }
  if (input.claimedPercentComplete != null) {
    form.append("claimed_percent_complete", String(input.claimedPercentComplete));
  }
  if (input.claimedStatus) form.append("claimed_status", input.claimedStatus);
  if (input.capturedAt) form.append("captured_at", input.capturedAt);
  return postForm<FieldReportResult>("/shadow/field-reports", form);
}

export type AdjudicationResult = {
  ok: boolean;
  decision_id: string | null;
  event_id: string;
  decision: "approved" | "rejected" | "retracted";
  message: string;
};

export async function approveEvent(projectId: string, eventId: string, notes = "") {
  const form = new FormData();
  form.append("project_id", projectId);
  form.append("notes", notes);
  return postForm<AdjudicationResult>(`/review-queue/${eventId}/approve`, form);
}

export async function rejectEvent(
  projectId: string,
  eventId: string,
  opts: { abandoned?: boolean; downwardRevisionFraction?: number | null; notes?: string } = {},
) {
  const form = new FormData();
  form.append("project_id", projectId);
  form.append("abandoned", String(Boolean(opts.abandoned)));
  if (opts.downwardRevisionFraction != null) {
    form.append("downward_revision_fraction", String(opts.downwardRevisionFraction));
  }
  form.append("notes", opts.notes ?? "");
  return postForm<AdjudicationResult>(`/review-queue/${eventId}/reject`, form);
}

export async function retractEvent(projectId: string, eventId: string, reason = "") {
  const form = new FormData();
  form.append("project_id", projectId);
  form.append("reason", reason);
  return postForm<AdjudicationResult>(`/review-queue/${eventId}/retract`, form);
}

export type ShadowActivity = {
  uid: string;
  name: string;
  /** Time-phased planned percentage at `last_reported_at`, calculated from the
   * activity's Start and Finish rather than imported PercentComplete. */
  planned_percent_complete: number | null;
  planned_start: string | null;
  planned_finish: string | null;
  shadow_percent_complete: number | null;
  shadow_status: string | null;
  last_field_event_id: string | null;
  last_reported_at: string | null;
  committed_event_count: number;
  /** Who reported the latest committed event. Null when the identity could not
   * be resolved (revoked enrolment, deleted account) — show "unknown" rather
   * than falling back to the pseudonymous key, which means nothing on screen. */
  last_reported_by: string | null;
  last_reporter_identity_key: string | null;
  last_source_channel: string | null;
  /** Distinct *people*, not events. One person reporting four times is not
   * four sources — that distinction is what the corroboration gate turns on. */
  distinct_reporter_count: number;
};

export type ShadowSchedule = {
  project_id: string;
  contract_mode: "proposal_only" | "standard";
  activities: ShadowActivity[];
  pending_review_count: number;
  summary: string;
};

export async function getShadowSchedule(projectId: string) {
  return getJson<ShadowSchedule>(
    `/shadow-schedule?project_id=${encodeURIComponent(projectId)}`,
  );
}

export type ContractModeConfig = {
  project_id: string;
  contract_mode: "proposal_only" | "standard";
  data_contribution_rights_accepted: boolean;
  tenant_id: string | null;
  updated_at: string | null;
};

export async function getContractMode(projectId: string) {
  return getJson<ContractModeConfig>(
    `/shadow/contract-mode?project_id=${encodeURIComponent(projectId)}`,
  );
}

export async function setContractMode(
  projectId: string,
  mode: "proposal_only" | "standard",
  force = false,
) {
  const form = new FormData();
  form.append("project_id", projectId);
  form.append("mode", mode);
  form.append("force", String(force));
  return putForm<ContractModeConfig>("/shadow/contract-mode", form);
}

export type Enrollment = {
  phone_e164: string;
  project_id: string;
  org_id: string | null;
  reporter_id: string;
  display_name: string | null;
  preferred_language: string | null;
  is_active: boolean;
  enrolled_at: string | null;
  enrolled_by: string | null;
  revoked_at: string | null;
};

export async function getEnrollments(projectId: string, includeRevoked = false) {
  const qs = new URLSearchParams({
    project_id: projectId,
    include_revoked: String(includeRevoked),
  });
  return getJson<{ items: Enrollment[] }>(`/shadow/enrollments?${qs.toString()}`);
}

export async function enrollReporter(input: {
  projectId: string;
  phone: string;
  displayName?: string;
  preferredLanguage?: string;
}) {
  const form = new FormData();
  form.append("project_id", input.projectId);
  form.append("phone", input.phone);
  if (input.displayName) form.append("display_name", input.displayName);
  if (input.preferredLanguage) form.append("preferred_language", input.preferredLanguage);
  return postForm<Enrollment>("/shadow/enrollments", form);
}

export async function revokeReporter(projectId: string, phone: string) {
  const form = new FormData();
  form.append("project_id", projectId);
  form.append("phone", phone);
  return postForm<Enrollment>("/shadow/enrollments/revoke", form);
}

/** Counter-party trust. Two shapes by capability: org/project admins get the
 *  numeric score, planners get a qualitative band only. Never shown to the
 *  subcontractor being assessed — that is a commercial-dispute risk, not a
 *  display preference. */
export type ReporterTrustFull = {
  reporter_id: string;
  project_id: string;
  trust_prior: number;
  trust_current: number;
  calibration_active: boolean;
  calibration_period_ends: string | null;
  events_observed: number;
  routing: "normal" | "elevated_scrutiny";
};

export type ReporterTrustBand = {
  reporter_id: string;
  project_id: string;
  band: "established" | "calibrating" | "watch";
  routing: "normal" | "elevated_scrutiny";
};

export async function getReporterTrust(projectId: string, reporterId: string) {
  return getJson<ReporterTrustFull | ReporterTrustBand>(
    `/reporters/${encodeURIComponent(reporterId)}/trust?project_id=${encodeURIComponent(projectId)}`,
  );
}

// ---------------- Schedule graph ----------------

/** A node in the project graph. `kind` decides how it is drawn; the reported
 *  fields decide whether it reads as "the field has said something about this". */
export type GraphNode = {
  id: string;
  kind: "task" | "milestone" | "wbs";
  name: string;
  uid: string;
  critical: boolean;
  start: string | null;
  finish: string | null;
  duration_days?: number | null;
  total_float_days?: number | null;
  /** The percent-complete carried in the imported file. Kept apart from
   *  `planned_percent_complete`, which is time-phased to the report date — they
   *  answer different questions and conflating them invents a variance. */
  imported_percent_complete?: number | null;
  planned_percent_complete?: number | null;
  shadow_percent_complete?: number | null;
  shadow_status?: string | null;
  shadow_reported_at?: string | null;
  variance?: number | null;
  evidence_count: number;
  /** Distinct people, not events. Two reports from one person is not
   *  corroboration, and the graph should not imply that it is. */
  reporter_count: number;
  last_reported_by?: string | null;
  last_source_channel?: string | null;
  wbs_code?: string | null;
  wbs_uid?: string | null;
  wbs_name?: string | null;
};

export type GraphEdge = {
  source: string;
  target: string;
  kind: "logic" | "contains";
  /** FS / SS / FF / SF as P6 stores it, or null when the file did not say. */
  rel_type: string | null;
  /** A duration with its unit as P6 wrote it, e.g. "16.0h" — not a number. */
  lag: string | null;
  critical: boolean;
};

export type GraphView = {
  project_id: string;
  nodes: GraphNode[];
  edges: GraphEdge[];
  counts: {
    tasks: number;
    wbs: number;
    relationships: number;
    critical: number;
    with_evidence: number;
    total_tasks: number;
  };
  /** True when the project exceeds the server's node cap. What survives is
   *  ordered so evidence-bearing activities are kept. */
  truncated: boolean;
  max_nodes: number;
  /** False when the caller holds `project:read` but not `queue:read` — the
   *  programme is theirs to see, other parties' committed claims are not. */
  evidence_visible: boolean;
};

export async function getGraphData(projectId: string) {
  const qs = new URLSearchParams({ project_id: projectId });
  return getJson<GraphView>(`/graph-data?${qs.toString()}`);
}

// ---------------- Round-trip export (P6 / MS Project) ----------------
export type ShadowExportFormat = "pmxml" | "xer" | "mspdi";

export type ShadowExportPreview = {
  exportable: boolean;
  source_file: string | null;
  /** Activities carrying committed field evidence — what would be written. */
  /** Whether the export will be built on the newest re-import rather than the
   *  original upload. Re-import rewrites the graph's planned dates, so this is
   *  what says whether the file will agree with the variances on screen. */
  source_is_reimport: boolean;
  activities_updated: number;
  /** Claims still awaiting a planner's ruling. Deliberately NOT exported: they
   *  are claims, not facts, until adjudicated. */
  activities_withheld_pending_review: number;
  formats: string[];
  reason: string | null;
};

export async function getShadowExportPreview(projectId: string) {
  const qs = new URLSearchParams({ project_id: projectId, preview: "true" });
  return getJson<ShadowExportPreview>(`/shadow/export?${qs.toString()}`);
}

export type ShadowExportResult = {
  filename: string;
  activitiesUpdated: number | null;
  verifiedInFile: number | null;
  withheld: number | null;
  /** Values that did not read back from the written file. Non-zero means the
   *  file is missing something the user can see on screen, which they need told
   *  rather than left to discover. */
  notRepresentable: number | null;
  /** Activities given reported progress that the contract programme still shows
   *  as never started. The progress is written; P6 treats status, actual dates
   *  and remaining duration as one consistent set and may query it on import.
   *  No actual date is invented to smooth this over — none was observed. */
  withoutActualStart: number | null;
  /** Activities with committed evidence that the retained source file has no
   *  activity for, so this file could not carry them. Distinct from
   *  `notRepresentable`, which is a limit of the format rather than a gap in the
   *  file being written onto. Non-zero means a re-imported programme has added
   *  activities the stored baseline does not have. */
  missingFromSource: number | null;
  /** Digest of the downloaded bytes, also recorded on the export audit row, so a
   *  file can later be shown to be the one this system produced. */
  sha256: string | null;
  /** The stored schedule the download was built on. */
  sourceFile: string | null;
};

/** Download the export and hand the browser the file.
 *
 * Cannot be a plain `<a href>`: the endpoint is authenticated, and an anchor
 * cannot carry the bearer token. So it is fetched, turned into an object URL,
 * and clicked synthetically — the same reason `fetchGraphHtmlUrl` exists. */
export async function downloadShadowExport(
  projectId: string,
  fmt: ShadowExportFormat,
): Promise<ShadowExportResult> {
  const qs = new URLSearchParams({ project_id: projectId, fmt });
  const res = await fetch(`${BACKEND}/shadow/export?${qs.toString()}`, {
    headers: { ...authHeaders() },
  });
  if (!res.ok) {
    let detail = `Export failed (${res.status}).`;
    try {
      const body = await res.json();
      if (body?.detail) detail = body.detail;
    } catch {
      /* non-JSON error body — keep the status message */
    }
    throw new Error(detail);
  }

  const disposition = res.headers.get("content-disposition") || "";
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  const filename = match ? decodeURIComponent(match[1]) : `shadow-export.${fmt}`;

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Revoked on the next tick so the click has taken the URL first.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }

  const num = (h: string) => {
    const v = res.headers.get(h);
    return v === null ? null : Number(v);
  };
  return {
    filename,
    activitiesUpdated: num("X-Syncpro-Activities-Updated"),
    verifiedInFile: num("X-Syncpro-Verified-In-File"),
    withheld: num("X-Syncpro-Withheld-Pending-Review"),
    notRepresentable: num("X-Syncpro-Not-Representable"),
    withoutActualStart: num("X-Syncpro-No-Actual-Start"),
    missingFromSource: num("X-Syncpro-Missing-From-Source"),
    sha256: res.headers.get("X-Syncpro-Sha256"),
    sourceFile: res.headers.get("X-Syncpro-Source-File"),
  };
}

export type CalibrationInfo =
  | { scope: string; calibrated: false; note: string }
  | {
      calibrated: true;
      org_id: string;
      scope: string;
      method: string;
      coef_a: number;
      coef_b: number;
      n_examples: number;
      precision_at_threshold: number | null;
      threshold: number | null;
      fitted_at: string | null;
    };

export async function getCalibration(projectId: string, scope = "corroboration") {
  const qs = new URLSearchParams({ project_id: projectId, scope });
  return getJson<CalibrationInfo>(`/shadow/calibration?${qs.toString()}`);
}

export async function getModels() {
  return getJson<{ models: ModelInfo[]; default: string }>("/models");
}

export async function sendChatMessage(input: {
  prompt: string;
  model: string;
  projectId?: string | null;
  history: Array<{ role: string; content: string }>;
  sessionId?: string;
  turnState?: TurnState | null;
  /** Set when answering a clarification: the slot it asked about and the option
   * tapped. "NONE" means none of the offered options were right, which is a
   * real answer — it says the shortlist was wrong. */
  clarifySlot?: string;
  clarifyValue?: string;
}) {
  const form = new FormData();
  form.append("prompt", input.prompt);
  form.append("model", input.model);
  form.append("history", JSON.stringify(input.history));
  if (input.projectId) form.append("project_id", input.projectId);
  if (input.sessionId) form.append("session_id", input.sessionId);
  if (input.turnState) form.append("turn_state", JSON.stringify(input.turnState));
  if (input.clarifySlot && input.clarifyValue) {
    form.append("clarify_slot", input.clarifySlot);
    form.append("clarify_value", input.clarifyValue);
  }
  return postForm<ChatAgentResponse>("/cypher-agent", form);
}

export type AgentStreamHandlers = {
  onStatus?: (status: AgentStatus) => void;
  onBlock?: (block: AnswerBlock) => void;
  onClarification?: (clarification: AgentClarification) => void;
  onDone?: (envelope: ChatAgentResponse, state: TurnState) => void;
  onError?: (message: string) => void;
};

/**
 * Stream an answer from `/agent/ask`.
 *
 * Not `EventSource`: that can only issue a GET and cannot carry an
 * `Authorization` header, and this endpoint needs both a POST body and a bearer
 * token. So the response body is read as a stream and the SSE framing
 * (`event:` / `data:` pairs separated by a blank line) is parsed here.
 *
 * Returns an abort function — the "Stop" control. A cancelled request is not an
 * error and reports nothing.
 */
export function streamAgentAsk(
  input: {
    prompt: string;
    model?: string;
    projectId?: string | null;
    sessionId?: string;
    turnState?: TurnState | null;
    clarifySlot?: string;
    clarifyValue?: string;
  },
  handlers: AgentStreamHandlers,
): () => void {
  const controller = new AbortController();
  const form = new FormData();
  form.append("prompt", input.prompt);
  if (input.model) form.append("model", input.model);
  if (input.projectId) form.append("project_id", input.projectId);
  if (input.sessionId) form.append("session_id", input.sessionId);
  if (input.turnState) form.append("turn_state", JSON.stringify(input.turnState));
  if (input.clarifySlot && input.clarifyValue) {
    form.append("clarify_slot", input.clarifySlot);
    form.append("clarify_value", input.clarifyValue);
  }

  void (async () => {
    try {
      const res = await fetch(`${BACKEND}/agent/ask`, {
        method: "POST",
        body: form,
        headers: { ...authHeaders() },
        signal: controller.signal,
      });
      if (!res.ok || !res.body) {
        const detail = await res.text().catch(() => "");
        handlers.onError?.(detail || `Request failed (${res.status})`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        // Frames are separated by a blank line. A partial frame stays in the
        // buffer until the rest of it arrives — splitting on every newline
        // would parse half a JSON payload.
        let split = buffer.indexOf("\n\n");
        while (split !== -1) {
          const frame = buffer.slice(0, split);
          buffer = buffer.slice(split + 2);
          dispatchFrame(frame, handlers);
          split = buffer.indexOf("\n\n");
        }
      }
    } catch (err) {
      if ((err as Error)?.name === "AbortError") return; // stopping is not failing
      handlers.onError?.(err instanceof Error ? err.message : "Stream failed.");
    }
  })();

  return () => controller.abort();
}

function dispatchFrame(frame: string, handlers: AgentStreamHandlers) {
  let event = "message";
  const dataLines: string[] = [];
  for (const line of frame.split("\n")) {
    if (line.startsWith("event:")) event = line.slice(6).trim();
    else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
  }
  if (!dataLines.length) return;
  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(dataLines.join("\n"));
  } catch {
    return; // a malformed frame is dropped, never thrown at the user
  }
  switch (event) {
    case "status":
      handlers.onStatus?.(payload as AgentStatus);
      break;
    case "block":
      handlers.onBlock?.(payload as AnswerBlock);
      break;
    case "clarification":
      handlers.onClarification?.(payload as unknown as AgentClarification);
      break;
    case "done":
      handlers.onDone?.(
        payload.envelope as ChatAgentResponse,
        (payload.state as TurnState) || {},
      );
      break;
    case "error":
      handlers.onError?.(String(payload.message || "Stream failed."));
      break;
  }
}

export async function sendChatFeedback(input: {
  projectId?: string | null;
  sessionId: string;
  messageId: string;
  rating: "up" | "down";
  prompt: string;
  answer: string;
  cypher?: string;
}) {
  const form = new FormData();
  if (input.projectId) form.append("project_id", input.projectId);
  form.append("session_id", input.sessionId);
  form.append("message_id", input.messageId);
  form.append("rating", input.rating);
  form.append("prompt", input.prompt);
  form.append("answer", input.answer);
  form.append("cypher", input.cypher || "");
  return postForm<{ ok: boolean; feedback_id: string }>("/chat/feedback", form);
}

/** This caller's sessions on this project. The owner is taken from the auth token,
 * never sent — a self-declared user_id on a route that returns that user's history
 * is a request to impersonate, not an identifier. */
export async function getChatSessions(projectId: string) {
  const qs = new URLSearchParams({ project_id: projectId });
  return getJson<{ sessions: ChatSessionDto[] }>(`/chat/sessions?${qs.toString()}`);
}

export async function saveChatSession(input: {
  projectId: string;
  sessionId: string;
  title: string;
  messages: ChatMessage[];
  memorySummary?: string;
}) {
  const form = new FormData();
  form.append("project_id", input.projectId);
  form.append("session_id", input.sessionId);
  form.append("title", input.title);
  form.append("messages", JSON.stringify(input.messages));
  form.append("memory_summary", input.memorySummary || "");
  return postForm<{ ok: boolean }>("/chat/sessions", form);
}

export async function deleteChatSession(sessionId: string) {
  return deleteJson<{ ok: boolean }>(`/chat/sessions/${sessionId}`);
}

/** Projects the signed-in caller can see.
 *
 * No `user_id` argument: the backend derives the caller from the JWT and returns
 * every project in the orgs they belong to, plus any project they hold a
 * membership on. Passing an id here used to be how the list was scoped — which
 * meant anyone could read anyone's projects by guessing one. */
export async function getProjects() {
  return getJson<{ projects: Project[] }>("/projects");
}

export async function deleteProject(projectId: string) {
  return deleteJson<{ message: string }>(`/projects/${projectId}`);
}

export async function getProjectTasks(projectId: string) {
  return getJson<{ tasks: Record<string, unknown>[] }>(`/projects/${projectId}/tasks`);
}

/** Import a schedule, creating the project inside `orgId`.
 *
 * The org is required, not optional: this is the point at which a project first
 * exists, so it is where the project is bound to a tenant. The uploading user is
 * taken from the JWT. */
export async function uploadSchedule(
  file: File,
  orgId: string,
  projectName?: string,
) {
  const form = new FormData();
  form.append("file", file);
  form.append("org_id", orgId);
  if (projectName) form.append("project_name", projectName);
  return postForm<{
    message: string;
    project_id: string;
    project_name: string;
    tasks: number;
    wbs: number;
    has_relationships: number;
    successors: number;
  }>("/schedule2kg", form);
}

/** Fetch the rendered pyvis graph as an object URL.
 *
 * `GET /graph.html` is authenticated now, and an `<iframe src=...>` cannot carry
 * an Authorization header — so fetch it here and hand the iframe a blob URL.
 * Callers must revoke the URL when the component unmounts. */
export async function fetchGraphHtmlUrl(projectId: string): Promise<string> {
  const res = await fetch(
    `${BACKEND}/graph.html?project_id=${encodeURIComponent(projectId)}`,
    { headers: { ...authHeaders() } },
  );
  if (!res.ok) {
    throw new Error(
      res.status === 404
        ? "No rendered graph for this project yet."
        : `Could not load the graph (${res.status}).`,
    );
  }
  return URL.createObjectURL(await res.blob());
}

/** `projectId` is required now. These routes used to run cross-project when it
 * was omitted, which on a tenanted backend meant "every project in the
 * database" — so the server rejects an unscoped call and the type says so here
 * rather than letting one compile into a 4xx at runtime. */
export async function getCritical(projectId: string) {
  return getJson<{ tasks: Record<string, unknown>[]; total: number; truncated: boolean }>(
    `/critical?project_id=${encodeURIComponent(projectId)}`,
  );
}

export async function getFlowline(projectId: string) {
  return getJson<Record<string, unknown>>(
    `/flowline?project_id=${encodeURIComponent(projectId)}`,
  );
}

// ---------------- Schedule Health (DCMA-14 + beyond-DCMA) ----------------
export type HealthSeverity = "Critical" | "Warning" | "Advisory";
export type HealthFamily = "DCMA-14" | "Beyond-DCMA";

export type HealthFlag = {
  flag_id: string;
  category: string;
  family: HealthFamily;
  severity: HealthSeverity;
  plain_english_description: string;
  proposed_fix: string;
  affected_activity_ids: string[];
  measured: string;
  threshold: string;
};

export type MetricResult = {
  metric_id: string;
  name: string;
  family: HealthFamily;
  status: "pass" | "fail" | "not_applicable";
  severity: HealthSeverity;
  measured: string;
  threshold: string;
  detail: string;
  na_reason?: string | null;
  affected_activity_ids: string[];
};

export type RepairProposal = {
  repair_id: string;
  flag_id: string;
  repair_type: string;
  description: string;
  affected_activity_ids: string[];
  estimated_float_recovery_days: number;
  confidence: number;
};

export type ScheduleHealthReport = {
  project_id: string;
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  summary: string;
  total_activities: number;
  data_date?: string | null;
  checks_applicable: number;
  checks_total: number;
  flags: HealthFlag[];
  metrics: MetricResult[];
  repairs: RepairProposal[];
  generated_at: string;
};

export async function getHealthScore(projectId: string) {
  return getJson<ScheduleHealthReport>(
    `/health-score?project_id=${encodeURIComponent(projectId)}`
  );
}

export async function getHealthNarrative(projectId: string, model?: string) {
  const qs = new URLSearchParams({ project_id: projectId });
  if (model) qs.set("model", model);
  return getJson<{ narrative: string; source: string }>(
    `/health/narrative?${qs.toString()}`
  );
}

export type HealthDecision = {
  decision_id: string;
  flag_id: string;
  repair_id: string | null;
  decision: "accept" | "reject";
  note: string | null;
  created_at: string | null;
};

/** Decisions already recorded against this project's health flags. Without this
 * the dashboard only knows what you decided in the current session, so a refresh
 * makes every ruling look unmade even though the backend persisted it. */
export async function getHealthDecisions(projectId: string) {
  return getJson<{ decisions: HealthDecision[] }>(
    `/health/decisions?project_id=${encodeURIComponent(projectId)}`,
  );
}

/** The decider is taken from the auth token server-side. `userId` is gone from
 * this signature deliberately: a self-declared author on an immutable decision
 * record is a request to attribute someone else's judgement. */
export async function postHealthDecision(input: {
  projectId: string;
  flagId: string;
  decision: "accept" | "reject";
  repairId?: string;
  note?: string;
}) {
  const form = new FormData();
  form.append("project_id", input.projectId);
  form.append("flag_id", input.flagId);
  form.append("decision", input.decision);
  form.append("repair_id", input.repairId || "");
  form.append("note", input.note || "");
  return postForm<{ ok: boolean; decision_id: string }>("/health/decision", form);
}

// ---------------- Living re-forecast (what-if / re-import / narrative) ----------------
export type WhatIfImpact = {
  uid: string;
  name: string;
  float_before_days: number | null;
  float_after_days: number | null;
  becomes_critical: boolean;
};

export type WhatIfResult = {
  project_id: string;
  activity_uid: string;
  activity_name: string;
  delay_days: number;
  method: string;
  project_finish_delay_days: number;
  activity_float_days: number | null;
  downstream_count: number;
  newly_critical_count: number;
  impacts: WhatIfImpact[];
  summary: string;
};

export type FieldChange = { field: string; previous: string | null; current: string | null };
export type ModifiedActivity = { uid: string; name: string; changes: FieldChange[] };
export type ReimportChangeset = {
  project_id: string;
  filename: string;
  added_count: number;
  removed_count: number;
  modified_count: number;
  events_recorded: number;
  added: string[];
  removed: string[];
  modified: ModifiedActivity[];
  summary: string;
};

export type WeeklyNarrative = {
  project_id: string;
  narrative: string;
  source: string;
  events_considered: number;
  critical_count: number;
  upcoming_count: number;
  data_date: string | null;
};

export async function postWhatIf(input: {
  projectId: string;
  delayDays: number;
  activityName?: string;
  activityUid?: string;
}) {
  const form = new FormData();
  form.append("project_id", input.projectId);
  form.append("delay_days", String(input.delayDays));
  if (input.activityUid) form.append("activity_uid", input.activityUid);
  if (input.activityName) form.append("activity_name", input.activityName);
  return postForm<WhatIfResult>("/whatif", form);
}

/** Re-upload an updated schedule and diff it against the current graph.
 *
 * No `userId` argument: the backend takes the actor from the JWT. Passing one
 * used to mean the audit events for a schedule rewrite were attributed to
 * whatever id the caller typed. */
export async function postReimport(file: File, projectId: string) {
  const form = new FormData();
  form.append("file", file);
  form.append("project_id", projectId);
  return postForm<ReimportChangeset>("/reimport", form);
}

export async function getWeeklyNarrative(projectId: string, model?: string) {
  const qs = new URLSearchParams({ project_id: projectId });
  if (model) qs.set("model", model);
  return getJson<WeeklyNarrative>(`/narrative/weekly?${qs.toString()}`);
}

// ---------------- Auth token (JWT in localStorage) ----------------
export const AUTH_TOKEN_KEY = "auth_token";

export function getAuthToken(): string | null {
  try {
    return localStorage.getItem(AUTH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAuthToken(token: string | null) {
  try {
    if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
    else localStorage.removeItem(AUTH_TOKEN_KEY);
  } catch {
    /* ignore storage failures (private mode, etc.) */
  }
}

function authHeaders(): Record<string, string> {
  const token = getAuthToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function getJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND}${path}`, { headers: { ...authHeaders() } });
  return parseJson<T>(res);
}

async function deleteJson<T>(path: string): Promise<T> {
  const res = await fetch(`${BACKEND}${path}`, { method: "DELETE", headers: { ...authHeaders() } });
  return parseJson<T>(res);
}

async function postForm<T>(path: string, body: FormData): Promise<T> {
  const res = await fetch(`${BACKEND}${path}`, { method: "POST", body, headers: { ...authHeaders() } });
  return parseJson<T>(res);
}

async function putForm<T>(path: string, body: FormData): Promise<T> {
  const res = await fetch(`${BACKEND}${path}`, { method: "PUT", body, headers: { ...authHeaders() } });
  return parseJson<T>(res);
}

async function patchJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BACKEND}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  return parseJson<T>(res);
}

async function patchForm<T>(path: string, body: FormData): Promise<T> {
  const res = await fetch(`${BACKEND}${path}`, { method: "PATCH", body, headers: { ...authHeaders() } });
  return parseJson<T>(res);
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BACKEND}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...authHeaders() },
    body: JSON.stringify(body),
  });
  return parseJson<T>(res);
}

async function parseJson<T>(res: Response): Promise<T> {
  const raw = await res.text();
  let data: any = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    throw new Error(data?.detail || data?.error || raw || `Request failed with ${res.status}`);
  }
  return (data ?? {}) as T;
}

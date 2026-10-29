export type WaitlistKind = "early-access" | "investor";

export interface WaitlistPayload {
  kind: WaitlistKind;
  name: string;
  email: string;
  company: string;
  role: string;
  message: string;
}

const ENDPOINT = import.meta.env.VITE_WAITLIST_ENDPOINT as string | undefined;
export const CONTACT_EMAIL =
  (import.meta.env.VITE_CONTACT_EMAIL as string | undefined) ||
  "founders@syncpro.org";

/**
 * Submits the waitlist form.
 *
 * - If VITE_WAITLIST_ENDPOINT is set (Formspree / Web3Forms / Formspark / etc.),
 *   POSTs the payload as JSON and resolves on a 2xx.
 * - Otherwise falls back to opening a pre-filled mailto: so the site is useful
 *   even before a form backend is wired up.
 */
export async function submitWaitlist(payload: WaitlistPayload): Promise<void> {
  if (!ENDPOINT) {
    openMailtoFallback(payload);
    return;
  }

  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    throw new Error(`Submission failed (${res.status})`);
  }
}

function openMailtoFallback(p: WaitlistPayload) {
  const subject =
    p.kind === "investor"
      ? "SyncPro — investor / advisor enquiry"
      : "SyncPro — early access request";
  const body = [
    `Name: ${p.name}`,
    `Email: ${p.email}`,
    `Company: ${p.company}`,
    `Role: ${p.role}`,
    "",
    p.message,
  ].join("\n");
  window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`;
}

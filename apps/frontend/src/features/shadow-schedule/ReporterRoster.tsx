// Who is authorised to submit field evidence to this project.
//
// Gated on `enrollment:manage`, not on `project:read`, because the rows contain
// phone numbers — the one piece of PII the pipeline otherwise keeps out of the
// graph and the audit log entirely. A viewer who may read the schedule has no
// reason to read the roster.
//
// Enrollment is mandatory by design: the WhatsApp number becomes effectively
// public the moment it is printed on a site notice board, so an unenrolled sender
// is refused outright rather than queued for review.
import { useCallback, useEffect, useState } from "react";
import { Loader2, Phone, ShieldCheck, UserPlus } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import {
  enrollReporter,
  getEnrollments,
  revokeReporter,
  type Enrollment,
} from "@/shared/api/client";
import { CAP } from "./useProjectCapabilities";

type Props = { projectId: string; can: (capability: string) => boolean };

export default function ReporterRoster({ projectId, can }: Props) {
  const [items, setItems] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRevoked, setShowRevoked] = useState(false);
  const [phone, setPhone] = useState("");
  const [name, setName] = useState("");
  const [lang, setLang] = useState("");

  const allowed = can(CAP.enrollmentManage);

  const load = useCallback(async () => {
    if (!allowed) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { items: rows } = await getEnrollments(projectId, showRevoked);
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load the roster.");
    } finally {
      setLoading(false);
    }
  }, [allowed, projectId, showRevoked]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!allowed) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-slate-900 p-8 text-center">
        <ShieldCheck className="w-8 h-8 text-gray-700 mx-auto mb-3" />
        <p className="text-sm text-gray-400">This roster contains phone numbers.</p>
        <p className="text-xs text-gray-600 mt-1">
          Viewing it requires the <span className="text-gray-400">enrollment:manage</span>{" "}
          capability.
        </p>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await enrollReporter({
        projectId,
        phone: phone.trim(),
        displayName: name.trim(),
        preferredLanguage: lang.trim(),
      });
      setPhone("");
      setName("");
      setLang("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not enroll that number.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async (p: string) => {
    setBusy(true);
    setError(null);
    try {
      await revokeReporter(projectId, p);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revoke that enrollment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {error && (
        <div className="text-xs text-red-300 bg-red-500/[0.06] border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      <form
        onSubmit={submit}
        className="rounded-xl border border-white/[0.06] bg-slate-900 p-4 space-y-3"
      >
        <div className="flex items-center gap-1.5 text-xs text-gray-300">
          <UserPlus className="w-3.5 h-3.5 text-gray-500" />
          Authorise a number to report on this project
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            required
          />
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name (e.g. Foreman Kumar)"
          />
          <Input
            value={lang}
            onChange={(e) => setLang(e.target.value)}
            placeholder="Language (hi, ar, en…)"
          />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[10px] text-gray-600">
            Any other active enrollment for this number is superseded — an inbound message
            carries no project context, so one number maps to one project.
          </p>
          <Button type="submit" disabled={busy || !phone.trim()}>
            {busy ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
            Enroll
          </Button>
        </div>
      </form>

      <div className="rounded-xl border border-white/[0.06] bg-slate-900 overflow-hidden">
        <div className="px-4 py-2.5 border-b border-white/[0.06] flex items-center justify-between">
          <span className="text-xs font-medium text-gray-300">
            {items.length} enrolled
          </span>
          <label className="flex items-center gap-1.5 text-[11px] text-gray-500">
            <input
              type="checkbox"
              checked={showRevoked}
              onChange={(e) => setShowRevoked(e.target.checked)}
              className="accent-blue-500"
            />
            Show revoked
          </label>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-500 text-xs">
            <Loader2 className="w-4 h-4 animate-spin inline mr-2" /> Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="p-8 text-center">
            <Phone className="w-7 h-7 text-gray-700 mx-auto mb-2" />
            <p className="text-xs text-gray-500">
              No numbers enrolled. Nothing can report to this project yet.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {items.map((r) => (
              <div
                key={`${r.phone_e164}-${r.project_id}`}
                className="px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <p className="text-xs text-gray-200">
                    {r.display_name || "Unnamed reporter"}
                    {!r.is_active && (
                      <span className="ml-2 text-[10px] text-gray-600">revoked</span>
                    )}
                  </p>
                  <p className="text-[11px] text-gray-500 font-mono">{r.phone_e164}</p>
                  <p className="text-[10px] text-gray-700 font-mono truncate">
                    id {r.reporter_id}
                  </p>
                </div>
                {r.is_active && (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => void revoke(r.phone_e164)}
                    className="bg-transparent border-white/[0.08] text-gray-400 hover:bg-white/[0.04] text-xs shrink-0"
                  >
                    Revoke
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="text-[10px] text-gray-600">
        Revoking deactivates the row rather than deleting it: committed field events still
        reference this reporter, and the evidence chain must stay resolvable years later.
        The <code>reporter_id</code> is an opaque handle — the graph and audit log never
        hold the phone number itself.
      </p>
    </div>
  );
}

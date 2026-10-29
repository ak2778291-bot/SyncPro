// Organisation profile and the WhatsApp Business connection.
//
// Both are gated on `org:manage`, which only an owner holds. The WhatsApp panel
// is the more consequential half: `phone_number_id` is Meta's id for one of *our*
// numbers and is the discriminator that routes an inbound message to the right
// tenant. It is unique across organisations, so a second claim on the same number
// is refused rather than silently splitting that number's traffic between two
// customers — which is exactly the failure mode the claim exists to prevent.
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  Loader2,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Input } from "@/shared/ui/input";
import { claimWhatsappNumber, deleteOrg, updateOrg, type Org } from "@/shared/api/client";
import { CAP } from "@/features/shadow-schedule/useProjectCapabilities";

type Props = {
  org: Org & { capabilities: string[] };
  can: (capability: string) => boolean;
  onChanged: () => void;
};

export default function OrgSettings({ org, can, onChanged }: Props) {
  const [name, setName] = useState(org.name);
  const [country, setCountry] = useState(org.country ?? "");
  const [industryRole, setIndustryRole] = useState(org.industry_role ?? "");
  const [timezone, setTimezone] = useState(org.timezone ?? "");
  const [workingWeek, setWorkingWeek] = useState(org.working_week ?? "");
  const [phoneNumberId, setPhoneNumberId] = useState("");
  const [displayNumber, setDisplayNumber] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setName(org.name);
    setCountry(org.country ?? "");
    setIndustryRole(org.industry_role ?? "");
    setTimezone(org.timezone ?? "");
    setWorkingWeek(org.working_week ?? "");
  }, [org]);

  const allowed = can(CAP.orgManage);

  if (!allowed) {
    return (
      <div className="rounded-xl border border-white/[0.06] bg-slate-900 p-8 text-center">
        <ShieldCheck className="w-8 h-8 text-gray-700 mx-auto mb-3" />
        <p className="text-sm text-gray-400">
          Organisation settings are owner-only.
        </p>
        <p className="text-xs text-gray-600 mt-1">
          They change how inbound field reports are routed, so they sit with whoever carries
          commercial responsibility for the account.
        </p>
      </div>
    );
  }

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy("profile");
    setError(null);
    setSaved(false);
    try {
      await updateOrg(org.org_id, {
        name: name.trim(), country, industryRole, timezone, workingWeek,
      });
      setSaved(true);
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save those settings.");
    } finally {
      setBusy(null);
    }
  };

  const claim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneNumberId.trim()) return;
    setBusy("whatsapp");
    setError(null);
    try {
      await claimWhatsappNumber(org.org_id, phoneNumberId.trim(), displayNumber.trim());
      setPhoneNumberId("");
      setDisplayNumber("");
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not claim that number.");
    } finally {
      setBusy(null);
    }
  };

  const deleteOrganisation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (confirmName.trim() !== org.name) return;
    setDeleting(true);
    setError(null);
    try {
      await deleteOrg(org.org_id, confirmName.trim());
      // Deliberately not resetting `deleting` on success — this org is gone
      // from the list `onChanged` triggers a refresh of, so the component is
      // about to unmount as the app routes elsewhere. Resetting first would
      // just flash the form re-enabled for a frame.
      onChanged();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the organisation.");
      setDeleting(false);
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
        onSubmit={saveProfile}
        className="rounded-xl border border-white/[0.06] bg-slate-900 p-4 space-y-3"
      >
        <div className="flex items-center gap-1.5 text-xs text-gray-300">
          <Building2 className="w-3.5 h-3.5 text-gray-500" />
          Organisation profile
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div>
            <label className="block text-[10px] text-gray-600 mb-1">Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div>
            <label className="block text-[10px] text-gray-600 mb-1">Country</label>
            <Input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="in, ae, gb…"
            />
          </div>
          <div>
            <label className="block text-[10px] text-gray-600 mb-1">Industry role</label>
            <select
              value={industryRole}
              onChange={(e) => setIndustryRole(e.target.value)}
              className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-gray-200 px-3 py-2 focus:outline-none focus:border-blue-500/50"
            >
              <option value="" className="bg-slate-900">
                Not set
              </option>
              <option value="gc" className="bg-slate-900">
                General contractor
              </option>
              <option value="subcontractor" className="bg-slate-900">
                Subcontractor
              </option>
              <option value="owner" className="bg-slate-900">
                Owner / developer
              </option>
              <option value="consultant" className="bg-slate-900">
                Consultant / PMC
              </option>
            </select>
          </div>
        </div>
        {/* Load-bearing, not preferences. A field report saying "done this morning"
            is placed on the programme with the timezone, and every duration and
            float figure depends on which days are worked. Organisations created
            before these existed have them unset — which is why they are editable
            here and not only at signup. */}
        <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 space-y-3">
          <p className="text-[11px] text-gray-400">Site calendar</p>
          {(!org.timezone || !org.working_week) && (
            <p className="text-[10px] text-amber-300/80">
              Not set. Until it is, report timestamps are read as UTC and float is
              calculated on a five-day week.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-gray-600 mb-1">Timezone</label>
              <Input
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                placeholder="Asia/Kolkata"
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-600 mb-1">Working week</label>
              <select
                value={workingWeek}
                onChange={(e) => setWorkingWeek(e.target.value)}
                className="w-full rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-gray-200 px-3 py-2 focus:outline-none focus:border-blue-500/50"
              >
                <option value="" className="bg-slate-900">Not set</option>
                <option value="mon-sat" className="bg-slate-900">Monday – Saturday</option>
                <option value="mon-fri" className="bg-slate-900">Monday – Friday</option>
                <option value="sun-thu" className="bg-slate-900">Sunday – Thursday</option>
                <option value="sat-thu" className="bg-slate-900">Saturday – Thursday</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <p className="text-[10px] text-gray-600 font-mono">
            {org.slug} · {org.org_id}
          </p>
          <div className="flex items-center gap-2">
            {saved && (
              <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Saved
              </span>
            )}
            <Button type="submit" disabled={busy === "profile"}>
              {busy === "profile" ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : null}
              Save
            </Button>
          </div>
        </div>
      </form>

      <div className="rounded-xl border border-white/[0.06] bg-slate-900 p-4 space-y-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-300">
          <MessageCircle className="w-3.5 h-3.5 text-gray-500" />
          WhatsApp Business number
        </div>

        {org.wa_phone_number_id ? (
          <div className="rounded-lg bg-emerald-500/[0.06] border border-emerald-500/20 px-3 py-2.5">
            <p className="text-xs text-emerald-300 flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              Connected
            </p>
            <p className="text-[11px] text-gray-400 mt-1">
              {org.wa_display_number || "number not labelled"}
            </p>
            <p className="text-[10px] text-gray-600 font-mono mt-0.5">
              phone_number_id {org.wa_phone_number_id}
            </p>
          </div>
        ) : (
          <div className="rounded-lg bg-white/[0.03] border border-white/[0.06] px-3 py-2.5">
            <p className="text-xs text-gray-400">No number connected.</p>
            <p className="text-[10px] text-gray-600 mt-1">
              Field reports cannot arrive over WhatsApp until one is claimed. Everything
              else in the product works without it.
            </p>
          </div>
        )}

        <form onSubmit={claim} className="space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] text-gray-600 mb-1">
                Meta phone_number_id
              </label>
              <Input
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                placeholder="1234567890123456"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] text-gray-600 mb-1">
                Display number (for your reference)
              </label>
              <Input
                value={displayNumber}
                onChange={(e) => setDisplayNumber(e.target.value)}
                placeholder="+91 98765 43210"
              />
            </div>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-[10px] text-gray-600">
              Found in Meta Business Suite under WhatsApp → API Setup. This is the id of the
              number <em>we</em> receive on, not a reporter's phone.
            </p>
            <Button
              type="submit"
              disabled={busy === "whatsapp" || !phoneNumberId.trim()}
              className="shrink-0"
            >
              {busy === "whatsapp" ? (
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
              ) : null}
              {org.wa_phone_number_id ? "Replace" : "Connect"}
            </Button>
          </div>
        </form>
      </div>

      <p className="text-[10px] text-gray-600">
        A number can belong to exactly one organisation. Claiming one already held elsewhere
        is refused rather than silently splitting that number's inbound traffic between two
        tenants — the routing key has to stay unambiguous for an evidence trail to mean
        anything.
      </p>

      <div className="rounded-xl border border-red-500/25 bg-red-500/[0.04] p-4 space-y-3">
        <div className="flex items-center gap-1.5 text-xs text-red-300">
          <AlertTriangle className="w-3.5 h-3.5" />
          Danger zone
        </div>

        <div className="rounded-lg bg-black/20 px-3 py-2.5 space-y-1">
          <p className="text-xs text-gray-300">Delete this organisation</p>
          <p className="text-[10px] text-gray-500">
            Removes every member's access and archives every project in it. This cannot be
            undone from here. Nothing is destroyed — projects keep their full evidence
            history, since a dispute can still be litigated long after an account closes —
            but nobody, including you, can act on any of it again without support's help.
          </p>
        </div>

        <form onSubmit={deleteOrganisation} className="space-y-2">
          <label className="block text-[10px] text-gray-600">
            Type <span className="font-mono text-gray-400">{org.name}</span> to confirm
          </label>
          <div className="flex items-center gap-2 flex-wrap">
            <Input
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={org.name}
              className="max-w-xs"
            />
            <Button
              type="submit"
              disabled={deleting || confirmName.trim() !== org.name}
              className="bg-red-600 hover:bg-red-500 text-white shrink-0"
            >
              {deleting ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : null}
              Delete organisation
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { KeyRound, Plus, X } from "lucide-react";

export type AccessCode = {
  id: string;
  title: string;
  passcode: string;
  location: string;
  notes: string;
};

const defaultAccessCodes: AccessCode[] = [];

export function AccessCodesManager({ initialAccessCodes = defaultAccessCodes }: { initialAccessCodes?: AccessCode[] }) {
  const [accessCodes, setAccessCodes] = useState<AccessCode[]>(initialAccessCodes);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [revealedIds, setRevealedIds] = useState<string[]>([]);
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState({
    title: "",
    passcode: "",
    location: "",
    notes: ""
  });

  const sortedAccessCodes = useMemo(
    () => [...accessCodes].sort((a, b) => a.title.localeCompare(b.title)),
    [accessCodes]
  );

  function resetForm() {
    setDraft({
      title: "",
      passcode: "",
      location: "",
      notes: ""
    });
    setFormError("");
  }

  async function handleCreateAccessCode() {
    if (!draft.title.trim() || !draft.passcode.trim()) {
      setFormError("Title and passcode are required.");
      return;
    }

    setSaving(true);
    setFormError("");

    const response = await fetch("/api/info/access-codes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(draft)
    });

    const payload = (await response.json()) as { accessCode?: AccessCode; error?: string };
    setSaving(false);

    if (!response.ok || !payload.accessCode) {
      setFormError(payload.error ?? "Failed to create access code.");
      return;
    }

    const createdAccessCode = payload.accessCode;
    if (!createdAccessCode) {
      setFormError("Failed to create access code.");
      return;
    }

    setAccessCodes((current) => [createdAccessCode, ...current]);
    setMessage("Access code saved.");

    setOpen(false);
    resetForm();
  }

  function togglePasscodeReveal(accessCodeId: string) {
    setRevealedIds((current) => (current.includes(accessCodeId) ? current.filter((id) => id !== accessCodeId) : [...current, accessCodeId]));
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
            <KeyRound className="h-3.5 w-3.5" />
            Access Codes
          </div>
          <h3 className="mt-3 text-lg font-semibold">Apartment Access</h3>
          <p className="mt-2 text-sm text-slate-500">Store door codes, Wi-Fi passcodes, and other access details in one place.</p>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" />
          Add access code
        </button>
      </div>

      <div className="mt-5 grid gap-3">
        {sortedAccessCodes.length > 0 ? (
          sortedAccessCodes.map((accessCode) => (
            <article key={accessCode.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="text-base font-semibold text-slate-900">{accessCode.title}</h4>
                  {accessCode.location ? <p className="mt-1 text-sm text-slate-600">{accessCode.location}</p> : null}
                </div>

                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-right">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Passcode</p>
                  {revealedIds.includes(accessCode.id) ? (
                    <p className="font-mono text-sm text-slate-800">{accessCode.passcode}</p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => togglePasscodeReveal(accessCode.id)}
                      className="font-mono text-sm text-amber-700 underline-offset-2 hover:underline"
                    >
                      Click to show passcode
                    </button>
                  )}
                  {revealedIds.includes(accessCode.id) ? (
                    <button
                      type="button"
                      onClick={() => togglePasscodeReveal(accessCode.id)}
                      className="mt-1 block text-xs text-slate-600 underline-offset-2 hover:underline"
                    >
                      Hide passcode
                    </button>
                  ) : null}
                </div>
              </div>

              {accessCode.notes ? <p className="mt-3 text-sm text-slate-500">{accessCode.notes}</p> : null}
            </article>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
            No access codes added yet. Add the first one to keep apartment access organized.
          </div>
        )}
      </div>

      {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold">Add access code</h3>
                <p className="mt-1 text-sm text-slate-500">Title and passcode are required. The other fields are optional.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 p-2 text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium">
                <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Title</span>
                <input
                  value={draft.title}
                  onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Passcode</span>
                <input
                  value={draft.passcode}
                  onChange={(event) => setDraft((current) => ({ ...current, passcode: event.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
                <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Location</span>
                <input
                  value={draft.location}
                  onChange={(event) => setDraft((current) => ({ ...current, location: event.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
                <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Notes</span>
                <textarea
                  value={draft.notes}
                  onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                  className="min-h-24 rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
            </div>

            {formError ? <p className="mt-3 text-sm text-rose-700">{formError}</p> : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" disabled={saving} onClick={() => void handleCreateAccessCode()} className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
                {saving ? "Saving..." : "Save access code"}
              </button>
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setOpen(false);
                }}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

    </div>
  );
}

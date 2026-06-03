"use client";

import { useMemo, useState } from "react";
import { PhoneCall, Plus, X } from "lucide-react";

type EmergencyContact = {
  id: string;
  title: string;
  name: string;
  phoneNumber: string;
};

const initialEmergencyContacts: EmergencyContact[] = [];

export function EmergencyContactsManager() {
  const [contacts, setContacts] = useState<EmergencyContact[]>(initialEmergencyContacts);
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState("");
  const [draft, setDraft] = useState({
    title: "",
    name: "",
    phoneNumber: ""
  });

  const sortedContacts = useMemo(
    () => [...contacts].sort((a, b) => a.title.localeCompare(b.title)),
    [contacts]
  );

  function resetForm() {
    setDraft({
      title: "",
      name: "",
      phoneNumber: ""
    });
    setFormError("");
  }

  function handleCreateContact() {
    if (!draft.title.trim() || !draft.name.trim() || !draft.phoneNumber.trim()) {
      setFormError("Title, name, and phone number are required.");
      return;
    }

    setContacts((current) => [
      {
        id: crypto.randomUUID(),
        title: draft.title.trim(),
        name: draft.name.trim(),
        phoneNumber: draft.phoneNumber.trim()
      },
      ...current
    ]);

    setOpen(false);
    resetForm();
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-medium text-rose-800">
            <PhoneCall className="h-3.5 w-3.5" />
            Emergency Contacts
          </div>
          <h3 className="mt-3 text-lg font-semibold">Urgent Contacts</h3>
          <p className="mt-2 text-sm text-slate-500">Keep emergency services, building staff, and repair contacts in one place.</p>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-rose-700 px-4 py-2 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" />
          Add contact
        </button>
      </div>

      <div className="mt-5 grid gap-3">
        {sortedContacts.length > 0 ? (
          sortedContacts.map((contact) => (
            <article key={contact.id} className="rounded-xl border border-slate-200 bg-[#fbf8f2] p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h4 className="text-base font-semibold text-slate-900">{contact.title}</h4>
                  <p className="mt-1 text-sm text-slate-600">{contact.name}</p>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-right">
                  <p className="text-[11px] uppercase tracking-[0.14em] text-slate-400">Phone</p>
                  <p className="font-mono text-sm text-slate-800">{contact.phoneNumber}</p>
                </div>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
            No emergency contacts added yet. Add the first one before you need it.
          </div>
        )}
      </div>

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-[#fbf8f2] p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold">Add emergency contact</h3>
                <p className="mt-1 text-sm text-slate-500">Fill in the title, name, and phone number for this contact.</p>
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
                <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Name</span>
                <input
                  value={draft.name}
                  onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
                <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Phone Number</span>
                <input
                  value={draft.phoneNumber}
                  onChange={(event) => setDraft((current) => ({ ...current, phoneNumber: event.target.value }))}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
            </div>

            {formError ? <p className="mt-3 text-sm text-rose-700">{formError}</p> : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" onClick={handleCreateContact} className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-medium text-white">
                Save contact
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

"use client";

import { useMemo, useState } from "react";
import { Users, Plus, X } from "lucide-react";

export type Contact = {
  id: string;
  name: string;
  number: string;
  email: string;
  address: string;
  function: string;
  isStaff: boolean;
  isMaintenance?: boolean;
  maintenanceCategory?: string;
};

const defaultContacts: Contact[] = [];

function formatPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);

  if (digits.length <= 3) {
    return digits;
  }

  if (digits.length <= 6) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  }

  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export function ContactsManager({ initialContacts = defaultContacts }: { initialContacts?: Contact[] }) {
  const [contacts, setContacts] = useState<Contact[]>(initialContacts);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [message, setMessage] = useState("");
  const [draft, setDraft] = useState({
    name: "",
    number: "",
    email: "",
    address: "",
    function: "",
    isStaff: false,
    isMaintenance: false,
    maintenanceCategory: "",
    maintenanceThresholdDays: 30
  });

  const sortedContacts = useMemo(
    () => [...contacts].sort((a, b) => a.name.localeCompare(b.name)),
    [contacts]
  );

  function resetForm() {
    setDraft({
      name: "",
      number: "",
      email: "",
      address: "",
      function: "",
      isStaff: false,
      isMaintenance: false,
      maintenanceCategory: "",
      maintenanceThresholdDays: 30
    });
    setFormError("");
  }

  async function handleCreateContact() {
    const hasContactMethod = Boolean(draft.number.trim() || draft.email.trim() || draft.address.trim());

    if (!draft.name.trim() || !draft.function.trim()) {
      setFormError("Name and function are required.");
      return;
    }

    if (!hasContactMethod) {
      setFormError("Please provide at least one contact field: phone, email, or address.");
      return;
    }

    setSaving(true);
    setFormError("");

    const response = await fetch("/api/info/contacts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(draft)
    });

    const payload = (await response.json()) as { contact?: Contact; error?: string; message?: string };
    setSaving(false);

    if (!response.ok || !payload.contact) {
      setFormError(payload.error ?? "Failed to create contact.");
      return;
    }

    const createdContact = payload.contact;
    if (!createdContact) {
      setFormError("Failed to create contact.");
      return;
    }

    setContacts((current) => [createdContact, ...current]);
    setMessage(payload.message ?? "Contact saved.");

    setOpen(false);
    resetForm();
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
            <Users className="h-3.5 w-3.5" />
            Contacts & Directory
          </div>
          <h3 className="mt-3 text-lg font-semibold">Apartment Contacts</h3>
          <p className="mt-2 text-sm text-slate-500">Add family members, building personnel, and other important contacts here.</p>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white"
        >
          <Plus className="h-4 w-4" />
          Create contact
        </button>
      </div>

      <div className="mt-5 grid gap-3">
        {sortedContacts.length > 0 ? (
          sortedContacts.map((contact) => (
            <article key={contact.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-base font-semibold text-slate-900">{contact.name}</h4>
                    {contact.isStaff ? (
                      <span className="rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
                        Majestic Staff
                      </span>
                    ) : null}
                    {contact.isMaintenance ? (
                      <span className="rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
                        Maintenance: {contact.maintenanceCategory || contact.function}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-sm text-slate-600">{contact.function}</p>
                </div>

                <div className="text-right text-sm text-slate-700">
                  {contact.number ? <p>{contact.number}</p> : null}
                  {contact.email ? <p className="text-slate-500">{contact.email}</p> : null}
                </div>
              </div>

              {contact.address ? <p className="mt-3 text-sm text-slate-500">{contact.address}</p> : null}
            </article>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
            No contacts added yet. Create the first contact to start your directory.
          </div>
        )}
      </div>

      {message ? <p className="mt-3 text-sm text-slate-600">{message}</p> : null}

      {open ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-slate-50 p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-xl font-semibold">Create contact</h3>
                <p className="mt-1 text-sm text-slate-500">Fill in the contact details for the apartment directory.</p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="rounded-lg border border-slate-300 p-2 text-slate-700">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium">
                <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Name</span>
                <input value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Number</span>
                <input
                  value={draft.number}
                  onChange={(event) => setDraft((current) => ({ ...current, number: formatPhoneNumber(event.target.value) }))}
                  placeholder="(555) 123-4567"
                  className="rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Email</span>
                <input value={draft.email} onChange={(event) => setDraft((current) => ({ ...current, email: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="grid gap-1.5 text-sm font-medium">
                <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Address</span>
                <input value={draft.address} onChange={(event) => setDraft((current) => ({ ...current, address: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
                <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Function</span>
                <input value={draft.function} onChange={(event) => setDraft((current) => ({ ...current, function: event.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2" />
              </label>
            </div>

            <label className="mt-4 flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={draft.isStaff}
                onChange={(event) => setDraft((current) => ({ ...current, isStaff: event.target.checked }))}
              />
              Building personnel
            </label>

            <label className="mt-3 flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={draft.isMaintenance}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    isMaintenance: event.target.checked,
                    maintenanceCategory: event.target.checked ? current.maintenanceCategory || current.function : ""
                  }))
                }
              />
              Maintenance contact
            </label>

            {draft.isMaintenance ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium">
                  <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Maintenance category</span>
                  <input
                    value={draft.maintenanceCategory}
                    onChange={(event) => setDraft((current) => ({ ...current, maintenanceCategory: event.target.value }))}
                    placeholder="Example: Window cleaning"
                    className="rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-medium">
                  <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Threshold days</span>
                  <input
                    type="number"
                    min={1}
                    value={draft.maintenanceThresholdDays}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        maintenanceThresholdDays: Number(event.target.value) > 0 ? Number(event.target.value) : 1
                      }))
                    }
                    className="rounded-lg border border-slate-300 px-3 py-2"
                  />
                </label>
              </div>
            ) : null}

            {formError ? <p className="mt-3 text-sm text-rose-700">{formError}</p> : null}

            <div className="mt-5 flex flex-wrap gap-2">
              <button type="button" disabled={saving} onClick={() => void handleCreateContact()} className="rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60">
                {saving ? "Saving..." : "Create contact"}
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

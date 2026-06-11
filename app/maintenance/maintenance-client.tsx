"use client";

import { format } from "date-fns";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MaintenanceRecord, MaintenanceType, UserProfile } from "@/lib/types";

type ApiResult = {
  message?: string;
  error?: string;
  record?: MaintenanceRecord;
  recordId?: string;
  maintenanceType?: MaintenanceType;
};

export function MaintenanceClientPage({
  actingUser,
  maintenanceTypes,
  initialRecords
}: {
  actingUser: UserProfile;
  maintenanceTypes: MaintenanceType[];
  initialRecords: MaintenanceRecord[];
}) {
  const router = useRouter();
  const [records, setRecords] = useState(initialRecords);
  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeThresholdDays, setNewTypeThresholdDays] = useState(30);
  const [createWithContact, setCreateWithContact] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactFunction, setContactFunction] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactAddress, setContactAddress] = useState("");
  const [creatingType, setCreatingType] = useState(false);
  const [addTypeStatus, setAddTypeStatus] = useState("");
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [editTypeName, setEditTypeName] = useState("");
  const [editTypeThresholdDays, setEditTypeThresholdDays] = useState(30);
  const [editTypeStatus, setEditTypeStatus] = useState("");
  const [editTypeSubmitting, setEditTypeSubmitting] = useState(false);
  const [deleteTypeSubmitting, setDeleteTypeSubmitting] = useState(false);

  async function createMaintenanceType(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const typeName = newTypeName.trim();

    if (!typeName) {
      setAddTypeStatus("Maintenance type name is required.");
      return;
    }

    if (createWithContact) {
      if (!contactName.trim()) {
        setAddTypeStatus("Contact name is required when adding a contact.");
        return;
      }

      if (!contactPhone.trim() && !contactEmail.trim() && !contactAddress.trim()) {
        setAddTypeStatus("Add at least one contact method: phone, email, or address.");
        return;
      }
    }

    setCreatingType(true);
    setAddTypeStatus("");

    try {
      const response = await fetch(createWithContact ? "/api/info/contacts" : "/api/maintenance/types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          createWithContact
            ? {
                name: contactName.trim(),
                function: (contactFunction || typeName).trim(),
                number: contactPhone.trim(),
                email: contactEmail.trim(),
                address: contactAddress.trim(),
                isMaintenance: true,
                maintenanceCategory: typeName,
                maintenanceThresholdDays: newTypeThresholdDays
              }
            : {
                name: typeName,
                thresholdDays: newTypeThresholdDays
              }
        )
      });

      const payload = (await response.json()) as ApiResult;

      if (!response.ok) {
        setAddTypeStatus(payload.error ?? "Unable to add maintenance type.");
        return;
      }

      setAddTypeStatus(payload.message ?? `${typeName} added.`);
      setNewTypeName("");
      setNewTypeThresholdDays(30);
      setContactName("");
      setContactFunction("");
      setContactPhone("");
      setContactEmail("");
      setContactAddress("");
      router.refresh();
    } catch {
      setAddTypeStatus("Request failed.");
    } finally {
      setCreatingType(false);
    }
  }

  async function cancelMaintenanceRecord(recordId: string) {
    const confirmed = window.confirm("Cancel this maintenance booking?");
    if (!confirmed) {
      return;
    }

    setSubmitting(true);
    setStatus(null);

    try {
      const response = await fetch("/api/maintenance/records", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordId })
      });

      const payload = (await response.json()) as ApiResult;
      setStatus(payload);

      if (response.ok) {
        setRecords((current) => current.filter((record) => record.id !== recordId));
        router.refresh();
      }
    } catch {
      setStatus({ error: "Request failed." });
    } finally {
      setSubmitting(false);
    }
  }

  function startEditingType(typeId: string) {
    const typeToEdit = maintenanceTypes.find((t) => t.id === typeId);
    if (typeToEdit) {
      setEditingTypeId(typeId);
      setEditTypeName(typeToEdit.name);
      setEditTypeThresholdDays(typeToEdit.thresholdDays);
      setEditTypeStatus("");
    }
  }

  function closeEditTypeModal() {
    setEditingTypeId(null);
    setEditTypeName("");
    setEditTypeThresholdDays(30);
    setEditTypeStatus("");
    setEditTypeSubmitting(false);
    setDeleteTypeSubmitting(false);
  }

  async function submitEditType(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const typeName = editTypeName.trim();

    if (!typeName) {
      setEditTypeStatus("Maintenance type name is required.");
      return;
    }

    setEditTypeSubmitting(true);
    setEditTypeStatus("");

    try {
      const response = await fetch(`/api/maintenance/types/${editingTypeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: typeName,
          thresholdDays: editTypeThresholdDays
        })
      });

      const payload = (await response.json()) as ApiResult;

      if (!response.ok) {
        setEditTypeStatus(payload.error ?? "Unable to update maintenance type.");
        return;
      }

      setAddTypeStatus(payload.message ?? "Maintenance type updated.");
      closeEditTypeModal();
      router.refresh();
    } catch {
      setEditTypeStatus("Request failed.");
    } finally {
      setEditTypeSubmitting(false);
    }
  }

  async function deleteMaintenanceType() {
    if (!editingTypeId) {
      return;
    }

    const confirmed = window.confirm(`Delete ${editTypeName.trim() || "this maintenance type"}? This also removes related maintenance records and reminders.`);
    if (!confirmed) {
      return;
    }

    setDeleteTypeSubmitting(true);
    setEditTypeStatus("");

    try {
      const response = await fetch(`/api/maintenance/types/${editingTypeId}`, {
        method: "DELETE"
      });

      const payload = (await response.json()) as ApiResult;
      if (!response.ok) {
        setEditTypeStatus(payload.error ?? "Unable to delete maintenance type.");
        return;
      }

      setAddTypeStatus(payload.message ?? "Maintenance type deleted.");
      closeEditTypeModal();
      router.refresh();
    } catch {
      setEditTypeStatus("Request failed.");
    } finally {
      setDeleteTypeSubmitting(false);
    }
  }

  return (
    <section className="grid gap-6">
      <div className="card overflow-hidden p-5 sm:p-6">
        <h2 className="text-xl sm:text-2xl">Maintenance</h2>
        <p className="mt-2 text-sm text-slate-600">
          Log upcoming apartment care so the family can track what has been scheduled and when attention is due again.
        </p>

        <form className="mt-5 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4" onSubmit={createMaintenanceType}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Add maintenance type</h3>
              <p className="mt-1 text-sm text-slate-600">Create a type directly here, and optionally create a linked contact in the same flow.</p>
            </div>
            <label className="inline-flex items-center gap-2 text-sm font-medium text-slate-700">
              <input
                type="checkbox"
                checked={createWithContact}
                onChange={(event) => setCreateWithContact(event.target.checked)}
                className="h-4 w-4"
              />
              Add a contact now
            </label>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium">
              <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Type name</span>
              <input
                value={newTypeName}
                onChange={(event) => setNewTypeName(event.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2"
                placeholder="Example: Window cleaning"
                required
              />
            </label>

            <label className="grid gap-1.5 text-sm font-medium">
              <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Threshold days</span>
              <input
                type="number"
                min={1}
                value={newTypeThresholdDays}
                onChange={(event) => setNewTypeThresholdDays(Number(event.target.value) > 0 ? Number(event.target.value) : 1)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2"
                required
              />
              <span className="text-xs text-slate-500">
                This controls when users are notified to run this maintenance again after it was last completed.
              </span>
            </label>
          </div>

          {createWithContact ? (
            <div className="grid gap-3 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-sm font-medium">
                <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Contact name</span>
                <input value={contactName} onChange={(event) => setContactName(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" required />
              </label>

              <label className="grid gap-1.5 text-sm font-medium">
                <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Contact function</span>
                <input
                  value={contactFunction}
                  onChange={(event) => setContactFunction(event.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                  placeholder="Defaults to type name"
                />
              </label>

              <label className="grid gap-1.5 text-sm font-medium">
                <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Phone</span>
                <input value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" />
              </label>

              <label className="grid gap-1.5 text-sm font-medium">
                <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Email</span>
                <input type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" />
              </label>

              <label className="grid gap-1.5 text-sm font-medium sm:col-span-2">
                <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Address</span>
                <input value={contactAddress} onChange={(event) => setContactAddress(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" />
              </label>
            </div>
          ) : (
            <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-600">
              Non-contact type enabled. This maintenance type will be tracked without attaching a contact.
            </p>
          )}

          <button type="submit" disabled={creatingType} className="min-h-11 w-full rounded-lg bg-amber-700 px-4 py-2 text-white disabled:opacity-60 sm:w-auto">
            {creatingType ? "Adding..." : "Add maintenance type"}
          </button>

          {addTypeStatus ? <p className="text-sm text-slate-700">{addTypeStatus}</p> : null}
        </form>

        <div className="card p-5 sm:p-6">
          <div className="flex items-end justify-between gap-3">
            <div>
              <h3 className="text-lg sm:text-xl">Maintenance Types</h3>
              <p className="mt-1 text-sm text-slate-500">Each type shows its current threshold in a compact card. Edit opens the modal.</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {maintenanceTypes.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500 sm:col-span-2 xl:col-span-3">
                No maintenance types yet. Add one above to get started.
              </div>
            ) : (
              maintenanceTypes.map((maintenanceType) => (
                <article
                  key={maintenanceType.id}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{maintenanceType.name}</p>
                      <p className="mt-1 inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                        Threshold: {maintenanceType.thresholdDays} days
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => startEditingType(maintenanceType.id)}
                      className="min-h-10 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Edit
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </div>

      </div>

      <div className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg sm:text-xl">Recent Maintenance Logs</h3>
            <p className="mt-1 text-sm text-slate-500">Latest scheduled maintenance activity across all types.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          {records.length > 0 ? (
            records.map((record) => (
              <article key={record.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 sm:px-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-slate-900">{record.typeName}</h4>
                    <p className="mt-1 text-sm text-slate-600">Scheduled for {record.scheduledFor}</p>
                    <p className="mt-1 text-sm text-slate-500">Logged by {record.createdByName}</p>
                  </div>
                  <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">Maintenance</span>
                    {record.createdByUserId === actingUser.id && record.scheduledFor >= format(new Date(), "yyyy-MM-dd") ? (
                      <button
                        type="button"
                        disabled={submitting}
                        onClick={() => {
                          void cancelMaintenanceRecord(record.id);
                        }}
                        className="min-h-10 w-full rounded-lg border border-rose-300 px-3 py-1 text-xs font-medium text-rose-700 disabled:opacity-60 sm:w-auto"
                      >
                        Cancel booking
                      </button>
                    ) : null}
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
              No maintenance has been logged yet.
            </div>
          )}
        </div>
      </div>

      {editingTypeId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 px-4 py-6 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Edit maintenance type</h3>
                <p className="mt-1 text-sm text-slate-600">Update details or delete this type.</p>
              </div>
              <button
                type="button"
                onClick={closeEditTypeModal}
                className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <form className="mt-5 grid gap-4" onSubmit={submitEditType}>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-medium">
                  <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Type name</span>
                  <input
                    value={editTypeName}
                    onChange={(event) => setEditTypeName(event.target.value)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2"
                    placeholder="Example: Window cleaning"
                    required
                  />
                </label>

                <label className="grid gap-1.5 text-sm font-medium">
                  <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Threshold days</span>
                  <input
                    type="number"
                    min={1}
                    value={editTypeThresholdDays}
                    onChange={(event) => setEditTypeThresholdDays(Number(event.target.value) > 0 ? Number(event.target.value) : 1)}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-2"
                    required
                  />
                </label>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  type="submit"
                  disabled={editTypeSubmitting || deleteTypeSubmitting}
                  className="min-h-11 rounded-lg bg-amber-700 px-4 py-2 text-white disabled:opacity-60"
                >
                  {editTypeSubmitting ? "Saving..." : "Save changes"}
                </button>
                <button
                  type="button"
                  disabled={editTypeSubmitting || deleteTypeSubmitting}
                  onClick={() => {
                    void deleteMaintenanceType();
                  }}
                  className="min-h-11 rounded-lg border border-rose-300 bg-white px-4 py-2 text-rose-700 disabled:opacity-60"
                >
                  {deleteTypeSubmitting ? "Deleting..." : "Delete type"}
                </button>
              </div>

              {editTypeStatus ? <p className="text-sm text-slate-700">{editTypeStatus}</p> : null}
            </form>
          </div>
        </div>
      ) : null}
    </section>
  );
}

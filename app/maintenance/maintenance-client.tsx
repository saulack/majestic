"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MaintenanceRecord, MaintenanceType, UserProfile } from "@/lib/types";

type ApiResult = {
  message?: string;
  error?: string;
  record?: MaintenanceRecord;
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
  const [selectedTypeId, setSelectedTypeId] = useState(maintenanceTypes[0]?.id ?? "");
  const [scheduledFor, setScheduledFor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [records, setRecords] = useState(initialRecords);
  const [status, setStatus] = useState<ApiResult | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setStatus(null);

    try {
      const response = await fetch("/api/maintenance/records", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ maintenanceTypeId: selectedTypeId, scheduledFor })
      });

      const payload = (await response.json()) as ApiResult;
      setStatus(payload);

      if (response.ok && payload.record) {
        setRecords((current) => [payload.record!, ...current]);
        setScheduledFor("");
        router.refresh();
      }
    } catch {
      setStatus({ error: "Request failed." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="grid gap-6">
      <div className="card overflow-hidden p-5 sm:p-6">
        <h2 className="text-xl sm:text-2xl">Maintenance</h2>
        <p className="mt-2 text-sm text-slate-600">
          Log upcoming apartment care so the family can track what has been scheduled and when attention is due again.
        </p>

        <form className="mt-5 grid gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-3" onSubmit={handleSubmit}>
          <label className="grid gap-1.5 text-sm font-medium">
            <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Maintenance type</span>
            <select
              value={selectedTypeId}
              onChange={(event) => setSelectedTypeId(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2"
              required
            >
              {maintenanceTypes.map((maintenanceType) => (
                <option key={maintenanceType.id} value={maintenanceType.id}>
                  {maintenanceType.name}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1.5 text-sm font-medium">
            <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Scheduled date</span>
            <input
              type="date"
              value={scheduledFor}
              onChange={(event) => setScheduledFor(event.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2"
              required
            />
          </label>

          <div className="flex items-end">
            <button type="submit" disabled={submitting || !selectedTypeId} className="rounded-lg bg-amber-700 px-4 py-2 text-white disabled:opacity-60">
              {submitting ? "Saving..." : "Log maintenance"}
            </button>
          </div>
        </form>

        {status?.message || status?.error ? (
          <p className={`mt-4 text-sm ${status.error ? "text-rose-700" : "text-emerald-700"}`}>{status.error ?? status.message}</p>
        ) : null}

        <div className="mt-4 rounded-xl border border-[#bde3df] bg-[#f1fbf9] px-4 py-3 text-sm text-[#2f7b84]">
          Signed in as {actingUser.fullName}. Every maintenance log also appears in the shared activity log.
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
                  <span className="rounded-full border border-[#bde3df] bg-[#f1fbf9] px-3 py-1 text-xs font-medium text-[#2f7b84]">Maintenance</span>
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
    </section>
  );
}
"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { MaintenanceRecord, MaintenanceThresholdApproval, MaintenanceType, UserProfile } from "@/lib/types";

type ApiResult = {
  message?: string;
  error?: string;
  record?: MaintenanceRecord;
};

export function MaintenanceClientPage({
  actingUser,
  maintenanceTypes,
  initialRecords,
  initialPendingThresholdApprovals
}: {
  actingUser: UserProfile;
  maintenanceTypes: MaintenanceType[];
  initialRecords: MaintenanceRecord[];
  initialPendingThresholdApprovals: MaintenanceThresholdApproval[];
}) {
  const router = useRouter();
  const initialPendingThresholdByType = Object.fromEntries(
    initialPendingThresholdApprovals.map((approval) => [approval.maintenanceTypeId, approval])
  );
  const [selectedTypeId, setSelectedTypeId] = useState(maintenanceTypes[0]?.id ?? "");
  const [scheduledFor, setScheduledFor] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [records, setRecords] = useState(initialRecords);
  const [status, setStatus] = useState<ApiResult | null>(null);
  const hasMaintenanceTypes = maintenanceTypes.length > 0;
  const [thresholdDrafts, setThresholdDrafts] = useState<Record<string, number>>(
    Object.fromEntries(
      maintenanceTypes.map((maintenanceType) => [maintenanceType.id, initialPendingThresholdByType[maintenanceType.id]?.proposedThresholdDays ?? maintenanceType.thresholdDays])
    )
  );
  const [pendingThresholdByType, setPendingThresholdByType] = useState<Record<string, MaintenanceThresholdApproval>>(initialPendingThresholdByType);
  const [thresholdStatusByType, setThresholdStatusByType] = useState<Record<string, string>>({});
  const [thresholdSubmittingByType, setThresholdSubmittingByType] = useState<Record<string, boolean>>({});

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

  async function submitThresholdRequest(maintenanceTypeId: string) {
    setThresholdSubmittingByType((current) => ({ ...current, [maintenanceTypeId]: true }));

    try {
      const response = await fetch("/api/maintenance/threshold-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          maintenanceTypeId,
          thresholdDays: thresholdDrafts[maintenanceTypeId]
        })
      });

      const payload = (await response.json()) as ApiResult;
      setThresholdStatusByType((current) => ({
        ...current,
        [maintenanceTypeId]: payload.error ?? payload.message ?? "Threshold change submitted."
      }));

      if (response.ok) {
        setPendingThresholdByType((current) => ({
          ...current,
          [maintenanceTypeId]: {
            id: current[maintenanceTypeId]?.id ?? `pending-${maintenanceTypeId}`,
            maintenanceTypeId,
            maintenanceTypeName: maintenanceTypes.find((entry) => entry.id === maintenanceTypeId)?.name ?? "Maintenance type",
            proposedThresholdDays: thresholdDrafts[maintenanceTypeId],
            requestedByUserId: actingUser.id,
            requestedByName: actingUser.fullName,
            status: "pending",
            createdAt: new Date().toISOString()
          }
        }));
        router.refresh();
      }
    } catch {
      setThresholdStatusByType((current) => ({
        ...current,
        [maintenanceTypeId]: "Request failed."
      }));
    } finally {
      setThresholdSubmittingByType((current) => ({ ...current, [maintenanceTypeId]: false }));
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
              disabled={!hasMaintenanceTypes}
            >
              {!hasMaintenanceTypes ? <option value="">No maintenance categories available</option> : null}
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

        {!hasMaintenanceTypes ? (
          <p className="mt-3 text-sm text-amber-700">
            Ask an admin to mark at least one contact as a maintenance contact in the Info section.
          </p>
        ) : null}

        {status?.message || status?.error ? (
          <p className={`mt-4 text-sm ${status.error ? "text-rose-700" : "text-emerald-700"}`}>{status.error ?? status.message}</p>
        ) : null}

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
          Signed in as {actingUser.fullName}. Every maintenance log also appears in the shared activity log.
        </div>
      </div>

      <div className="card p-5 sm:p-6">
        <div>
          <h3 className="text-lg sm:text-xl">Maintenance Thresholds</h3>
          <p className="mt-1 text-sm text-slate-500">Update reminder intervals by maintenance type. Non-superadmin changes require site administrator approval.</p>
        </div>

        <div className="mt-4 grid gap-3">
          {maintenanceTypes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
              No maintenance categories yet. Add a contact as a maintenance contact to create one.
            </div>
          ) : maintenanceTypes.map((maintenanceType) => (
            <form
              key={maintenanceType.id}
              className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5"
              onSubmit={(event) => {
                event.preventDefault();
                void submitThresholdRequest(maintenanceType.id);
              }}
            >
              <div className="min-w-52 flex-1">
                <p className="text-sm font-semibold text-slate-900">{maintenanceType.name}</p>
                <p className="mt-1 text-xs text-slate-500">Current threshold: {maintenanceType.thresholdDays} days</p>
                {pendingThresholdByType[maintenanceType.id] ? (
                  <p className="mt-1 text-xs font-medium text-amber-700">
                    Pending threshold: {pendingThresholdByType[maintenanceType.id].proposedThresholdDays} days
                  </p>
                ) : null}
              </div>

              <label className="grid gap-1.5 text-sm font-medium">
                <span className="text-xs uppercase tracking-[0.12em] text-slate-500">New threshold days</span>
                <input
                  type="number"
                  min={1}
                  value={thresholdDrafts[maintenanceType.id] ?? maintenanceType.thresholdDays}
                  onChange={(event) =>
                    setThresholdDrafts((current) => ({
                      ...current,
                      [maintenanceType.id]: Number(event.target.value) > 0 ? Number(event.target.value) : 1
                    }))
                  }
                  className="w-36 rounded-lg border border-slate-300 px-3 py-2"
                  required
                />
              </label>

              <button
                type="submit"
                disabled={Boolean(thresholdSubmittingByType[maintenanceType.id])}
                className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 disabled:opacity-60"
              >
                {thresholdSubmittingByType[maintenanceType.id] ? "Submitting..." : "Submit threshold"}
              </button>

              {thresholdStatusByType[maintenanceType.id] ? (
                <p className="w-full text-sm text-slate-600">{thresholdStatusByType[maintenanceType.id]}</p>
              ) : null}
            </form>
          ))}
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
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">Maintenance</span>
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
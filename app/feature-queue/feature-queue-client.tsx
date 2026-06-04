"use client";

import { parseISO } from "date-fns";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import type { FeatureRequest } from "@/lib/types";

type ApiResult = {
  message?: string;
  error?: string;
};

export function FeatureQueueClient({ requests }: { requests: FeatureRequest[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [sortBy, setSortBy] = useState<"score" | "date">("score");
  const [pastVisibleCount, setPastVisibleCount] = useState(12);

  const inProgressRequests = useMemo(() => requests.filter((request) => request.status === "in_progress"), [requests]);
  const featureRequests = useMemo(() => sortRequests(inProgressRequests.filter((request) => request.requestType === "feature"), sortBy), [inProgressRequests, sortBy]);
  const bugReports = useMemo(() => sortRequests(inProgressRequests.filter((request) => request.requestType === "bug"), sortBy), [inProgressRequests, sortBy]);
  const pastRequests = useMemo(
    () =>
      sortRequests(
        requests.filter((request) => request.status === "completed" || request.status === "declined" || request.status === "rejected"),
        "date"
      ),
    [requests]
  );

  const visiblePastRequests = useMemo(() => pastRequests.slice(0, pastVisibleCount), [pastRequests, pastVisibleCount]);
  const canLoadMorePast = pastVisibleCount < pastRequests.length;

  const topFeatureByBugs = useMemo(() => {
    const byTitle = new Map<string, { title: string; bugCount: number; featureCount: number; openedBy: Set<string> }>();

    for (const request of requests) {
      const normalizedTitle = request.title.trim().toLowerCase();
      const existing = byTitle.get(normalizedTitle) ?? {
        title: request.title,
        bugCount: 0,
        featureCount: 0,
        openedBy: new Set<string>()
      };

      if (request.requestType === "bug") {
        existing.bugCount += 1;
      } else {
        existing.featureCount += 1;
      }
      existing.openedBy.add(request.requestedByName);
      byTitle.set(normalizedTitle, existing);
    }

    return [...byTitle.values()]
      .filter((entry) => entry.bugCount > 0)
      .sort((left, right) => right.bugCount - left.bugCount || right.featureCount - left.featureCount)
      .slice(0, 8);
  }, [requests]);

  const topFeatureByRequests = useMemo(() => {
    const byTitle = new Map<string, { title: string; bugCount: number; featureCount: number; openedBy: Set<string> }>();

    for (const request of requests) {
      const normalizedTitle = request.title.trim().toLowerCase();
      const existing = byTitle.get(normalizedTitle) ?? {
        title: request.title,
        bugCount: 0,
        featureCount: 0,
        openedBy: new Set<string>()
      };

      if (request.requestType === "feature") {
        existing.featureCount += 1;
      } else {
        existing.bugCount += 1;
      }
      existing.openedBy.add(request.requestedByName);
      byTitle.set(normalizedTitle, existing);
    }

    return [...byTitle.values()]
      .filter((entry) => entry.featureCount > 0)
      .sort((left, right) => right.featureCount - left.featureCount || right.bugCount - left.bugCount)
      .slice(0, 8);
  }, [requests]);

  const peopleStats = useMemo(() => {
    const byPerson = new Map<string, { name: string; featureCount: number; bugCount: number; total: number }>();

    for (const request of requests) {
      const existing = byPerson.get(request.requestedByUserId) ?? {
        name: request.requestedByName,
        featureCount: 0,
        bugCount: 0,
        total: 0
      };

      if (request.requestType === "feature") {
        existing.featureCount += 1;
      } else {
        existing.bugCount += 1;
      }

      existing.total += 1;
      byPerson.set(request.requestedByUserId, existing);
    }

    return [...byPerson.values()].sort((left, right) => right.total - left.total || left.name.localeCompare(right.name));
  }, [requests]);

  async function updateRequest(requestId: string, action: "complete" | "reject") {
    setBusyId(requestId);
    setStatus("");

    const response = await fetch("/api/admin/feature-queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ requestId, action })
    });

    const payload = (await response.json()) as ApiResult;
    setBusyId(null);

    if (!response.ok) {
      setStatus(payload.error ?? "Unable to update request.");
      return;
    }

    setStatus(payload.message ?? "Queue item updated.");
    router.refresh();
  }

  return (
    <section className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl">Request Queue</h2>
          <p className="mt-2 text-sm text-slate-600">Items currently in progress. Mark each one complete or rejected.</p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1">
          <button
            type="button"
            onClick={() => setSortBy("score")}
            className={["rounded-md px-3 py-1.5 text-sm", sortBy === "score" ? "bg-amber-700 text-white" : "text-slate-700"].join(" ")}
          >
            Score
          </button>
          <button
            type="button"
            onClick={() => setSortBy("date")}
            className={["rounded-md px-3 py-1.5 text-sm", sortBy === "date" ? "bg-amber-700 text-white" : "text-slate-700"].join(" ")}
          >
            Date
          </button>
        </div>
      </div>

      {status ? <p className="mt-3 text-sm text-slate-700">{status}</p> : null}

      <div className="mt-5 grid gap-4">
        <QueueSection title="Feature Requests" requests={featureRequests} busyId={busyId} updateRequest={updateRequest} />
        <QueueSection title="Bug Reports" requests={bugReports} busyId={busyId} updateRequest={updateRequest} />
      </div>

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
        <h3 className="text-base font-semibold text-slate-900">Past Requests</h3>
        <p className="mt-1 text-sm text-slate-600">History of completed, declined, and rejected requests.</p>

        <div className="mt-3 grid gap-3">
          {visiblePastRequests.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-5 text-sm text-slate-500">No past requests yet.</div>
          ) : (
            visiblePastRequests.map((request) => (
              <article key={request.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{request.title}</p>
                    <p className="mt-1 text-sm text-slate-600">Opened by {request.requestedByName}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {request.requestType === "bug" ? "Bug report" : "Feature request"} · {request.voteCount ?? 0} boost
                      {(request.voteCount ?? 0) === 1 ? "" : "s"}
                    </p>
                  </div>
                  <span className={statusBadgeClass(request.status)}>{formatStatusLabel(request.status)}</span>
                </div>
              </article>
            ))
          )}
        </div>

        {canLoadMorePast ? (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setPastVisibleCount((current) => current + 12)}
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Load more history
            </button>
          </div>
        ) : null}
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
          <h3 className="text-base font-semibold text-slate-900">Features With Most Bugs</h3>
          <div className="mt-3 grid gap-3">
            {topFeatureByBugs.length === 0 ? (
              <p className="text-sm text-slate-500">No bug reports logged yet.</p>
            ) : (
              topFeatureByBugs.map((entry) => (
                <article key={`bugs-${entry.title}`} className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-sm font-semibold text-slate-900">{entry.title}</p>
                  <p className="mt-1 text-xs text-slate-600">Bugs: {entry.bugCount} · Feature requests: {entry.featureCount}</p>
                  <p className="mt-1 text-xs text-slate-500">Opened by: {[...entry.openedBy].join(", ")}</p>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
          <h3 className="text-base font-semibold text-slate-900">Most Requested Features</h3>
          <div className="mt-3 grid gap-3">
            {topFeatureByRequests.length === 0 ? (
              <p className="text-sm text-slate-500">No feature requests logged yet.</p>
            ) : (
              topFeatureByRequests.map((entry) => (
                <article key={`features-${entry.title}`} className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-sm font-semibold text-slate-900">{entry.title}</p>
                  <p className="mt-1 text-xs text-slate-600">Feature requests: {entry.featureCount} · Bugs: {entry.bugCount}</p>
                  <p className="mt-1 text-xs text-slate-500">Opened by: {[...entry.openedBy].join(", ")}</p>
                </article>
              ))
            )}
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
        <h3 className="text-base font-semibold text-slate-900">People Stats</h3>
        <p className="mt-1 text-sm text-slate-600">How many bugs and feature requests each person has opened.</p>

        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.08em] text-slate-500">
              <tr>
                <th className="px-3 py-2.5">Person</th>
                <th className="px-3 py-2.5">Feature requests</th>
                <th className="px-3 py-2.5">Bug reports</th>
                <th className="px-3 py-2.5">Total opened</th>
              </tr>
            </thead>
            <tbody>
              {peopleStats.map((entry) => (
                <tr key={entry.name} className="border-b border-slate-100 last:border-b-0">
                  <td className="px-3 py-2.5 font-medium text-slate-800">{entry.name}</td>
                  <td className="px-3 py-2.5 text-slate-700">{entry.featureCount}</td>
                  <td className="px-3 py-2.5 text-slate-700">{entry.bugCount}</td>
                  <td className="px-3 py-2.5 text-slate-700">{entry.total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </section>
  );
}

function QueueSection({
  title,
  requests,
  busyId,
  updateRequest
}: {
  title: string;
  requests: FeatureRequest[];
  busyId: string | null;
  updateRequest: (requestId: string, action: "complete" | "reject") => Promise<void>;
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <h3 className="text-sm font-semibold text-slate-800">{title}</h3>
      <div className="mt-2 grid gap-3">
        {requests.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-5 text-sm text-slate-500">No in-progress items.</div>
        ) : (
          requests.map((request) => (
            <article key={request.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{request.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Requested by {request.requestedByName} ({request.requestedByEmail || "no email"})
                  </p>
                  <p className="mt-1 text-xs font-medium text-amber-700">{request.voteCount ?? 0} boost{(request.voteCount ?? 0) === 1 ? "" : "s"}</p>
                </div>
                <span className="rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">In progress</span>
              </div>
              <p className="mt-3 text-sm text-slate-700">{request.description}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={busyId === request.id}
                  onClick={() => {
                    void updateRequest(request.id, "complete");
                  }}
                  className="rounded-lg bg-emerald-700 px-3 py-2 text-white disabled:opacity-60"
                >
                  Mark complete
                </button>
                <button
                  type="button"
                  disabled={busyId === request.id}
                  onClick={() => {
                    void updateRequest(request.id, "reject");
                  }}
                  className="rounded-lg border border-rose-300 px-3 py-2 text-rose-700 disabled:opacity-60"
                >
                  Mark rejected
                </button>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function sortRequests(requests: FeatureRequest[], sortBy: "score" | "date") {
  return [...requests].sort((left, right) => {
    if (sortBy === "date") {
      return parseISO(right.updatedAt).getTime() - parseISO(left.updatedAt).getTime();
    }

    return (right.voteCount ?? 0) - (left.voteCount ?? 0) || parseISO(right.updatedAt).getTime() - parseISO(left.updatedAt).getTime();
  });
}

function formatStatusLabel(status: FeatureRequest["status"]) {
  if (status === "completed") {
    return "Resolved";
  }

  if (status === "declined") {
    return "Declined";
  }

  if (status === "rejected") {
    return "Rejected";
  }

  if (status === "in_progress") {
    return "In progress";
  }

  return "Pending";
}

function statusBadgeClass(status: FeatureRequest["status"]) {
  if (status === "completed") {
    return "rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700";
  }

  if (status === "declined" || status === "rejected") {
    return "rounded-full border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700";
  }

  if (status === "in_progress") {
    return "rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700";
  }

  return "rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700";
}

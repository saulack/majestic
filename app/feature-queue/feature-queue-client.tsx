"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FeatureRequest } from "@/lib/types";

type ApiResult = {
  message?: string;
  error?: string;
};

export function FeatureQueueClient({ requests }: { requests: FeatureRequest[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState("");

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
      <h2 className="text-xl sm:text-2xl">Feature Queue</h2>
      <p className="mt-2 text-sm text-slate-600">Requests that are currently in progress. Mark each one complete or rejected.</p>

      {status ? <p className="mt-3 text-sm text-slate-700">{status}</p> : null}

      <div className="mt-5 grid gap-3">
        {requests.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
            Queue is empty.
          </div>
        ) : (
          requests.map((request) => (
            <article key={request.id} className="rounded-xl border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900">{request.title}</h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Requested by {request.requestedByName} ({request.requestedByEmail || "no email"})
                  </p>
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

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { FeatureRequest } from "@/lib/types";

type ApiResult = {
  message?: string;
  error?: string;
};

export function FeatureRequestsClient({ requests }: { requests: FeatureRequest[] }) {
  const router = useRouter();
  const [requestType, setRequestType] = useState<"feature" | "bug" | "">("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [statusEmailOptIn, setStatusEmailOptIn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");

  const featureRequests = requests.filter((request) => request.requestType === "feature");
  const bugReports = requests.filter((request) => request.requestType === "bug");

  async function submitRequest() {
    if (!requestType) {
      setStatus("Please choose whether this is a feature request or a bug report.");
      return;
    }

    setBusy(true);
    setStatus("");

    const response = await fetch("/api/feature-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestType,
        title,
        description,
        statusEmailOptIn
      })
    });

    const payload = (await response.json()) as ApiResult;
    setBusy(false);

    if (!response.ok) {
      setStatus(payload.error ?? "Unable to submit request.");
      return;
    }

    setTitle("");
    setDescription("");
    setRequestType("");
    setStatus(payload.message ?? "Request submitted.");
    router.refresh();
  }

  return (
    <section className="grid gap-5 sm:gap-6 lg:grid-cols-[1.2fr_1fr]">
      <div className="card p-5 sm:p-6">
        <h2 className="text-xl sm:text-2xl">Requests & Bug Reports</h2>
        <p className="mt-2 text-sm text-slate-600">
          Submit product ideas or bug reports. Every item starts as pending until reviewed by superadmin.
        </p>

        <form
          className="mt-5 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void submitRequest();
          }}
        >
          <fieldset className="grid gap-2 rounded-lg border border-slate-200 bg-white px-3 py-3">
            <legend className="px-1 text-xs uppercase tracking-[0.12em] text-slate-500">Type</legend>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="requestType"
                checked={requestType === "feature"}
                onChange={() => setRequestType("feature")}
              />
              Feature request
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name="requestType"
                checked={requestType === "bug"}
                onChange={() => setRequestType("bug")}
              />
              Bug report
            </label>
          </fieldset>

          <label className="grid gap-1.5 text-sm font-medium">
            <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Short summary of your idea"
              minLength={3}
              maxLength={120}
              required
            />
          </label>

          <label className="grid gap-1.5 text-sm font-medium">
            <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Description</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              className="min-h-36 rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Describe what you want, why it helps, and how you would use it"
              minLength={10}
              maxLength={4000}
              required
            />
          </label>

          <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
            <div>
              <p className="text-sm font-medium text-slate-800">Email me status updates</p>
              <p className="mt-1 text-xs text-slate-500">Get emailed when this request is completed or rejected.</p>
            </div>
            <input
              type="checkbox"
              checked={statusEmailOptIn}
              onChange={(event) => setStatusEmailOptIn(event.target.checked)}
              className="h-4 w-4"
            />
          </label>

          <div>
            <button type="submit" disabled={busy} className="rounded-lg bg-amber-700 px-4 py-2 text-white disabled:opacity-60">
              {busy ? "Submitting..." : "Submit request"}
            </button>
          </div>

          {status ? <p className="text-sm text-slate-700">{status}</p> : null}
        </form>
      </div>

      <div className="card p-5 sm:p-6">
        <h3 className="text-lg sm:text-xl">My Requests</h3>
        <p className="mt-2 text-sm text-slate-600">Track current status for each request.</p>

        <div className="mt-4 grid gap-4">
          <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <h4 className="text-sm font-semibold text-slate-800">Feature Requests</h4>
            <div className="mt-2 grid gap-3">
              {featureRequests.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">
                  You have not submitted any feature requests yet.
                </div>
              ) : (
                featureRequests.map((request) => (
                  <RequestCard key={request.id} request={request} />
                ))
              )}
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-slate-50 p-3">
            <h4 className="text-sm font-semibold text-slate-800">Bug Reports</h4>
            <div className="mt-2 grid gap-3">
              {bugReports.length === 0 ? (
                <div className="rounded-lg border border-dashed border-slate-200 bg-white px-3 py-4 text-sm text-slate-500">
                  You have not submitted any bug reports yet.
                </div>
              ) : (
                bugReports.map((request) => (
                  <RequestCard key={request.id} request={request} />
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

function RequestCard({ request }: { request: FeatureRequest }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <h4 className="text-sm font-semibold text-slate-900">{request.title}</h4>
        <span className={statusBadgeClass(request.status)}>{formatStatusLabel(request.status)}</span>
      </div>
      <p className="mt-2 text-sm text-slate-600">{request.description}</p>
      <p className="mt-2 text-xs text-slate-500">Requested on {new Date(request.createdAt).toLocaleDateString()}</p>
    </article>
  );
}

function formatStatusLabel(status: FeatureRequest["status"]): string {
  switch (status) {
    case "in_progress":
      return "In progress";
    case "declined":
      return "Declined";
    case "completed":
      return "Completed";
    case "rejected":
      return "Rejected";
    default:
      return "Pending";
  }
}

function statusBadgeClass(status: FeatureRequest["status"]): string {
  if (status === "completed") {
    return "rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700";
  }

  if (status === "rejected" || status === "declined") {
    return "rounded-full border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700";
  }

  if (status === "in_progress") {
    return "rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700";
  }

  return "rounded-full border border-slate-300 bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700";
}

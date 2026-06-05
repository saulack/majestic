"use client";

import { format, parseISO } from "date-fns";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { FeatureRequest } from "@/lib/types";

type ApiResult = {
  message?: string;
  error?: string;
};

type VoteApiResult = ApiResult & {
  voteCount?: number;
  requestId?: string;
};

type RequestSort = "score" | "date";

export function FeatureRequestsClient({ requests, actingUserId }: { requests: FeatureRequest[]; actingUserId: string }) {
  const router = useRouter();
  const [items, setItems] = useState(requests);
  const [requestType, setRequestType] = useState<"feature" | "bug" | "">("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [statusEmailOptIn, setStatusEmailOptIn] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [resolvedVisibleCount, setResolvedVisibleCount] = useState(10);
  const [unresolvedSort, setUnresolvedSort] = useState<RequestSort>("score");
  const [resolvedSort, setResolvedSort] = useState<RequestSort>("date");
  const [voteBusyById, setVoteBusyById] = useState<Record<string, boolean>>({});
  const [voteStatus, setVoteStatus] = useState("");

  useEffect(() => {
    setItems(requests);
  }, [requests]);

  const myRequests = useMemo(() => items.filter((request) => request.requestedByUserId === actingUserId), [actingUserId, items]);
  const featureRequests = myRequests.filter((request) => request.requestType === "feature");
  const bugReports = myRequests.filter((request) => request.requestType === "bug");

  const unresolvedRequests = useMemo(() => {
    return [...items]
      .filter((request) => request.status === "pending" || request.status === "in_progress")
      .sort((left, right) => {
        if (unresolvedSort === "date") {
          return parseISO(right.createdAt).getTime() - parseISO(left.createdAt).getTime();
        }

        const voteDiff = (right.voteCount ?? 0) - (left.voteCount ?? 0);
        if (voteDiff !== 0) {
          return voteDiff;
        }

        return parseISO(right.createdAt).getTime() - parseISO(left.createdAt).getTime();
      });
  }, [items, unresolvedSort]);

  const resolvedRequests = useMemo(() => {
    return [...items]
      .filter((request) => request.status === "completed" || request.status === "declined" || request.status === "rejected")
      .sort((left, right) => {
        if (resolvedSort === "score") {
          const voteDiff = (right.voteCount ?? 0) - (left.voteCount ?? 0);
          if (voteDiff !== 0) {
            return voteDiff;
          }

          return parseISO(right.updatedAt).getTime() - parseISO(left.updatedAt).getTime();
        }

        return parseISO(right.updatedAt).getTime() - parseISO(left.updatedAt).getTime();
      });
  }, [items, resolvedSort]);

  const visibleResolvedRequests = resolvedRequests.slice(0, resolvedVisibleCount);
  const canLoadMoreResolved = resolvedVisibleCount < resolvedRequests.length;

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

  async function boostRequest(requestId: string) {
    setVoteStatus("");
    setVoteBusyById((current) => ({ ...current, [requestId]: true }));

    try {
      const response = await fetch("/api/feature-requests/vote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId })
      });

      const payload = (await response.json()) as VoteApiResult;

      if (!response.ok) {
        setVoteStatus(payload.error ?? "Unable to add support.");
        return;
      }

      setItems((current) =>
        current.map((request) =>
          request.id === requestId
            ? {
                ...request,
                voteCount: payload.voteCount ?? (request.voteCount ?? 0) + 1,
                votedByCurrentUser: true
              }
            : request
        )
      );
      setVoteStatus(payload.message ?? "Support added.");
      router.refresh();
    } catch {
      setVoteStatus("Request failed.");
    } finally {
      setVoteBusyById((current) => ({ ...current, [requestId]: false }));
    }
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

      <div className="card p-5 sm:p-6 lg:col-span-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg sm:text-xl">Unresolved Requests</h3>
            <p className="mt-1 text-sm text-slate-500">All open feature requests and bug reports across every user, sorted by support.</p>
          </div>
          <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1">
            <button
              type="button"
              onClick={() => setUnresolvedSort("score")}
              className={[
                "rounded-md px-3 py-1.5 text-sm",
                unresolvedSort === "score" ? "bg-amber-700 text-white" : "text-slate-700"
              ].join(" ")}
            >
              Score
            </button>
            <button
              type="button"
              onClick={() => setUnresolvedSort("date")}
              className={[
                "rounded-md px-3 py-1.5 text-sm",
                unresolvedSort === "date" ? "bg-amber-700 text-white" : "text-slate-700"
              ].join(" ")}
            >
              Date
            </button>
          </div>
        </div>

        {voteStatus ? <p className="mt-3 text-sm text-slate-600">{voteStatus}</p> : null}

        <div className="mt-5 grid gap-3">
          {unresolvedRequests.length > 0 ? (
            unresolvedRequests.map((request) => (
              <article key={request.id} className="rounded-xl border border-slate-200 bg-white p-4">
                {(() => {
                  const isOwnRequest = request.requestedByUserId === actingUserId;
                  const boostDisabled = Boolean(voteBusyById[request.id]) || Boolean(request.votedByCurrentUser) || isOwnRequest;

                  return (
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-900">{request.title}</h4>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
                        {request.requestType === "bug" ? "Bug" : "Feature"}
                      </span>
                      <span className={statusBadgeClass(request.status)}>{formatStatusLabel(request.status)}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{request.description}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      Requested by {request.requestedByName} on {format(parseISO(request.createdAt), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                      {request.voteCount ?? 0} boost{(request.voteCount ?? 0) === 1 ? "" : "s"}
                    </div>
                    <button
                      type="button"
                      disabled={boostDisabled}
                      onClick={() => void boostRequest(request.id)}
                      className={[
                        "rounded-lg px-3 py-1.5 text-xs font-medium transition",
                        isOwnRequest
                          ? "border border-slate-300 bg-slate-100 text-slate-500"
                          : request.votedByCurrentUser
                          ? "border border-amber-300 bg-amber-100 text-amber-800"
                          : "border border-amber-700 bg-amber-700 text-white",
                        voteBusyById[request.id] ? "opacity-60" : ""
                      ].join(" ")}
                    >
                      {isOwnRequest ? "Your request" : request.votedByCurrentUser ? "Boosted" : voteBusyById[request.id] ? "Boosting..." : "Boost"}
                    </button>
                  </div>
                </div>
                  );
                })()}
              </article>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
              No unresolved requests are currently open.
            </div>
          )}
        </div>
      </div>

      <div className="card p-5 sm:p-6 lg:col-span-2">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="text-lg sm:text-xl">Resolved Requests</h3>
            <p className="mt-1 text-sm text-slate-500">Completed, declined, and rejected requests. Showing 10 at a time.</p>
          </div>
          <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1">
            <button
              type="button"
              onClick={() => setResolvedSort("date")}
              className={[
                "rounded-md px-3 py-1.5 text-sm",
                resolvedSort === "date" ? "bg-amber-700 text-white" : "text-slate-700"
              ].join(" ")}
            >
              Date
            </button>
            <button
              type="button"
              onClick={() => setResolvedSort("score")}
              className={[
                "rounded-md px-3 py-1.5 text-sm",
                resolvedSort === "score" ? "bg-amber-700 text-white" : "text-slate-700"
              ].join(" ")}
            >
              Score
            </button>
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          {visibleResolvedRequests.length > 0 ? (
            visibleResolvedRequests.map((request) => (
              <article key={request.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-900">{request.title}</h4>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-medium text-slate-700">
                        {request.requestType === "bug" ? "Bug" : "Feature"}
                      </span>
                      <span className={statusBadgeClass(request.status)}>{formatStatusLabel(request.status)}</span>
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{request.description}</p>
                    <p className="mt-2 text-xs text-slate-500">
                      Requested by {request.requestedByName} on {format(parseISO(request.createdAt), "MMM d, yyyy")}
                    </p>
                  </div>
                  <div className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700">
                    {request.voteCount ?? 0} boost{(request.voteCount ?? 0) === 1 ? "" : "s"}
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
              No resolved requests yet.
            </div>
          )}
        </div>

        {canLoadMoreResolved ? (
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setResolvedVisibleCount((current) => current + 10)}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              Load more
            </button>
          </div>
        ) : null}
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

"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ToggleSwitch } from "@/components/toggle-switch";
import { clearRolePreviewInBrowser, setRolePreviewInBrowser } from "@/lib/role-preview";
import type { FeatureRequest, MaintenanceThresholdApproval, MaintenanceType, UserProfile } from "@/lib/types";

type RequestSort = "score" | "date";

type ApiResult = {
  message?: string;
  error?: string;
  mode?: "live";
  enabled?: boolean;
  inviteUrl?: string;
  maintenanceType?: MaintenanceType;
};

export function AdminConsole({
  initialApprovalsEnabled,
  initialHomepageReservationCount,
  initialMaintenanceTypes,
  initialThresholdApprovals,
  initialPendingFeatureRequests,
  initialPendingBugReports,
  initialUsers,
  currentUserId
}: {
  initialApprovalsEnabled: boolean;
  initialHomepageReservationCount: number;
  initialMaintenanceTypes: MaintenanceType[];
  initialThresholdApprovals: MaintenanceThresholdApproval[];
  initialPendingFeatureRequests: FeatureRequest[];
  initialPendingBugReports: FeatureRequest[];
  initialUsers: UserProfile[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [approvalsEnabled, setApprovalsEnabled] = useState(initialApprovalsEnabled);
  const [homepageReservationCount, setHomepageReservationCount] = useState(initialHomepageReservationCount);
  const [maintenanceTypes, setMaintenanceTypes] = useState(initialMaintenanceTypes);
  const [thresholdApprovals, setThresholdApprovals] = useState(initialThresholdApprovals);
  const [thresholdApprovalsOpen, setThresholdApprovalsOpen] = useState(false);
  const [pendingFeatureRequests, setPendingFeatureRequests] = useState(initialPendingFeatureRequests);
  const [pendingFeatureRequestsOpen, setPendingFeatureRequestsOpen] = useState(false);
  const [pendingFeatureRequestsSort, setPendingFeatureRequestsSort] = useState<RequestSort>("score");
  const [pendingBugReports, setPendingBugReports] = useState(initialPendingBugReports);
  const [pendingBugReportsOpen, setPendingBugReportsOpen] = useState(false);
  const [pendingBugReportsSort, setPendingBugReportsSort] = useState<RequestSort>("score");
  const [users, setUsers] = useState(initialUsers);
  const [manualInviteStatus, setManualInviteStatus] = useState("");
  const [manualInviteLink, setManualInviteLink] = useState("");
  const [homepageCountStatus, setHomepageCountStatus] = useState("");

  async function postJson(path: string, body: Record<string, string | boolean | number>): Promise<ApiResult> {
    setLoading(true);
    setResult(null);

    try {
      const response = await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });

      const data = (await response.json()) as ApiResult;
      setResult(data);
      return data;
    } catch {
      const failure: ApiResult = { error: "Request failed." };
      setResult(failure);
      return failure;
    } finally {
      setLoading(false);
    }
  }

  const sortedPendingFeatureRequests = useMemo(() => sortFeatureRequests(pendingFeatureRequests, pendingFeatureRequestsSort), [pendingFeatureRequests, pendingFeatureRequestsSort]);
  const sortedPendingBugReports = useMemo(() => sortFeatureRequests(pendingBugReports, pendingBugReportsSort), [pendingBugReports, pendingBugReportsSort]);

  return (
    <section className="grid gap-5 sm:gap-6 lg:grid-cols-2">
      <div className="card p-5 sm:p-6 lg:col-span-2">
        <h2 className="text-xl sm:text-2xl">Role Preview</h2>
        <p className="mt-2 text-sm text-slate-600">
          Temporarily preview the experience as a lower role. A floating button will appear so you can restore superadmin at any time.
        </p>

        <div className="mt-4 flex flex-wrap gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <button
            type="button"
            className="rounded-lg bg-amber-700 px-4 py-2 text-white"
            onClick={() => {
              setRolePreviewInBrowser("admin");
              router.push("/");
              router.refresh();
            }}
          >
            Become admin
          </button>
          <button
            type="button"
            className="rounded-lg bg-amber-700 px-4 py-2 text-white"
            onClick={() => {
              setRolePreviewInBrowser("user");
              router.push("/");
              router.refresh();
            }}
          >
            Become user
          </button>
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700"
            onClick={() => {
              clearRolePreviewInBrowser();
              router.refresh();
            }}
          >
            Stay superadmin
          </button>
        </div>
      </div>

      <div className="card p-5 sm:p-6 lg:col-span-2">
        <h2 className="text-xl sm:text-2xl">Reservation Approvals</h2>
        <p className="mt-2 text-sm text-slate-600">
          Keep the approval workflow ready, but turn it on only when you want to start using it.
        </p>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div>
            <p className="text-sm font-medium text-slate-800">
              {approvalsEnabled ? "Approvals are active" : "Approvals are paused"}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              When paused, reservations book directly. When active, moderation buttons reappear.
            </p>
          </div>
          <ToggleSwitch
            checked={approvalsEnabled}
            disabled={loading}
            onCheckedChange={async (checked) => {
              setApprovalsEnabled(checked);
              const response = await postJson("/api/admin/reservation-approvals", { enabled: checked });
              if (response?.error) {
                setApprovalsEnabled(!checked);
              }
            }}
            srLabel="Toggle reservation approvals"
            offLabel="Paused"
            onLabel="Active"
          />
        </div>
      </div>

      <div className="card p-5 sm:p-6 lg:col-span-2">
        <button
          type="button"
          onClick={() => setPendingFeatureRequestsOpen((current) => !current)}
          className={[
            "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition",
            pendingFeatureRequests.length > 0
              ? "border-rose-300 bg-rose-50 text-rose-800"
              : "border-slate-200 bg-slate-50 text-slate-800"
          ].join(" ")}
        >
          <div>
            <p className="text-base font-semibold">Feature Requests</p>
            <p className="mt-1 text-sm">
              {pendingFeatureRequests.length > 0
                ? `${pendingFeatureRequests.length} pending request${pendingFeatureRequests.length === 1 ? "" : "s"}`
                : "No pending feature requests"}
            </p>
          </div>
          <span className="text-sm font-medium">{pendingFeatureRequestsOpen ? "Hide" : "Show"}</span>
        </button>

        {pendingFeatureRequestsOpen ? (
          <div className="mt-4 grid gap-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
              <span className="font-medium text-slate-700">Sort by</span>
              <div className="inline-flex rounded-lg border border-slate-300 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => setPendingFeatureRequestsSort("score")}
                  className={[
                    "rounded-md px-3 py-1.5 text-sm",
                    pendingFeatureRequestsSort === "score" ? "bg-amber-700 text-white" : "text-slate-700"
                  ].join(" ")}
                >
                  Score
                </button>
                <button
                  type="button"
                  onClick={() => setPendingFeatureRequestsSort("date")}
                  className={[
                    "rounded-md px-3 py-1.5 text-sm",
                    pendingFeatureRequestsSort === "date" ? "bg-amber-700 text-white" : "text-slate-700"
                  ].join(" ")}
                >
                  Date
                </button>
              </div>
            </div>
            {pendingFeatureRequests.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                There are currently no pending feature requests.
              </div>
            ) : (
              sortedPendingFeatureRequests.map((request) => (
                <div key={request.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{request.title}</p>
                      <p className="mt-1 text-sm text-slate-600">Requested by {request.requestedByName}</p>
                      <p className="mt-1 text-xs font-medium text-amber-700">{request.voteCount ?? 0} boost{(request.voteCount ?? 0) === 1 ? "" : "s"}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => {
                          void (async () => {
                            const response = await postJson("/api/admin/feature-requests", {
                              requestId: request.id,
                              action: "queue"
                            });

                            if (!response.error) {
                              setPendingFeatureRequests((current) => current.filter((entry) => entry.id !== request.id));
                            }
                          })();
                        }}
                        className="rounded-lg bg-amber-700 px-3 py-2 text-white disabled:opacity-60"
                      >
                        Add to queue
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => {
                          void (async () => {
                            const response = await postJson("/api/admin/feature-requests", {
                              requestId: request.id,
                              action: "decline"
                            });

                            if (!response.error) {
                              setPendingFeatureRequests((current) => current.filter((entry) => entry.id !== request.id));
                            }
                          })();
                        }}
                        className="rounded-lg border border-rose-300 px-3 py-2 text-rose-700 disabled:opacity-60"
                      >
                        Decline request
                      </button>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-700">{request.description}</p>
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>

      <div className="card p-5 sm:p-6 lg:col-span-2">
        <button
          type="button"
          onClick={() => setPendingBugReportsOpen((current) => !current)}
          className={[
            "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition",
            pendingBugReports.length > 0
              ? "border-rose-300 bg-rose-50 text-rose-800"
              : "border-slate-200 bg-slate-50 text-slate-800"
          ].join(" ")}
        >
          <div>
            <p className="text-base font-semibold">Bug Reports</p>
            <p className="mt-1 text-sm">
              {pendingBugReports.length > 0
                ? `${pendingBugReports.length} pending report${pendingBugReports.length === 1 ? "" : "s"}`
                : "No pending bug reports"}
            </p>
          </div>
          <span className="text-sm font-medium">{pendingBugReportsOpen ? "Hide" : "Show"}</span>
        </button>

        {pendingBugReportsOpen ? (
          <div className="mt-4 grid gap-3">
            <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
              <span className="font-medium text-slate-700">Sort by</span>
              <div className="inline-flex rounded-lg border border-slate-300 bg-slate-50 p-1">
                <button
                  type="button"
                  onClick={() => setPendingBugReportsSort("score")}
                  className={[
                    "rounded-md px-3 py-1.5 text-sm",
                    pendingBugReportsSort === "score" ? "bg-amber-700 text-white" : "text-slate-700"
                  ].join(" ")}
                >
                  Score
                </button>
                <button
                  type="button"
                  onClick={() => setPendingBugReportsSort("date")}
                  className={[
                    "rounded-md px-3 py-1.5 text-sm",
                    pendingBugReportsSort === "date" ? "bg-amber-700 text-white" : "text-slate-700"
                  ].join(" ")}
                >
                  Date
                </button>
              </div>
            </div>
            {pendingBugReports.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                There are currently no pending bug reports.
              </div>
            ) : (
              sortedPendingBugReports.map((request) => (
                <div key={request.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{request.title}</p>
                      <p className="mt-1 text-sm text-slate-600">Reported by {request.requestedByName}</p>
                      <p className="mt-1 text-xs font-medium text-amber-700">{request.voteCount ?? 0} boost{(request.voteCount ?? 0) === 1 ? "" : "s"}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => {
                          void (async () => {
                            const response = await postJson("/api/admin/feature-requests", {
                              requestId: request.id,
                              action: "queue"
                            });

                            if (!response.error) {
                              setPendingBugReports((current) => current.filter((entry) => entry.id !== request.id));
                            }
                          })();
                        }}
                        className="rounded-lg bg-amber-700 px-3 py-2 text-white disabled:opacity-60"
                      >
                        Add to queue
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => {
                          void (async () => {
                            const response = await postJson("/api/admin/feature-requests", {
                              requestId: request.id,
                              action: "decline"
                            });

                            if (!response.error) {
                              setPendingBugReports((current) => current.filter((entry) => entry.id !== request.id));
                            }
                          })();
                        }}
                        className="rounded-lg border border-rose-300 px-3 py-2 text-rose-700 disabled:opacity-60"
                      >
                        Decline report
                      </button>
                    </div>
                  </div>
                  <p className="mt-3 text-sm text-slate-700">{request.description}</p>
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>

      <div className="card p-5 sm:p-6 lg:col-span-2">
        <button
          type="button"
          onClick={() => setThresholdApprovalsOpen((current) => !current)}
          className={[
            "flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition",
            thresholdApprovals.length > 0
              ? "border-rose-300 bg-rose-50 text-rose-800"
              : "border-slate-200 bg-slate-50 text-slate-800"
          ].join(" ")}
        >
          <div>
            <p className="text-base font-semibold">Threshold Approvals</p>
            <p className="mt-1 text-sm">
              {thresholdApprovals.length > 0
                ? `${thresholdApprovals.length} pending request${thresholdApprovals.length === 1 ? "" : "s"}`
                : "No pending threshold requests"}
            </p>
          </div>
          <span className="text-sm font-medium">{thresholdApprovalsOpen ? "Hide" : "Show"}</span>
        </button>

        {thresholdApprovalsOpen ? (
          <div className="mt-4 grid gap-3">
            {thresholdApprovals.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                There are currently no pending threshold approvals.
              </div>
            ) : (
              thresholdApprovals.map((approval) => (
                <div key={approval.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{approval.maintenanceTypeName}</p>
                      <p className="mt-1 text-sm text-slate-600">
                        Requested by {approval.requestedByName}: set threshold to {approval.proposedThresholdDays} days.
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => {
                          void (async () => {
                            const response = await postJson("/api/admin/maintenance-threshold-approvals", {
                              approvalId: approval.id,
                              action: "approve"
                            });

                            if (!response.error) {
                              setThresholdApprovals((current) => current.filter((entry) => entry.id !== approval.id));
                              setMaintenanceTypes((current) =>
                                current.map((entry) =>
                                  entry.id === approval.maintenanceTypeId
                                    ? { ...entry, thresholdDays: approval.proposedThresholdDays }
                                    : entry
                                )
                              );
                            }
                          })();
                        }}
                        className="rounded-lg bg-emerald-700 px-3 py-2 text-white disabled:opacity-60"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={() => {
                          void (async () => {
                            const response = await postJson("/api/admin/maintenance-threshold-approvals", {
                              approvalId: approval.id,
                              action: "reject"
                            });

                            if (!response.error) {
                              setThresholdApprovals((current) => current.filter((entry) => entry.id !== approval.id));
                            }
                          })();
                        }}
                        className="rounded-lg border border-rose-300 px-3 py-2 text-rose-700 disabled:opacity-60"
                      >
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        ) : null}
      </div>

      <div className="card p-5 sm:p-6 lg:col-span-2">
        <h2 className="text-xl sm:text-2xl">Homepage Reservations</h2>
        <p className="mt-2 text-sm text-slate-600">
          Choose how many upcoming reservations appear on the homepage.
        </p>

        <form
          className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void (async () => {
              const response = await postJson("/api/admin/home-reservations-count", { count: homepageReservationCount });
              setHomepageCountStatus(response.error ?? "Homepage reservation count saved successfully.");
            })();
          }}
        >
          <label className="grid gap-1.5 text-sm font-medium">
            <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Reservations shown</span>
            <input
              type="number"
              min={1}
              max={10}
              value={homepageReservationCount}
              onChange={(event) => {
                setHomepageReservationCount(Number(event.target.value));
                setHomepageCountStatus("");
              }}
              className="w-28 rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <button disabled={loading} type="submit" className="rounded-lg bg-amber-700 px-4 py-2 text-white">
            Save count
          </button>
        </form>

        {homepageCountStatus ? <p className="mt-3 text-sm text-slate-700">{homepageCountStatus}</p> : null}
      </div>

      <div className="card p-5 sm:p-6 lg:col-span-2">
        <h2 className="text-xl sm:text-2xl">Maintenance Types</h2>
        <p className="mt-2 text-sm text-slate-600">
          Maintenance categories are created from contacts marked as maintenance contacts in the Info section.
        </p>

        <div className="mt-4 grid gap-3">
          {maintenanceTypes.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
              No maintenance categories yet. Add a contact as a maintenance contact to create one automatically.
            </div>
          ) : maintenanceTypes.map((maintenanceType) => (
            <form
              key={maintenanceType.id}
              className="flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-4"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);

                void (async () => {
                  const thresholdDays = Number(form.get(`threshold-${maintenanceType.id}`) ?? maintenanceType.thresholdDays);
                  const response = await postJson("/api/admin/maintenance-threshold", {
                    maintenanceTypeId: maintenanceType.id,
                    thresholdDays
                  });

                  if (!response.error) {
                    setMaintenanceTypes((current) =>
                      current.map((entry) => (entry.id === maintenanceType.id ? { ...entry, thresholdDays } : entry))
                    );
                  }
                })();
              }}
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{maintenanceType.name}</p>
                <p className="mt-1 text-xs text-slate-500">Users are reminded when a reservation extends beyond this maintenance interval.</p>
              </div>
              <label className="grid gap-1.5 text-sm font-medium">
                <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Threshold days</span>
                <input
                  name={`threshold-${maintenanceType.id}`}
                  type="number"
                  min={1}
                  defaultValue={maintenanceType.thresholdDays}
                  className="w-32 rounded-lg border border-slate-300 px-3 py-2"
                  required
                />
              </label>
              <button disabled={loading} type="submit" className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700">
                Save threshold
              </button>
              <button
                disabled={loading}
                type="button"
                onClick={() => {
                  const confirmed = window.confirm(`Remove ${maintenanceType.name} from maintenance categories?`);
                  if (!confirmed) {
                    return;
                  }

                  void (async () => {
                    const response = await fetch("/api/admin/maintenance-types", {
                      method: "DELETE",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ maintenanceTypeId: maintenanceType.id })
                    });

                    const payload = (await response.json()) as ApiResult;
                    setResult(payload);

                    if (!payload.error) {
                      setMaintenanceTypes((current) => current.filter((entry) => entry.id !== maintenanceType.id));
                      router.refresh();
                    }
                  })();
                }}
                className="rounded-lg border border-rose-300 px-4 py-2 text-rose-700"
              >
                Remove category
              </button>
            </form>
          ))}
        </div>
      </div>

      <div className="card p-5 sm:p-6">
        <h2 className="text-xl sm:text-2xl">Invite Center</h2>
        <p className="mt-2 text-sm text-slate-600">Create a shareable invite link. The recipient will provide name, email, and password during registration.</p>

        <form
          className="mt-4 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();

            void (async () => {
              const response = await postJson("/api/admin/create-invite-link", {});

              if (response?.error) {
                setManualInviteStatus(response.error);
                setManualInviteLink("");
                return;
              }

              setManualInviteStatus(response?.message ?? "Invite link created.");
              setManualInviteLink(response?.inviteUrl ?? "");
            })();
          }}
        >
          <button disabled={loading} type="submit" className="rounded-lg bg-amber-700 px-4 py-2 text-white">
            Create invite link
          </button>
        </form>

        {manualInviteStatus ? <p className="mt-3 text-sm text-slate-700">{manualInviteStatus}</p> : null}
        {manualInviteLink ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3">
            <p className="text-xs uppercase tracking-[0.12em] text-amber-700">Share this link</p>
            <p className="mt-1 text-sm break-all">{manualInviteLink}</p>
          </div>
        ) : null}
      </div>

      <div className="card p-5 sm:p-6">
        <h2 className="text-xl sm:text-2xl">Delete Account</h2>
        <p className="mt-2 text-sm text-slate-600">Deletes auth account and linked profile data.</p>

        <form
          className="mt-4 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const userId = String(form.get("userId") ?? "").trim();
            const confirmed = window.confirm(`Delete user ${userId}? This permanently removes their account and related profile data.`);
            if (!confirmed) {
              return;
            }

            void postJson("/api/admin/delete-user", {
              userId
            });
          }}
        >
          <label className="grid gap-1.5 text-sm font-medium">
            <span className="text-xs uppercase tracking-[0.12em] text-slate-500">User ID</span>
            <input name="userId" placeholder="User ID" className="rounded-lg border border-slate-300 px-3 py-2" required />
          </label>
          <button disabled={loading} type="submit" className="rounded-lg bg-amber-700 px-4 py-2 text-white">
            Delete user
          </button>
        </form>
      </div>

      <div className="card p-5 sm:p-6">
        <h2 className="text-xl sm:text-2xl">Force Password Reset</h2>
        <p className="mt-2 text-sm text-slate-600">
          Make the next login force a password reset immediately, without email and without checking the previous password.
        </p>

        <form
          className="mt-4 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            const userId = String(form.get("userId") ?? "");

            void (async () => {
              const response = await postJson("/api/admin/force-password-reset", { userId });
              if (!response?.error) {
                setUsers((current) => current.map((user) => (user.id === userId ? { ...user, forcePasswordReset: true } : user)));
              }
            })();
          }}
        >
          <label className="grid gap-1.5 text-sm font-medium">
            <span className="text-xs uppercase tracking-[0.12em] text-slate-500">User ID</span>
            <input name="userId" placeholder="User ID" className="rounded-lg border border-slate-300 px-3 py-2" required />
          </label>
          <button disabled={loading} type="submit" className="rounded-lg bg-amber-700 px-4 py-2 text-white">
            Force reset on next login
          </button>
        </form>
      </div>

      <div className="card p-5 sm:p-6">
        <h2 className="text-xl sm:text-2xl">Current Users</h2>
        <ul className="mt-4 grid gap-2 text-sm">
          {users.map((user) => (
            <li key={user.id} className="rounded-lg border border-slate-200 px-3 py-2">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <span className="font-semibold">{user.fullName}</span> - {user.email} - {user.role}
                  <p className="mt-1 text-xs text-slate-500">User ID: {user.id}</p>
                  {user.forcePasswordReset ? <p className="mt-1 text-xs text-rose-700">Password reset required on next login.</p> : null}
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  {user.role !== "superadmin" && user.id !== currentUserId ? (
                    <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                      <span className="text-xs font-medium text-slate-600">Admin access</span>
                      <ToggleSwitch
                        checked={user.role === "admin"}
                        disabled={loading}
                        onCheckedChange={(checked) => {
                          void (async () => {
                            const response = await postJson("/api/admin/user-role", {
                              userId: user.id,
                              role: checked ? "admin" : "user"
                            });

                            if (!response?.error) {
                              setUsers((current) => current.map((entry) => (entry.id === user.id ? { ...entry, role: checked ? "admin" : "user" } : entry)));
                            }
                          })();
                        }}
                        srLabel={`Toggle admin access for ${user.fullName}`}
                        offLabel="User"
                        onLabel="Admin"
                      />
                    </div>
                  ) : user.role === "superadmin" ? (
                    <span className="rounded-full border border-[#bde3df] bg-[#f1fbf9] px-2.5 py-1 text-xs font-medium text-[#2f7b84]">Superadmin</span>
                  ) : null}

                  {user.id !== currentUserId ? (
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() => {
                        void (async () => {
                          const response = await postJson("/api/admin/force-password-reset", { userId: user.id });
                          if (!response?.error) {
                            setUsers((current) => current.map((entry) => (entry.id === user.id ? { ...entry, forcePasswordReset: true } : entry)));
                          }
                        })();
                      }}
                      className="rounded-lg bg-amber-700 px-3 py-2 text-xs text-white disabled:opacity-60"
                    >
                      Force password reset
                    </button>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {result?.message || result?.error ? (
        <div className="lg:col-span-2 rounded-lg border border-slate-300 bg-white p-4 text-sm">
          <p className={result.error ? "text-rose-700" : "text-emerald-700"}>{result.error ?? result.message}</p>
          {result.mode ? <p className="mt-1 text-xs text-slate-500">Mode: {result.mode}</p> : null}
        </div>
      ) : null}
    </section>
  );
}

function sortFeatureRequests(requests: FeatureRequest[], sortBy: RequestSort) {
  return [...requests].sort((left, right) => {
    if (sortBy === "date") {
      return right.createdAt.localeCompare(left.createdAt);
    }

    return (right.voteCount ?? 0) - (left.voteCount ?? 0) || right.createdAt.localeCompare(left.createdAt);
  });
}

"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ToggleSwitch } from "@/components/toggle-switch";
import { currentUser } from "@/lib/mock-data";
import { clearRolePreviewInBrowser, setRolePreviewInBrowser } from "@/lib/role-preview";
import type { UserProfile } from "@/lib/types";

type ApiResult = {
  message?: string;
  error?: string;
  mode?: "mock" | "live";
  enabled?: boolean;
  inviteUrl?: string;
};

export function AdminConsole({
  initialApprovalsEnabled,
  initialHomepageReservationCount,
  initialUsers
}: {
  initialApprovalsEnabled: boolean;
  initialHomepageReservationCount: number;
  initialUsers: UserProfile[];
}) {
  const router = useRouter();
  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [approvalsEnabled, setApprovalsEnabled] = useState(initialApprovalsEnabled);
  const [homepageReservationCount, setHomepageReservationCount] = useState(initialHomepageReservationCount);
  const [users, setUsers] = useState(initialUsers);
  const [manualInviteStatus, setManualInviteStatus] = useState("");
  const [manualInviteLink, setManualInviteLink] = useState("");

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
        <h2 className="text-xl sm:text-2xl">Homepage Reservations</h2>
        <p className="mt-2 text-sm text-slate-600">
          Choose how many upcoming reservations appear on the homepage.
        </p>

        <form
          className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4"
          onSubmit={(event) => {
            event.preventDefault();
            void postJson("/api/admin/home-reservations-count", { count: homepageReservationCount });
          }}
        >
          <label className="grid gap-1.5 text-sm font-medium">
            <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Reservations shown</span>
            <input
              type="number"
              min={1}
              max={10}
              value={homepageReservationCount}
              onChange={(event) => setHomepageReservationCount(Number(event.target.value))}
              className="w-28 rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <button disabled={loading} type="submit" className="rounded-lg bg-amber-700 px-4 py-2 text-white">
            Save count
          </button>
        </form>
      </div>

      <div className="card p-5 sm:p-6">
        <h2 className="text-xl sm:text-2xl">Create Account</h2>
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
            void postJson("/api/admin/delete-user", {
              userId: String(form.get("userId") ?? "")
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
                  {user.role !== "superadmin" && user.id !== currentUser.id ? (
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

                  {user.id !== currentUser.id ? (
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

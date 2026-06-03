"use client";

import { useMemo, useState } from "react";
import { currentUser, mockUsers } from "@/lib/mock-data";
import { isSuperadmin } from "@/lib/rbac";

type ApiResult = {
  message?: string;
  error?: string;
  mode?: "mock" | "live";
};

export function AdminConsole() {
  const [result, setResult] = useState<ApiResult | null>(null);
  const [loading, setLoading] = useState(false);
  const canManage = useMemo(() => isSuperadmin(currentUser), []);

  async function postJson(path: string, body: Record<string, string>) {
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
    } catch {
      setResult({ error: "Request failed." });
    } finally {
      setLoading(false);
    }
  }

  if (!canManage) {
    return (
      <section className="card p-5 sm:p-6">
        <h2 className="text-xl sm:text-2xl">Admin Console</h2>
        <p className="mt-3 text-sm text-rose-700">Only superadmin can create/delete accounts.</p>
      </section>
    );
  }

  return (
    <section className="grid gap-5 sm:gap-6 lg:grid-cols-2">
      <div className="card p-5 sm:p-6">
        <h2 className="text-xl sm:text-2xl">Create Account</h2>
        <p className="mt-2 text-sm text-slate-600">One account per email is enforced by Supabase Auth.</p>

        <form
          className="mt-4 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            void postJson("/api/admin/create-user", {
              fullName: String(form.get("fullName") ?? ""),
              email: String(form.get("email") ?? ""),
              role: String(form.get("role") ?? "user")
            });
          }}
        >
          <label className="grid gap-1.5 text-sm font-medium">
            <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Full name</span>
            <input name="fullName" placeholder="Full name" className="rounded-lg border border-slate-300 px-3 py-2" required />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Email</span>
            <input name="email" type="email" placeholder="Email" className="rounded-lg border border-slate-300 px-3 py-2" required />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Role</span>
            <select name="role" className="rounded-lg border border-slate-300 px-3 py-2">
              <option value="user">User</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <button disabled={loading} type="submit" className="rounded-lg bg-amber-700 px-4 py-2 text-white">
            Send invite
          </button>
        </form>
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
          <button disabled={loading} type="submit" className="rounded-lg bg-[#6a3d33] px-4 py-2 text-white">
            Delete user
          </button>
        </form>
      </div>

      <div className="card p-5 sm:p-6">
        <h2 className="text-xl sm:text-2xl">Current Users (Mock Preview)</h2>
        <ul className="mt-4 grid gap-2 text-sm">
          {mockUsers.map((user) => (
            <li key={user.id} className="rounded-lg border border-slate-200 px-3 py-2">
              <span className="font-semibold">{user.fullName}</span> - {user.email} - {user.role}
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

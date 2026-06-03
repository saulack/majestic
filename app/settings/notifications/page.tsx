"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { currentUser } from "@/lib/mock-data";
import { isSuperadmin } from "@/lib/rbac";

export default function NotificationsPage() {
  const [inviteLink, setInviteLink] = useState("");
  const [adminInviteStatus, setAdminInviteStatus] = useState("");

  async function generateAdminInvite(formData: FormData) {
    const email = String(formData.get("adminEmail") ?? "").trim().toLowerCase();
    if (!email) {
      setAdminInviteStatus("Admin email is required.");
      return;
    }

    setAdminInviteStatus("Generating link...");
    setInviteLink("");

    const response = await fetch("/api/admin/invite-admin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    const data = (await response.json()) as { inviteUrl?: string; error?: string };
    if (!response.ok || data.error) {
      setAdminInviteStatus(data.error ?? "Failed to generate admin invite URL.");
      return;
    }

    setInviteLink(data.inviteUrl ?? "");
    setAdminInviteStatus("Invite URL generated.");
  }

  if (!isSuperadmin(currentUser)) {
    return (
      <AppShell>
        <section className="card p-6">
          <h2 className="text-2xl">Admin Invite Center</h2>
          <p className="mt-2 text-sm text-rose-700">Only superadmin can generate admin invite URLs.</p>
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="card p-6">
        <h2 className="text-2xl">Admin Invite Center</h2>
        <p className="mt-2 text-sm text-slate-600">
          Superadmin-only area to generate secure admin signup URLs.
        </p>

        <form
          className="mt-4 grid max-w-xl gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            void generateAdminInvite(formData);
          }}
        >
          <input
            name="adminEmail"
            type="email"
            placeholder="admin.user@example.com"
            className="rounded-lg border border-slate-300 px-3 py-2"
            required
          />
          <button type="submit" className="w-fit rounded-lg bg-amber-700 px-4 py-2 text-white">
            Generate URL
          </button>
        </form>

        {adminInviteStatus ? <p className="mt-3 text-sm text-slate-700">{adminInviteStatus}</p> : null}
        {inviteLink ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm break-all">{inviteLink}</p>
        ) : null}
      </section>
    </AppShell>
  );
}

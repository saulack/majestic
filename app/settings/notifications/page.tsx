"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { currentUser, mockPreferences } from "@/lib/mock-data";
import { isSuperadmin } from "@/lib/rbac";

export default function NotificationsPage() {
  const preference = mockPreferences.find((item) => item.userId === currentUser.id);
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

  return (
    <AppShell>
      <section className="card p-6">
        <h2 className="text-2xl">Notification Preferences</h2>
        <p className="mt-2 text-sm text-slate-600">
          Choose where to receive reservation updates: email, SMS, or WhatsApp.
        </p>

        <form className="mt-6 grid max-w-xl gap-4">
          <ChannelRow label="Email" defaultChecked={preference?.channels.includes("email")} />
          <ChannelRow label="SMS" defaultChecked={preference?.channels.includes("sms")} />
          <ChannelRow label="WhatsApp" defaultChecked={preference?.channels.includes("whatsapp")} />

          <button type="button" className="mt-2 w-fit rounded-lg bg-slate-900 px-4 py-2 text-white">
            Save preferences
          </button>
        </form>
      </section>

      {isSuperadmin(currentUser) ? (
        <section className="card mt-6 p-6">
          <h2 className="text-2xl">Generate Admin Invite</h2>
          <p className="mt-2 text-sm text-slate-600">
            Create a secure signup URL for an admin account. This replaces pre-populating admin users.
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
      ) : null}
    </AppShell>
  );
}

function ChannelRow({ label, defaultChecked }: { label: string; defaultChecked?: boolean }) {
  return (
    <label className="flex items-center gap-3 rounded-lg border border-slate-200 px-4 py-3">
      <input type="checkbox" defaultChecked={defaultChecked} className="h-4 w-4" />
      <span>{label}</span>
    </label>
  );
}

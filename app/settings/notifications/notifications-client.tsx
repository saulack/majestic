"use client";

import { useState } from "react";
import { AppShell } from "@/components/app-shell";

export function NotificationsClientPage() {
  const [inviteLink, setInviteLink] = useState("");
  const [inviteStatus, setInviteStatus] = useState("");

  async function generateInvite(formData: FormData) {
    const email = String(formData.get("adminEmail") ?? "").trim().toLowerCase();
    if (!email) {
      setInviteStatus("Invite email is required.");
      return;
    }

    setInviteStatus("Sending invite...");
    setInviteLink("");

    const response = await fetch("/api/admin/create-user", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    const data = (await response.json()) as { inviteUrl?: string; message?: string; error?: string };
    if (!response.ok || data.error) {
      setInviteStatus(data.error ?? "Failed to send invite.");
      return;
    }

    setInviteLink(data.inviteUrl ?? "");
    setInviteStatus(data.message ?? "Invite sent.");
  }

  return (
    <AppShell>
      <section className="card p-6">
        <h2 className="text-2xl">Invite Center</h2>
        <p className="mt-2 text-sm text-slate-600">Send a standard invite link. Admin access is managed later in Admin settings by user.</p>

        <form
          className="mt-4 grid max-w-xl gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            void generateInvite(formData);
          }}
        >
          <input
            name="adminEmail"
            type="email"
            placeholder="person@example.com"
            className="rounded-lg border border-slate-300 px-3 py-2"
            required
          />
          <button type="submit" className="w-fit rounded-lg bg-amber-700 px-4 py-2 text-white">
            Send invite
          </button>
        </form>

        {inviteStatus ? <p className="mt-3 text-sm text-slate-700">{inviteStatus}</p> : null}
        {inviteLink ? <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm break-all">{inviteLink}</p> : null}
      </section>
    </AppShell>
  );
}

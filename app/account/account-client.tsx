"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BiometricAuthManager } from "@/app/account/biometric-auth-manager";
import { PasswordManager } from "@/app/account/password-manager";
import type { NotificationPreference, UserProfile } from "@/lib/types";

export function AccountClientPage({
  user,
  preferences
}: {
  user: UserProfile;
  preferences?: NotificationPreference;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email);
  const [profileStatus, setProfileStatus] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const emailEnabled = preferences?.channels.includes("email") ?? false;
  const smsEnabled = preferences?.channels.includes("sms") ?? false;

  async function saveProfile() {
    setProfileBusy(true);
    setProfileStatus("");

    const response = await fetch("/api/account/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fullName, email })
    });

    const payload = (await response.json()) as { message?: string; error?: string };
    setProfileBusy(false);
    if (response.ok) {
      router.refresh();
    }
    setProfileStatus(payload.error ?? payload.message ?? "Profile update complete.");
  }

  return (
    <AppShell>
      <section className="card relative overflow-hidden p-5 sm:p-6">
        <h2 className="text-xl sm:text-2xl">My Account</h2>
        <p className="mt-2 text-sm text-slate-600">Edit your profile details and notification preferences.</p>

        <div className="mt-6 grid gap-5 sm:gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4">
            <h3 className="text-lg font-semibold">Profile Details</h3>
            <form
              className="mt-4 grid gap-4 text-sm"
              onSubmit={(event) => {
                event.preventDefault();
                void saveProfile();
              }}
            >
              <label className="grid gap-1.5 font-medium">
                <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Full name</span>
                <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="grid gap-1.5 font-medium">
                <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Email</span>
                <input value={email} onChange={(event) => setEmail(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <button type="submit" disabled={profileBusy} className="w-fit rounded-lg bg-amber-700 px-4 py-2 text-white disabled:opacity-60">
                {profileBusy ? "Saving..." : "Save profile"}
              </button>
              {profileStatus ? <p className="text-sm text-slate-700">{profileStatus}</p> : null}
            </form>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4">
            <h3 className="text-lg font-semibold">Notification Preferences</h3>
            <div className="mt-4 grid gap-4 text-sm">
              <div className="flex flex-wrap gap-3">
                <button type="button" disabled className={["rounded-full px-4 py-2 text-sm disabled:cursor-not-allowed", emailEnabled ? "bg-amber-700 text-white" : "border border-slate-300 bg-white text-slate-700"].join(" ")}>
                  Email
                </button>
                <button type="button" disabled className={["rounded-full px-4 py-2 text-sm disabled:cursor-not-allowed", smsEnabled ? "bg-amber-700 text-white" : "border border-slate-300 bg-white text-slate-700"].join(" ")}>
                  SMS
                </button>
              </div>
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                Under construction. Email and SMS delivery options will connect once the services are set up.
              </div>
            </div>
          </div>

          <PasswordManager email={email} />

          <BiometricAuthManager />
        </div>
      </section>
    </AppShell>
  );
}

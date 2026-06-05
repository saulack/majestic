"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BiometricAuthManager } from "@/app/account/biometric-auth-manager";
import { PasswordManager } from "@/app/account/password-manager";
import { ToggleSwitch } from "@/components/toggle-switch";
import { createClient } from "@/lib/supabase/client";
import type { AppRole, NotificationPreference, UserProfile } from "@/lib/types";

export function AccountClientPage({
  user,
  preferences,
  previewRole
}: {
  user: UserProfile;
  preferences?: NotificationPreference;
  previewRole: Extract<AppRole, "admin" | "user"> | null;
}) {
  const router = useRouter();
  const [fullName, setFullName] = useState(user.fullName);
  const [email, setEmail] = useState(user.email);
  const [profileStatus, setProfileStatus] = useState("");
  const [profileBusy, setProfileBusy] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const [logoutStatus, setLogoutStatus] = useState("");
  const [preferencesBusy, setPreferencesBusy] = useState(false);
  const [preferencesStatus, setPreferencesStatus] = useState("");
  const [reservationConfirmationEmail, setReservationConfirmationEmail] = useState(
    preferences?.reservationConfirmationEmail ?? false
  );
  const [reservationBookedByOtherEmail, setReservationBookedByOtherEmail] = useState(
    preferences?.reservationBookedByOtherEmail ?? false
  );
  const [inAppInboxDigestEmail, setInAppInboxDigestEmail] = useState(
    preferences?.inAppInboxDigestEmail ?? false
  );
  const [darkModeEnabled, setDarkModeEnabled] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }

    return window.localStorage.getItem("majestic-theme") === "dark";
  });
  useEffect(() => {
    const root = document.documentElement;

    if (darkModeEnabled) {
      root.setAttribute("data-theme", "dark");
      window.localStorage.setItem("majestic-theme", "dark");
      return;
    }

    root.removeAttribute("data-theme");
    window.localStorage.setItem("majestic-theme", "light");
  }, [darkModeEnabled]);

  async function handleLogout() {
    setLogoutBusy(true);
    setLogoutStatus("");

    const supabase = createClient();

    if (!supabase) {
      setLogoutBusy(false);
      setLogoutStatus("Sign out failed: app is not configured.");
      return;
    }

    const { error } = await supabase.auth.signOut();

    if (error) {
      setLogoutBusy(false);
      setLogoutStatus(error.message || "Sign out failed.");
      return;
    }

    router.replace("/login");
    router.refresh();
  }

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

  async function saveNotificationPreferences() {
    setPreferencesBusy(true);
    setPreferencesStatus("");

    const response = await fetch("/api/account/notification-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reservationConfirmationEmail, reservationBookedByOtherEmail, inAppInboxDigestEmail })
    });

    const payload = (await response.json()) as { message?: string; error?: string };
    setPreferencesBusy(false);
    setPreferencesStatus(payload.error ?? payload.message ?? "Preferences updated.");
  }

  return (
    <AppShell initialRole={user.role} initialPreviewRole={previewRole}>
      <section className="card relative overflow-hidden p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl">My Account</h2>
            <p className="mt-2 text-sm text-slate-600">Edit your profile details and notification preferences.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              void handleLogout();
            }}
            disabled={logoutBusy}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {logoutBusy ? "Signing out..." : "Log out"}
          </button>
        </div>
        {logoutStatus ? <p className="mt-3 text-sm text-rose-700">{logoutStatus}</p> : null}

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
              <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-800">Email me when I make a reservation</p>
                  <p className="mt-1 text-xs text-slate-500">Sends a reservation confirmation email after booking.</p>
                </div>
                <ToggleSwitch
                  checked={reservationConfirmationEmail}
                  onCheckedChange={setReservationConfirmationEmail}
                  srLabel="Toggle self reservation confirmation email"
                  offLabel="Off"
                  onLabel="On"
                />
              </label>

              <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-800">Email me when someone books for me</p>
                  <p className="mt-1 text-xs text-slate-500">Sends a confirmation email when another user creates a reservation on your behalf.</p>
                </div>
                <ToggleSwitch
                  checked={reservationBookedByOtherEmail}
                  onCheckedChange={setReservationBookedByOtherEmail}
                  srLabel="Toggle delegated reservation confirmation email"
                  offLabel="Off"
                  onLabel="On"
                />
              </label>

              <label className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-800">Email me when I have in-app notifications</p>
                  <p className="mt-1 text-xs text-slate-500">Sends a Majestic inbox summary email when unread notifications are waiting.</p>
                </div>
                <ToggleSwitch
                  checked={inAppInboxDigestEmail}
                  onCheckedChange={setInAppInboxDigestEmail}
                  srLabel="Toggle in-app notification digest email"
                  offLabel="Off"
                  onLabel="On"
                />
              </label>

              <div>
                <button
                  type="button"
                  disabled={preferencesBusy}
                  onClick={() => {
                    void saveNotificationPreferences();
                  }}
                  className="rounded-lg bg-amber-700 px-4 py-2 text-white disabled:opacity-60"
                >
                  {preferencesBusy ? "Saving..." : "Save notification preferences"}
                </button>
                {preferencesStatus ? <p className="mt-2 text-sm text-slate-700">{preferencesStatus}</p> : null}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4">
            <h3 className="text-lg font-semibold">Appearance</h3>
            <div className="mt-4 rounded-lg border border-slate-200 bg-white px-3 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-800">Dark mode</p>
                  <p className="mt-1 text-xs text-slate-500">Switch between light and dark mode. Your choice is saved on this device.</p>
                </div>
                <ToggleSwitch
                  checked={darkModeEnabled}
                  onCheckedChange={setDarkModeEnabled}
                  srLabel="Toggle dark mode"
                  offLabel="Light"
                  onLabel="Dark"
                />
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

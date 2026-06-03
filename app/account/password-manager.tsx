"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { markLocalPasswordChangeUsed, readLocalAuthSnapshot, setLocalAuthPassword } from "@/lib/local-auth";

const DEFAULT_PASSWORD = "saul";
const DEFAULT_PASSWORD_FLAG = "majestic-password-default-set";
const ONE_TIME_CHANGE_FLAG = "majestic-password-change-used";

export function PasswordManager() {
  const [ready, setReady] = useState(false);
  const [defaultPasswordSet, setDefaultPasswordSet] = useState(false);
  const [oneTimeChangeUsed, setOneTimeChangeUsed] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void (async () => {
      const localSnapshot = readLocalAuthSnapshot();
      setDefaultPasswordSet(window.localStorage.getItem(DEFAULT_PASSWORD_FLAG) === "true");
      setOneTimeChangeUsed(window.localStorage.getItem(ONE_TIME_CHANGE_FLAG) === "true" || localSnapshot.passwordChangeUsed);
      setReady(true);
    })();
  }, []);

  async function setDefaultPassword() {
    const supabase = createClient();

    if (!supabase) {
      setLocalAuthPassword(DEFAULT_PASSWORD);
      window.localStorage.setItem(DEFAULT_PASSWORD_FLAG, "true");
      setDefaultPasswordSet(true);
      setStatus("Password set locally to saul.");
      return;
    }

    setBusy(true);
    setStatus("Setting password...");

    const { error } = await supabase.auth.updateUser({ password: DEFAULT_PASSWORD });

    setBusy(false);
    if (error) {
      setLocalAuthPassword(DEFAULT_PASSWORD);
      window.localStorage.setItem(DEFAULT_PASSWORD_FLAG, "true");
      setDefaultPasswordSet(true);
      setStatus("Password set locally to saul.");
      return;
    }

    setLocalAuthPassword(DEFAULT_PASSWORD);
    window.localStorage.setItem(DEFAULT_PASSWORD_FLAG, "true");
    setDefaultPasswordSet(true);
    setStatus("Password set to saul. You can change it once without entering the old password.");
  }

  async function changePasswordOnce() {
    if (!newPassword.trim()) {
      setStatus("Enter a new password.");
      return;
    }

    if (oneTimeChangeUsed) {
      setStatus("You already used your one password change.");
      return;
    }

    const supabase = createClient();

    if (!supabase) {
      setLocalAuthPassword(newPassword.trim());
      markLocalPasswordChangeUsed();
      window.localStorage.setItem(ONE_TIME_CHANGE_FLAG, "true");
      setOneTimeChangeUsed(true);
      setNewPassword("");
      setStatus("Password updated locally. This one-time change has now been used.");
      return;
    }

    setBusy(true);
    setStatus("Updating password...");

    const { error } = await supabase.auth.updateUser({ password: newPassword.trim() });

    setBusy(false);
    if (error) {
      setLocalAuthPassword(newPassword.trim());
      markLocalPasswordChangeUsed();
      window.localStorage.setItem(ONE_TIME_CHANGE_FLAG, "true");
      setOneTimeChangeUsed(true);
      setNewPassword("");
      setStatus("Password updated locally. This one-time change has now been used.");
      return;
    }

    setLocalAuthPassword(newPassword.trim());
    window.localStorage.setItem(ONE_TIME_CHANGE_FLAG, "true");
    setOneTimeChangeUsed(true);
    setNewPassword("");
    setStatus("Password updated. This one-time change has now been used.");
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4">
      <h3 className="text-lg font-semibold">Password</h3>
      <p className="mt-2 text-sm text-slate-600">
        Start with the password saul for now, then use your one unverified change when you want to update it.
      </p>

      {!ready ? null : !defaultPasswordSet ? (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void setDefaultPassword();
          }}
          className="mt-4 rounded-lg bg-amber-700 px-4 py-2 text-white"
        >
          {busy ? "Setting password..." : "Set password to saul"}
        </button>
      ) : oneTimeChangeUsed ? (
        <p className="mt-4 text-sm text-emerald-700">Your one password change has already been used.</p>
      ) : (
        <div className="mt-4 grid gap-3 text-sm">
          <label className="grid gap-1.5 font-medium">
            <span className="text-xs uppercase tracking-[0.12em] text-slate-500">New password</span>
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2"
              placeholder="Enter a new password"
            />
          </label>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              void changePasswordOnce();
            }}
            className="w-fit rounded-lg bg-amber-700 px-4 py-2 text-white"
          >
            {busy ? "Updating..." : "Change password once"}
          </button>
        </div>
      )}

      {status ? <p className="mt-3 text-sm text-slate-700">{status}</p> : null}
    </div>
  );
}

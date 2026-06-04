"use client";

import { useState } from "react";
import { disableBiometricAuth, enrollBiometricAuth, isBiometricAuthEnabled, supportsBiometricAuth } from "@/lib/biometric-auth";
import { readLocalAuthSnapshot } from "@/lib/local-auth";

export function BiometricAuthManager() {
  const supported = supportsBiometricAuth();
  const [enabled, setEnabled] = useState(() => isBiometricAuthEnabled());
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function handleEnable() {
    const username = readLocalAuthSnapshot().username;
    setBusy(true);
    setMessage("");

    const result = await enrollBiometricAuth(username);

    setBusy(false);
    if (!result.ok) {
      setMessage(result.error ?? "Failed to enable biometric authentication.");
      return;
    }

    setEnabled(true);
    setMessage("Biometric authentication is enabled.");
  }

  function handleDisable() {
    disableBiometricAuth();
    setEnabled(false);
    setMessage("Biometric authentication has been turned off.");
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4">
      <h3 className="text-lg font-semibold">Biometric Authentication</h3>
      <p className="mt-2 text-sm text-slate-600">
        Optional security: after entering password, require Face ID or fingerprint from your device.
      </p>

      {!supported ? (
        <p className="mt-4 text-sm text-rose-700">Biometric authentication is not supported on this browser/device.</p>
      ) : enabled ? (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">Enabled</span>
          <button type="button" onClick={handleDisable} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
            Disable biometric auth
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            void handleEnable();
          }}
          className="mt-4 rounded-lg bg-amber-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? "Enabling..." : "Enable biometric auth"}
        </button>
      )}

      {message ? <p className="mt-3 text-sm text-slate-700">{message}</p> : null}
    </div>
  );
}

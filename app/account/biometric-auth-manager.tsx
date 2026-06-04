"use client";

import { useState } from "react";
import { ToggleSwitch } from "@/components/toggle-switch";
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
        Optional sign-in method: use Face ID or fingerprint instead of typing password, or switch back to password any time on the login page.
      </p>

      {!supported ? (
        <p className="mt-4 text-sm text-rose-700">Biometric authentication is not supported on this browser/device.</p>
      ) : (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
          <div>
            <p className="text-sm font-medium text-slate-800">{enabled ? "Biometric auth enabled" : busy ? "Enabling biometric auth..." : "Biometric auth disabled"}</p>
            <p className="text-sm text-slate-500">Use the switch to enable or disable biometric sign-in. Password sign-in always remains available.</p>
          </div>
          <ToggleSwitch
            checked={enabled}
            disabled={busy}
            onCheckedChange={(checked) => {
              if (checked) {
                void handleEnable();
                return;
              }

              handleDisable();
            }}
            srLabel="Toggle biometric authentication"
            offLabel="Off"
            onLabel="On"
          />
        </div>
      )}

      {message ? <p className="mt-3 text-sm text-slate-700">{message}</p> : null}
    </div>
  );
}

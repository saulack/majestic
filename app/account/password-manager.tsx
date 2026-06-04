"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function PasswordManager({ email }: { email: string }) {
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  async function requestPasswordReset() {
    const supabase = createClient();

    if (!supabase) {
      setStatus("Password reset email will be connected later.");
      return;
    }

    setBusy(true);
    setStatus("Preparing reset...");

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`
    });

    setBusy(false);
    if (error) {
      setStatus(error.message);
      return;
    }

    setStatus(`Password reset instructions sent to ${email}.`);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4">
      <h3 className="text-lg font-semibold">Password</h3>
      <p className="mt-2 text-sm text-slate-600">
        Use a password reset flow instead of a hard-coded temporary password. We can connect this to a fuller email service next.
      </p>

      <button
        type="button"
        disabled={busy}
        onClick={() => {
          void requestPasswordReset();
        }}
        className="mt-4 rounded-lg bg-amber-700 px-4 py-2 text-white disabled:opacity-60"
      >
        {busy ? "Preparing reset..." : "Reset password"}
      </button>

      {status ? <p className="mt-3 text-sm text-slate-700">{status}</p> : null}
    </div>
  );
}

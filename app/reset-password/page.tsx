"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const router = useRouter();
  const configuredSupabase = useMemo(() => createClient(), []);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(
    configuredSupabase ? "" : "Supabase is not configured yet. Add env variables first."
  );
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const supabase = configuredSupabase;

    if (!supabase) {
      return;
    }

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setReady(true);
      }
    });

    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setReady(true);
      }
    })();

    return () => {
      subscription.unsubscribe();
    };
  }, [configuredSupabase]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!newPassword.trim()) {
      setMessage("Enter a new password.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setMessage("Supabase is not configured yet. Add env variables first.");
      return;
    }

    setBusy(true);
    setMessage("");

    const { error } = await supabase.auth.updateUser({ password: newPassword.trim() });

    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Password updated. Redirecting to login...");
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
      <div className="card w-full p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-amber-700">Account Recovery</p>
        <h1 className="mt-3 text-2xl sm:text-3xl">Set a new password</h1>
        <p className="mt-2 text-sm text-slate-600">
          Use the link from your reset email to set a new password.
        </p>

        {!ready ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Waiting for recovery session. Open this page from your password reset email link.
          </div>
        ) : (
          <form className="mt-6 grid gap-4" onSubmit={handleSubmit}>
            <label className="grid gap-1.5 text-sm font-medium">
              <span className="text-xs uppercase tracking-[0.12em] text-slate-500">New password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Enter a new password"
              />
            </label>

            <label className="grid gap-1.5 text-sm font-medium">
              <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Confirm password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2"
                placeholder="Confirm your new password"
              />
            </label>

            <button type="submit" disabled={busy} className="rounded-lg bg-amber-700 px-4 py-2 text-white disabled:opacity-60">
              {busy ? "Saving..." : "Update password"}
            </button>
          </form>
        )}

        {message ? <p className="mt-4 text-sm text-slate-700">{message}</p> : null}

        <div className="mt-6">
          <Link href="/login" className="text-sm font-medium text-amber-700 hover:text-amber-800">
            Back to login
          </Link>
        </div>
      </div>
    </main>
  );
}

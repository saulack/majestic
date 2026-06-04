"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isBiometricAuthEnabled, verifyBiometricAuthentication } from "@/lib/biometric-auth";
import { activateLocalAuthSession, getLocalAuthDefaults, readLocalAuthSnapshot, setLocalAuthPassword } from "@/lib/local-auth";

function resolveLoginEmail(username: string) {
  return username.includes("@") ? username : username === "saulack" ? "saulack@gmail.com" : `${username}@gmail.com`;
}

export default function LoginPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetUsername, setResetUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  async function completeReset() {
    if (!resetEmail) {
      setMessage("A reset is not currently active.");
      return;
    }

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

    const resetResponse = await fetch("/api/auth/force-password-reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: resetEmail, password: newPassword.trim() })
    });

    const resetPayload = (await resetResponse.json()) as { error?: string };
    if (!resetResponse.ok) {
      setBusy(false);
      setMessage(resetPayload.error ?? "Failed to reset password.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: resetEmail,
      password: newPassword.trim()
    });

    setBusy(false);

    if (error) {
      setMessage(error.message);
      return;
    }

    if (isBiometricAuthEnabled()) {
      const biometric = await verifyBiometricAuthentication();
      if (!biometric.ok) {
        await supabase.auth.signOut();
        setMessage(biometric.error ?? "Biometric authentication failed.");
        return;
      }
    }

    setLocalAuthPassword(newPassword.trim());
    activateLocalAuthSession(resetUsername || resetEmail);
    setResetEmail("");
    setResetUsername("");
    setNewPassword("");
    setConfirmPassword("");
    router.push("/");
    router.refresh();
  }

  async function handleLogin(formData: FormData) {
    const username = String(formData.get("username") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "").trim();
    const localSnapshot = readLocalAuthSnapshot();
    const defaults = getLocalAuthDefaults();

    if (!username || !password) {
      setMessage("Username and password are required.");
      return;
    }

    setResetEmail("");
    setResetUsername("");
    setNewPassword("");
    setConfirmPassword("");

    const localUsernameMatches = username === defaults.username || username === localSnapshot.username;
    const localPasswordMatches = password === localSnapshot.password;

    if (localUsernameMatches && localPasswordMatches && !createClient()) {
      if (isBiometricAuthEnabled()) {
        const biometric = await verifyBiometricAuthentication();
        if (!biometric.ok) {
          setMessage(biometric.error ?? "Biometric authentication failed.");
          return;
        }
      }

      activateLocalAuthSession(username);
      setMessage("Signed in with the local session.");
      router.push("/");
      router.refresh();
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      if (localUsernameMatches && localPasswordMatches) {
        if (isBiometricAuthEnabled()) {
          const biometric = await verifyBiometricAuthentication();
          if (!biometric.ok) {
            setMessage(biometric.error ?? "Biometric authentication failed.");
            return;
          }
        }

        activateLocalAuthSession(username);
        setMessage("Signed in with the local session.");
        router.push("/");
        router.refresh();
        return;
      }

      setMessage("Supabase is not configured yet. Add env variables first.");
      return;
    }

    const email = resolveLoginEmail(username);

    setBusy(true);
    setMessage("");

    const resetStatusResponse = await fetch("/api/auth/force-password-reset-status", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email })
    });

    const resetStatusPayload = (await resetStatusResponse.json()) as { required?: boolean; error?: string };
    if (!resetStatusResponse.ok) {
      setBusy(false);
      setMessage(resetStatusPayload.error ?? "Could not check password reset status.");
      return;
    }

    if (resetStatusPayload.required) {
      setBusy(false);
      setResetEmail(email);
      setResetUsername(username);
      setMessage("Your password has been reset by the superadmin. Set a new password to continue.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    setBusy(false);

    if (!error) {
      if (isBiometricAuthEnabled()) {
        const biometric = await verifyBiometricAuthentication();
        if (!biometric.ok) {
          await supabase.auth.signOut();
          setMessage(biometric.error ?? "Biometric authentication failed.");
          return;
        }
      }

      activateLocalAuthSession(username);
      router.push("/");
      router.refresh();
      return;
    }

    if (localUsernameMatches && localPasswordMatches) {
      if (isBiometricAuthEnabled()) {
        const biometric = await verifyBiometricAuthentication();
        if (!biometric.ok) {
          setMessage(biometric.error ?? "Biometric authentication failed.");
          return;
        }
      }

      activateLocalAuthSession(username);
      setMessage("Signed in with the local session.");
      router.push("/");
      router.refresh();
      return;
    }

    setMessage(error.message);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
      <div className="card w-full p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-amber-700">Secure Access</p>
        <h1 className="mt-3 text-2xl sm:text-3xl">Sign in</h1>
        <p className="mt-2 text-sm text-slate-600">Use your username and password to access the apartment app.</p>

        <form
          className="mt-6 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            void handleLogin(formData);
          }}
        >
          <label className="grid gap-1.5 text-sm font-medium">
            <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Username</span>
            <input name="username" className="rounded-lg border border-slate-300 px-3 py-2" placeholder="Username" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Password</span>
            <input name="password" type="password" className="rounded-lg border border-slate-300 px-3 py-2" placeholder="Password" />
          </label>
          <button type="submit" disabled={busy} className="rounded-lg bg-amber-700 px-4 py-2 text-white">
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>

        {resetEmail ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-sm font-medium text-amber-900">Password reset required</p>
            <p className="mt-1 text-sm text-amber-800">Set a new password for {resetEmail} to finish signing in.</p>

            <div className="mt-4 grid gap-3">
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
              <button type="button" disabled={busy} onClick={() => void completeReset()} className="rounded-lg bg-amber-700 px-4 py-2 text-white">
                {busy ? "Resetting..." : "Set new password"}
              </button>
            </div>
          </div>
        ) : null}

        {message ? <p className="mt-4 text-sm text-slate-700">{message}</p> : null}

        <div className="mt-6 flex items-center gap-4 text-sm">
          <Link href="/" className="text-amber-700 hover:underline">
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}

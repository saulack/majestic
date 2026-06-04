"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isBiometricAuthEnabled, supportsBiometricAuth, verifyBiometricAuthentication } from "@/lib/biometric-auth";
import { activateLocalAuthSession, getLocalAuthDefaults, readLocalAuthSnapshot, setLocalAuthPassword } from "@/lib/local-auth";

function resolveLoginEmail(identifier: string) {
  return identifier.trim().toLowerCase();
}

function emailLooksValid(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export default function LoginPage() {
  const router = useRouter();
  const biometricAvailable = supportsBiometricAuth() && isBiometricAuthEnabled();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [loginMethod, setLoginMethod] = useState<"password" | "biometric">("password");
  const [resetEmail, setResetEmail] = useState("");
  const [resetUsername, setResetUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loginIdentifier, setLoginIdentifier] = useState(() => {
    if (typeof window === "undefined") {
      return "";
    }

    return new URLSearchParams(window.location.search).get("email")?.trim() ?? "";
  });

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
    const identifier = loginIdentifier.trim().toLowerCase();
    const password = String(formData.get("password") ?? "").trim();
    const localSnapshot = readLocalAuthSnapshot();
    const defaults = getLocalAuthDefaults();

    if (!identifier || !password) {
      setMessage("Email and password are required.");
      return;
    }

    if (!emailLooksValid(identifier)) {
      setMessage("Use your full email address to sign in.");
      return;
    }

    setResetEmail("");
    setResetUsername("");
    setNewPassword("");
    setConfirmPassword("");

    const localUsernameMatches = identifier === defaults.username || identifier === localSnapshot.username;
    const localPasswordMatches = password === localSnapshot.password;

    if (localUsernameMatches && localPasswordMatches && !createClient()) {
      activateLocalAuthSession(identifier);
      setMessage("Signed in with the local session.");
      router.push("/");
      router.refresh();
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      if (localUsernameMatches && localPasswordMatches) {
        activateLocalAuthSession(identifier);
        setMessage("Signed in with the local session.");
        router.push("/");
        router.refresh();
        return;
      }

      setMessage("Supabase is not configured yet. Add env variables first.");
      return;
    }

    const email = resolveLoginEmail(identifier);

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
      setResetUsername(identifier);
      setMessage("Your password has been reset by the superadmin. Set a new password to continue.");
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    setBusy(false);

    if (!error) {
      activateLocalAuthSession(identifier);
      router.push("/");
      router.refresh();
      return;
    }

    if (localUsernameMatches && localPasswordMatches) {
      activateLocalAuthSession(identifier);
      setMessage("Signed in with the local session.");
      router.push("/");
      router.refresh();
      return;
    }

    setMessage(error.message);
  }

  async function handleBiometricLogin() {
    if (!biometricAvailable) {
      setMessage("Biometric sign-in is not available. Use password sign-in.");
      return;
    }

    const snapshot = readLocalAuthSnapshot();
    const identifier = (loginIdentifier.trim().toLowerCase() || snapshot.username || "").trim();

    if (!identifier || !emailLooksValid(identifier)) {
      setMessage("Enter your account email, then try biometric sign-in.");
      return;
    }

    if (!snapshot.password) {
      setMessage("No saved credentials found for biometric sign-in. Use password sign-in first.");
      return;
    }

    setBusy(true);
    setMessage("");

    const biometric = await verifyBiometricAuthentication();
    if (!biometric.ok) {
      setBusy(false);
      setMessage(biometric.error ?? "Biometric authentication failed.");
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      activateLocalAuthSession(identifier);
      setBusy(false);
      setMessage("Signed in with biometric authentication.");
      router.push("/");
      router.refresh();
      return;
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: identifier,
      password: snapshot.password
    });

    setBusy(false);

    if (error) {
      setMessage("Biometric verified, but saved credentials are outdated. Use password sign-in once to refresh.");
      return;
    }

    setLoginIdentifier(identifier);
    activateLocalAuthSession(identifier);
    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
      <div className="card w-full p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-amber-700">Secure Access</p>
        <h1 className="mt-3 text-2xl sm:text-3xl">Sign in</h1>
        <p className="mt-2 text-sm text-slate-600">Choose password or biometric sign-in. You can switch methods any time.</p>

        <div className="mt-5 inline-flex rounded-lg border border-slate-300 bg-white p-1">
          <button
            type="button"
            onClick={() => {
              setLoginMethod("password");
              setMessage("");
            }}
            className={[
              "rounded-md px-3 py-1.5 text-sm",
              loginMethod === "password" ? "bg-amber-700 text-white" : "text-slate-700"
            ].join(" ")}
          >
            Password
          </button>
          <button
            type="button"
            disabled={!biometricAvailable}
            onClick={() => {
              setLoginMethod("biometric");
              setMessage("");
            }}
            className={[
              "rounded-md px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50",
              loginMethod === "biometric" ? "bg-amber-700 text-white" : "text-slate-700"
            ].join(" ")}
          >
            Biometric
          </button>
        </div>

        {!biometricAvailable ? (
          <p className="mt-2 text-xs text-slate-500">
            Enable biometric authentication in Account to use passwordless biometric sign-in.
          </p>
        ) : null}

        {loginMethod === "password" ? (
          <form
            className="mt-6 grid gap-4"
            onSubmit={(event) => {
              event.preventDefault();
              const formData = new FormData(event.currentTarget);
              void handleLogin(formData);
            }}
          >
            <label className="grid gap-1.5 text-sm font-medium">
              <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Email</span>
              <input
                name="email"
                type="email"
                value={loginIdentifier}
                onChange={(event) => setLoginIdentifier(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2"
                placeholder="name@example.com"
                autoComplete="email"
                required
              />
            </label>
            <label className="grid gap-1.5 text-sm font-medium">
              <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Password</span>
              <input name="password" type="password" className="rounded-lg border border-slate-300 px-3 py-2" placeholder="Password" />
            </label>
            <button type="submit" disabled={busy} className="rounded-lg bg-amber-700 px-4 py-2 text-white">
              {busy ? "Signing in..." : "Sign in"}
            </button>
          </form>
        ) : (
          <div className="mt-6 grid gap-4">
            <label className="grid gap-1.5 text-sm font-medium">
              <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Email</span>
              <input
                type="email"
                value={loginIdentifier}
                onChange={(event) => setLoginIdentifier(event.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2"
                placeholder="name@example.com"
                autoComplete="email"
              />
            </label>
            <button
              type="button"
              disabled={busy || !biometricAvailable}
              onClick={() => {
                void handleBiometricLogin();
              }}
              className="rounded-lg bg-amber-700 px-4 py-2 text-white disabled:opacity-60"
            >
              {busy ? "Verifying..." : "Sign in with biometric"}
            </button>
            <p className="text-xs text-slate-500">
              Biometric sign-in skips typing your password. If credentials changed, use Password mode once.
            </p>
          </div>
        )}

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

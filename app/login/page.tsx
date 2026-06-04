"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isBiometricAuthEnabled, verifyBiometricAuthentication } from "@/lib/biometric-auth";
import { activateLocalAuthSession, getLocalAuthDefaults, readLocalAuthSnapshot } from "@/lib/local-auth";

export default function LoginPage() {
  const router = useRouter();
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleLogin(formData: FormData) {
    const username = String(formData.get("username") ?? "").trim().toLowerCase();
    const password = String(formData.get("password") ?? "").trim();
    const localSnapshot = readLocalAuthSnapshot();
    const defaults = getLocalAuthDefaults();

    if (!username || !password) {
      setMessage("Username and password are required.");
      return;
    }

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

    const email = username.includes("@") ? username : username === "saulack" ? "saulack@gmail.com" : `${username}@gmail.com`;

    setBusy(true);
    setMessage("");

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
            <input name="username" defaultValue="saulack" className="rounded-lg border border-slate-300 px-3 py-2" placeholder="saulack" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Password</span>
            <input name="password" type="password" defaultValue="saul" className="rounded-lg border border-slate-300 px-3 py-2" placeholder="saul" />
          </label>
          <button type="submit" disabled={busy} className="rounded-lg bg-amber-700 px-4 py-2 text-white">
            {busy ? "Signing in..." : "Sign in"}
          </button>
        </form>

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

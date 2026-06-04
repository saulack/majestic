"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const passwordRules = [
  { label: "At least 8 characters", test: (value: string) => value.length >= 8 },
  { label: "One uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { label: "One lowercase letter", test: (value: string) => /[a-z]/.test(value) },
  { label: "One number", test: (value: string) => /\d/.test(value) },
  { label: "One special character", test: (value: string) => /[^A-Za-z0-9]/.test(value) }
];

export function SignupForm({ inviteToken }: { inviteToken: string }) {
  const router = useRouter();
  const [message, setMessage] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const passwordChecks = passwordRules.map((rule) => ({
    label: rule.label,
    passed: rule.test(password)
  }));

  const passwordStrongEnough = passwordChecks.every((rule) => rule.passed);

  async function handleSignup() {
    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();
    const cleanPassword = password.trim();

    if (!inviteToken) {
      setMessage("This invite link is missing or invalid.");
      return;
    }

    if (!cleanName || !cleanEmail || !cleanPassword || !confirmPassword.trim()) {
      setMessage("Name, email, password, and confirm password are required.");
      return;
    }

    if (!passwordStrongEnough) {
      setMessage("Please meet all password safety rules before continuing.");
      return;
    }

    if (cleanPassword !== confirmPassword.trim()) {
      setMessage("Password and confirm password must match.");
      return;
    }

    setBusy(true);
    setMessage("");

    const response = await fetch("/api/auth/complete-invite-signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        inviteToken,
        fullName: cleanName,
        email: cleanEmail,
        password: cleanPassword
      })
    });

    const payload = (await response.json()) as { message?: string; error?: string; loginEmail?: string };

    setBusy(false);

    if (!response.ok || payload.error) {
      setMessage(payload.error ?? "Failed to complete registration.");
      return;
    }

    setMessage(payload.message ?? "Registration complete. Redirecting to sign in...");
    const loginEmail = payload.loginEmail?.trim().toLowerCase() || cleanEmail;
    router.push(`/login?email=${encodeURIComponent(loginEmail)}`);
    router.refresh();
  }

  if (!inviteToken) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-lg items-center px-6">
        <div className="card w-full p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-700">Invite only</p>
          <h1 className="mt-3 text-2xl sm:text-3xl">Finish registration from your invite</h1>
          <p className="mt-2 text-sm text-slate-600">Open a valid invite link to register. Public signup is not available.</p>
          <div className="mt-6 flex items-center gap-4 text-sm">
            <Link href="/login" className="text-slate-700 hover:underline">
              Go to login
            </Link>
            <span className="text-slate-300">|</span>
            <Link href="/" className="text-amber-700 hover:underline">
              Back to dashboard
            </Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg items-center px-6">
      <div className="card w-full p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-amber-700">Invite Registration</p>
        <h1 className="mt-2 text-2xl sm:text-3xl">Set up your account</h1>
        <p className="mt-2 text-sm text-slate-600">Add your name, email, and secure password to finish registration.</p>

        <form
          className="mt-6 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSignup();
          }}
        >
          <label className="grid gap-1.5 text-sm font-medium">
            <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Name</span>
            <input value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Full name" className="rounded-lg border border-slate-300 px-3 py-2" required />
          </label>

          <label className="grid gap-1.5 text-sm font-medium">
            <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Email</span>
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              type="email"
              placeholder="name@example.com"
              className="rounded-lg border border-slate-300 px-3 py-2"
              required
            />
          </label>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Password requirements</p>
            <ul className="mt-3 grid gap-2 text-sm text-slate-600">
              {passwordChecks.map((rule) => (
                <li key={rule.label} className={rule.passed ? "font-medium text-emerald-700" : ""}>
                  {rule.passed ? "Meets" : "Needs"} {rule.label.toLowerCase()}
                </li>
              ))}
            </ul>
          </div>

          <label className="grid gap-1.5 text-sm font-medium">
            <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Password</span>
            <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white">
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                type={showPassword ? "text" : "password"}
                placeholder="Create password"
                className="min-w-0 flex-1 px-3 py-2 outline-none"
                required
              />
              <button type="button" onClick={() => setShowPassword((current) => !current)} className="border-l border-slate-200 px-3 text-sm text-slate-600">
                {showPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          <label className="grid gap-1.5 text-sm font-medium">
            <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Confirm password</span>
            <div className="flex overflow-hidden rounded-lg border border-slate-300 bg-white">
              <input
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm password"
                className="min-w-0 flex-1 px-3 py-2 outline-none"
                required
              />
              <button type="button" onClick={() => setShowConfirmPassword((current) => !current)} className="border-l border-slate-200 px-3 text-sm text-slate-600">
                {showConfirmPassword ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          <button disabled={busy} className="rounded-lg bg-amber-700 px-4 py-2 text-white" type="submit">
            {busy ? "Finishing registration..." : "Finish registration"}
          </button>
        </form>

        {message ? <p className="mt-4 text-sm text-slate-700">{message}</p> : null}
      </div>
    </main>
  );
}

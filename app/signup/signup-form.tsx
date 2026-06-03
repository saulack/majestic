"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function SignupForm({ inviteToken }: { inviteToken: string }) {
  const [message, setMessage] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function handleSignup(formData: FormData) {
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "").trim();
    const fullName = String(formData.get("fullName") ?? "").trim();

    if (!email || !password || !fullName) {
      setMessage("All fields are required.");
      return;
    }

    const supabase = createClient();
    if (!supabase) {
      setMessage("Supabase is not configured yet. Add env variables first.");
      return;
    }

    setBusy(true);
    setMessage("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          invite_token: inviteToken || null
        }
      }
    });

    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }

    setMessage("Account created. Check your email for confirmation.");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
      <div className="card w-full p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-amber-700">Create Account</p>
        <h1 className="mt-2 text-3xl">Sign up</h1>
        <p className="mt-2 text-sm text-slate-600">
          {inviteToken ? "Admin invite detected. This signup will attempt admin role assignment." : "Standard user signup."}
        </p>

        <form
          className="mt-6 grid gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            const formData = new FormData(event.currentTarget);
            void handleSignup(formData);
          }}
        >
          <input name="fullName" placeholder="Full name" className="rounded-lg border border-slate-300 px-3 py-2" required />
          <input name="email" type="email" placeholder="Email" className="rounded-lg border border-slate-300 px-3 py-2" required />
          <input name="password" type="password" placeholder="Password" className="rounded-lg border border-slate-300 px-3 py-2" required />
          <button disabled={busy} className="rounded-lg bg-slate-900 px-4 py-2 text-white" type="submit">
            {busy ? "Creating account..." : "Create account"}
          </button>
        </form>

        {message ? <p className="mt-4 text-sm text-slate-700">{message}</p> : null}
      </div>
    </main>
  );
}

import Link from "next/link";

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
      <div className="card w-full p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.3em] text-amber-700">Secure Access</p>
        <h1 className="mt-3 text-2xl sm:text-3xl">Sign in</h1>
        <p className="mt-2 text-sm text-slate-600">Use Supabase email/password or magic link authentication.</p>

        <form className="mt-6 grid gap-4">
          <label className="grid gap-1.5 text-sm font-medium">
            <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Email</span>
            <input className="rounded-lg border border-slate-300 px-3 py-2" placeholder="you@example.com" />
          </label>
          <label className="grid gap-1.5 text-sm font-medium">
            <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Password</span>
            <input type="password" className="rounded-lg border border-slate-300 px-3 py-2" placeholder="********" />
          </label>
          <button type="button" className="rounded-lg bg-amber-700 px-4 py-2 text-white">
            Sign in
          </button>
          <button type="button" className="rounded-lg border border-slate-300 px-4 py-2">
            Send magic link
          </button>
        </form>

        <div className="mt-6 flex items-center gap-4 text-sm">
          <Link href="/signup" className="text-slate-700 hover:underline">
            Create account
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

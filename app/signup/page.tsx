import { SignupForm } from "@/app/signup/signup-form";
import Link from "next/link";

export default function SignupPage({
  searchParams
}: {
  searchParams?: { invite_token?: string };
}) {
  const inviteToken = searchParams?.invite_token ?? "";

  if (!inviteToken) {
    return (
      <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-6">
        <div className="card w-full p-6 sm:p-8">
          <p className="text-xs uppercase tracking-[0.3em] text-amber-700">Invite only</p>
          <h1 className="mt-3 text-2xl sm:text-3xl">No public signup</h1>
          <p className="mt-2 text-sm text-slate-600">Account creation is only available through an invite link from an admin.</p>
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

  return <SignupForm inviteToken={inviteToken} />;
}

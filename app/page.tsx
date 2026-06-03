import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { currentUser, mockReservations } from "@/lib/mock-data";

export default function HomePage() {
  return (
    <AppShell>
      <section className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="card overflow-hidden">
          <div className="bg-gradient-to-r from-amber-900 to-amber-700 p-8 text-white">
            <p className="text-xs uppercase tracking-[0.3em]">Welcome back</p>
            <h2 className="mt-2 text-4xl font-semibold">{currentUser.fullName}</h2>
            <p className="mt-3 max-w-xl text-sm text-amber-100">
              Reserve the apartment, manage your stays, and keep everyone aligned through shared visibility.
            </p>
          </div>
          <div className="grid gap-4 p-6 sm:grid-cols-3">
            <Metric label="Total reservations" value={String(mockReservations.length)} />
            <Metric label="Your next stay" value={mockReservations[0]?.startDate ?? "-"} />
            <Metric label="Notification channels" value="Email, SMS, WhatsApp" />
          </div>
        </div>

        <div className="card card-strong p-6">
          <h3 className="text-xl">Quick Actions</h3>
          <div className="mt-4 grid gap-3">
            <Action href="/reservations" title="Create reservation" subtitle="Book your next stay in seconds" />
            <Action href="/reservations" title="Edit or cancel" subtitle="Manage only your reservations" />
            <Action href="/stats" title="Review yearly stats" subtitle="Track total days by user" />
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-xl font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function Action({ href, title, subtitle }: { href: string; title: string; subtitle: string }) {
  return (
    <Link href={href} className="rounded-xl border border-slate-200 bg-white p-4 transition hover:shadow-md">
      <p className="font-semibold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-600">{subtitle}</p>
    </Link>
  );
}

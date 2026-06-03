import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { currentUser, mockReservations } from "@/lib/mock-data";

export default function HomePage() {
  return (
    <AppShell>
      <section className="grid gap-5 sm:gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 bg-gradient-to-r from-[#2f231d] via-[#3a2a22] to-[#4a3328] p-6 text-white sm:p-8">
            <p className="text-[11px] uppercase tracking-[0.3em] text-amber-100 sm:text-xs sm:tracking-[0.32em]">Family Dashboard</p>
            <h2 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">{currentUser.fullName}</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-slate-300">
              Keep family stays coordinated, track reservations, and share apartment updates in one private place.
            </p>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-3 sm:gap-4 sm:p-6">
            <Metric label="Total reservations" value={String(mockReservations.length)} />
            <Metric label="Your next stay" value={mockReservations[0]?.startDate ?? "-"} />
            <Metric label="Notification channels" value="Email, SMS, WhatsApp" />
          </div>
        </div>

        <div className="card card-strong p-5 sm:p-6">
          <h3 className="text-lg sm:text-xl">Quick Actions</h3>
          <div className="mt-4 grid gap-3">
            <Action href="/reservations" title="Create reservation" subtitle="Plan your next family stay" />
            <Action href="/reservations" title="Manage requests" subtitle="Review approvals, denials, and notes" />
            <Action href="/stats" title="View personal stats" subtitle="Track your own stays and nights" />
          </div>
        </div>
      </section>
    </AppShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 sm:p-4">
      <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500 sm:text-xs sm:tracking-[0.16em]">{label}</p>
      <p className="mt-2 text-lg font-semibold text-slate-900 sm:text-xl">{value}</p>
    </div>
  );
}

function Action({ href, title, subtitle }: { href: string; title: string; subtitle: string }) {
  return (
    <Link href={href} className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 transition hover:border-amber-700 hover:bg-amber-50/40 sm:p-4">
      <p className="text-sm font-semibold text-slate-900 sm:text-base">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">{subtitle}</p>
    </Link>
  );
}

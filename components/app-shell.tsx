import Link from "next/link";
import { CalendarDays, ChartColumnBig, Bell, Home, ShieldCheck } from "lucide-react";
import type { PropsWithChildren } from "react";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#f9f4eb_0%,#f2efe9_40%,#ece7df_100%)] text-slate-900">
      <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-amber-700">Majestic Residence</p>
          <h1 className="font-serif text-2xl">Bookings Concierge</h1>
        </div>
        <nav className="flex gap-2 rounded-full bg-white/80 p-1 shadow-lg backdrop-blur">
          <NavItem href="/" label="Home" icon={<Home className="h-4 w-4" />} />
          <NavItem href="/reservations" label="Reservations" icon={<CalendarDays className="h-4 w-4" />} />
          <NavItem href="/stats" label="Stats" icon={<ChartColumnBig className="h-4 w-4" />} />
          <NavItem href="/admin" label="Admin" icon={<ShieldCheck className="h-4 w-4" />} />
          <NavItem href="/settings/notifications" label="Alerts" icon={<Bell className="h-4 w-4" />} />
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl px-6 pb-16">{children}</main>
    </div>
  );
}

function NavItem({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-900 hover:text-white"
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

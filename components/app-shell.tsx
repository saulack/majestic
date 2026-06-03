import Link from "next/link";
import { CalendarDays, ChartColumnBig, Bell, Home, ShieldCheck, UserRound, Info } from "lucide-react";
import type { PropsWithChildren } from "react";
import { currentUser } from "@/lib/mock-data";
import { isSuperadmin } from "@/lib/rbac";

export function AppShell({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen text-slate-900">
      <header className="mx-auto flex w-full max-w-6xl flex-col items-start gap-4 px-4 py-5 sm:px-6 sm:py-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.34em] text-amber-700 sm:text-[11px] sm:tracking-[0.38em]">Family Shared Apartment</p>
          <h1 className="font-[var(--font-display)] text-xl uppercase tracking-[0.16em] sm:text-2xl sm:tracking-[0.2em]">Majestic Family Hub</h1>
        </div>
        <nav className="no-scrollbar flex w-full snap-x gap-1 overflow-x-auto rounded-lg border border-slate-200 bg-slate-50/85 p-1.5 shadow-lg backdrop-blur md:w-auto">
          <NavItem href="/" label="Home" icon={<Home className="h-4 w-4" />} />
          <NavItem href="/reservations" label="Reservations" icon={<CalendarDays className="h-4 w-4" />} />
          <NavItem href="/stats" label="Stats" icon={<ChartColumnBig className="h-4 w-4" />} />
          <NavItem href="/info" label="Info" icon={<Info className="h-4 w-4" />} />
          <NavItem href="/account" label="Account" icon={<UserRound className="h-4 w-4" />} />
          <NavItem href="/admin" label="Admin" icon={<ShieldCheck className="h-4 w-4" />} />
          {isSuperadmin(currentUser) ? (
            <NavItem href="/settings/notifications" label="Invites" icon={<Bell className="h-4 w-4" />} />
          ) : null}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16">{children}</main>
    </div>
  );
}

function NavItem({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 snap-start items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-slate-700 transition hover:bg-amber-100 hover:text-amber-700 sm:px-4 sm:text-sm"
    >
      {icon}
      <span className="inline">{label}</span>
    </Link>
  );
}

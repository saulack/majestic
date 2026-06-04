"use client";

import Link from "next/link";
import type { PropsWithChildren } from "react";
import { CalendarDays, ChartColumnBig, Home, ShieldCheck, UserRound, Info, Wrench, Lightbulb, ListTodo } from "lucide-react";
import { RolePreviewRestore } from "@/components/role-preview-restore";
import type { AppRole } from "@/lib/types";

export function AppShell({
  children,
  initialRole,
  initialPreviewRole
}: PropsWithChildren<{ initialRole?: AppRole; initialPreviewRole?: Extract<AppRole, "admin" | "user"> | null }>) {
  const previewRole = initialPreviewRole ?? null;
  const isBaseSuperadmin = (initialRole ?? "user") === "superadmin";
  const isSuperadminPreviewing = isBaseSuperadmin && previewRole !== null;
  const showSuperadminMenu = isBaseSuperadmin && !isSuperadminPreviewing;
  const showRequestsInMainMenu = !isBaseSuperadmin || isSuperadminPreviewing;

  return (
    <div className="min-h-screen text-slate-900">
      <header className="mx-auto flex w-full max-w-6xl flex-col items-start gap-4 px-4 py-5 sm:px-6 sm:py-6 md:flex-row md:items-center md:justify-between">
        <Link href="/" className="rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2">
          <p className="text-[10px] uppercase tracking-[0.34em] text-[#4b9aa2] sm:text-[11px] sm:tracking-[0.38em]">Family Shared Apartment</p>
          <h1 className="font-[var(--font-display)] text-xl uppercase tracking-[0.16em] sm:text-2xl sm:tracking-[0.2em]">Majestic Family Hub</h1>
        </Link>
        <nav className="no-scrollbar flex w-full snap-x gap-1 overflow-x-auto rounded-lg border border-[#bde3df] bg-[#f4fbfa]/96 p-1.5 shadow-[0_12px_28px_rgba(90,154,175,0.16)] backdrop-blur md:w-auto">
          <NavItem href="/" label="Home" icon={<Home className="h-4 w-4" />} />
          <NavItem href="/reservations" label="Reservations" icon={<CalendarDays className="h-4 w-4" />} />
          <NavItem href="/maintenance" label="Maintenance" icon={<Wrench className="h-4 w-4" />} />
          <NavItem href="/info" label="Info" icon={<Info className="h-4 w-4" />} />
          <NavItem href="/stats" label="Stats" icon={<ChartColumnBig className="h-4 w-4" />} />
          {showRequestsInMainMenu ? <NavItem href="/feature-requests" label="Requests" icon={<Lightbulb className="h-4 w-4" />} /> : null}
          <NavItem href="/account" label="Account" icon={<UserRound className="h-4 w-4" />} />
        </nav>
      </header>
      <div
        className={[
          "mx-auto grid w-full max-w-6xl gap-4 px-4 pb-12 sm:px-6 sm:pb-16",
          showSuperadminMenu ? "lg:grid-cols-[minmax(0,1fr)_220px] lg:items-start" : ""
        ].join(" ")}
      >
        <main>{children}</main>

        {showSuperadminMenu ? (
          <aside className="card card-strong border-[#bde3df] p-3 lg:sticky lg:top-6">
            <p className="px-2 pb-2 pt-1 text-[11px] uppercase tracking-[0.16em] text-[#2f7b84]">Superadmin</p>
            <div className="grid gap-1.5">
              <SuperadminNavItem href="/admin" label="Admin Console" icon={<ShieldCheck className="h-4 w-4" />} />
              <SuperadminNavItem href="/feature-queue" label="Request Queue" icon={<ListTodo className="h-4 w-4" />} />
            </div>
          </aside>
        ) : null}
      </div>

      <RolePreviewRestore previewRole={previewRole} />
    </div>
  );
}

function NavItem({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex shrink-0 snap-start items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-[#3c6f78] transition hover:bg-[#dbf2ef] hover:text-[#23484f] sm:px-4 sm:text-sm"
    >
      {icon}
      <span className="inline">{label}</span>
    </Link>
  );
}

function SuperadminNavItem({ href, label, icon }: { href: string; label: string; icon: React.ReactNode }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-2 rounded-md border border-[#bde3df] bg-[#f7fcfa] px-3 py-2 text-sm font-medium text-[#2f6b74] transition hover:bg-[#e2f5f2] hover:text-[#214a52]"
    >
      {icon}
      <span>{label}</span>
    </Link>
  );
}

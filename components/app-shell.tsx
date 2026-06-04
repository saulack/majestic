"use client";

import Link from "next/link";
import type { PropsWithChildren } from "react";
import { CalendarDays, ChartColumnBig, Home, ShieldCheck, UserRound, Info, Wrench, Lightbulb, ListTodo } from "lucide-react";
import { RolePreviewRestore } from "@/components/role-preview-restore";
import { getEffectiveRole } from "@/lib/role-preview";
import type { AppRole } from "@/lib/types";

export function AppShell({
  children,
  initialRole,
  initialPreviewRole
}: PropsWithChildren<{ initialRole?: AppRole; initialPreviewRole?: Extract<AppRole, "admin" | "user"> | null }>) {
  const previewRole = initialPreviewRole ?? null;
  const effectiveRole = getEffectiveRole(initialRole ?? "user", previewRole);

  return (
    <div className="min-h-screen text-slate-900">
      <header className="mx-auto flex w-full max-w-6xl flex-col items-start gap-4 px-4 py-5 sm:px-6 sm:py-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.34em] text-[#4b9aa2] sm:text-[11px] sm:tracking-[0.38em]">Family Shared Apartment</p>
          <h1 className="font-[var(--font-display)] text-xl uppercase tracking-[0.16em] sm:text-2xl sm:tracking-[0.2em]">Majestic Family Hub</h1>
        </div>
        <nav className="no-scrollbar flex w-full snap-x gap-1 overflow-x-auto rounded-lg border border-[#bde3df] bg-[#f4fbfa]/96 p-1.5 shadow-[0_12px_28px_rgba(90,154,175,0.16)] backdrop-blur md:w-auto">
          <NavItem href="/" label="Home" icon={<Home className="h-4 w-4" />} />
          <NavItem href="/reservations" label="Reservations" icon={<CalendarDays className="h-4 w-4" />} />
          <NavItem href="/feature-requests" label="Requests" icon={<Lightbulb className="h-4 w-4" />} />
          <NavItem href="/stats" label="Stats" icon={<ChartColumnBig className="h-4 w-4" />} />
          <NavItem href="/maintenance" label="Maintenance" icon={<Wrench className="h-4 w-4" />} />
          <NavItem href="/info" label="Info" icon={<Info className="h-4 w-4" />} />
          <NavItem href="/account" label="Account" icon={<UserRound className="h-4 w-4" />} />
          {effectiveRole === "superadmin" ? <NavItem href="/feature-queue" label="Queue" icon={<ListTodo className="h-4 w-4" />} iconOnly /> : null}
          {effectiveRole === "superadmin" ? <NavItem href="/admin" label="Admin" icon={<ShieldCheck className="h-4 w-4" />} iconOnly /> : null}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16">{children}</main>
      <RolePreviewRestore previewRole={previewRole} />
    </div>
  );
}

function NavItem({ href, label, icon, iconOnly = false }: { href: string; label: string; icon: React.ReactNode; iconOnly?: boolean }) {
  return (
    <Link
      href={href}
      title={iconOnly ? label : undefined}
      aria-label={iconOnly ? label : undefined}
      className={[
        "inline-flex shrink-0 snap-start items-center gap-2 rounded-md py-2 text-xs font-medium text-[#3c6f78] transition hover:bg-[#dbf2ef] hover:text-[#23484f] sm:text-sm",
        iconOnly ? "px-2.5 sm:px-2.5" : "px-3 sm:px-4"
      ].join(" ")}
    >
      {icon}
      {iconOnly ? <span className="sr-only">{label}</span> : <span className="inline">{label}</span>}
    </Link>
  );
}

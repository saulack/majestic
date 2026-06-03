"use client";

import Link from "next/link";
import { useEffect, useState, type PropsWithChildren } from "react";
import { CalendarDays, ChartColumnBig, Bell, Home, ShieldCheck, UserRound, Info } from "lucide-react";
import { currentUser } from "@/lib/mock-data";
import { isSuperadmin } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/client";
import { readLocalAuthSnapshot } from "@/lib/local-auth";

export function AppShell({ children }: PropsWithChildren) {
  const [authReady, setAuthReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);

  useEffect(() => {
    void (async () => {
      const localAuth = readLocalAuthSnapshot();
      const supabase = createClient();

      if (!supabase) {
        setAuthenticated(localAuth.sessionActive);
        setAuthReady(true);
        return;
      }

      const { data } = await supabase.auth.getUser();
      setAuthenticated(Boolean(data.user) || localAuth.sessionActive);
      setAuthReady(true);
    })();
  }, []);

  if (!authReady || !authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#f8f0dd_0%,_#f3ead8_32%,_#e7dcc6_100%)] px-6 text-slate-900">
        <div className="text-center">
          <h1 className="font-[var(--font-display)] text-4xl uppercase tracking-[0.22em] sm:text-6xl sm:tracking-[0.28em]">
            Majestic Family Hub
          </h1>
          <Link
            href="/login"
            className="mt-8 inline-flex items-center justify-center rounded-full border border-amber-800/30 bg-[#2f231d] px-6 py-3 text-sm font-medium text-white shadow-[0_12px_28px_rgba(47,35,29,0.25)] transition hover:bg-[#413129]"
          >
            Log in
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen text-slate-900">
      <header className="mx-auto flex w-full max-w-6xl flex-col items-start gap-4 px-4 py-5 sm:px-6 sm:py-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-[0.34em] text-amber-700 sm:text-[11px] sm:tracking-[0.38em]">Family Shared Apartment</p>
          <h1 className="font-[var(--font-display)] text-xl uppercase tracking-[0.16em] sm:text-2xl sm:tracking-[0.2em]">Majestic Family Hub</h1>
        </div>
        <nav className="no-scrollbar flex w-full snap-x gap-1 overflow-x-auto rounded-lg border border-amber-700/60 bg-black/80 p-1.5 shadow-[0_10px_28px_rgb(0_0_0_/_0.55)] backdrop-blur md:w-auto">
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
      className="inline-flex shrink-0 snap-start items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-slate-100 transition hover:bg-amber-100 hover:text-black sm:px-4 sm:text-sm"
    >
      {icon}
      <span className="inline">{label}</span>
    </Link>
  );
}

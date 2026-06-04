"use client";

import Link from "next/link";
import { useEffect, useState, type PropsWithChildren } from "react";
import { CalendarDays, ChartColumnBig, Home, ShieldCheck, UserRound, Info, Wrench } from "lucide-react";
import { RolePreviewRestore } from "@/components/role-preview-restore";
import { getEffectiveRole, readRolePreviewFromBrowser } from "@/lib/role-preview";
import { createClient } from "@/lib/supabase/client";
import { readLocalAuthSnapshot } from "@/lib/local-auth";
import type { AppRole } from "@/lib/types";

export function AppShell({ children }: PropsWithChildren) {
  const [authReady, setAuthReady] = useState(false);
  const [authenticated, setAuthenticated] = useState(false);
  const [previewRole, setPreviewRole] = useState<Extract<AppRole, "admin" | "user"> | null>(null);
  const [baseRole, setBaseRole] = useState<AppRole>("user");

  const effectiveRole = getEffectiveRole(baseRole, previewRole);

  useEffect(() => {
    void (async () => {
      const localAuth = readLocalAuthSnapshot();
      const supabase = createClient();
      setPreviewRole(readRolePreviewFromBrowser());

      if (!supabase) {
        setAuthenticated(localAuth.sessionActive);
        setAuthReady(true);
        return;
      }

      const { data } = await supabase.auth.getUser();
      setAuthenticated(Boolean(data.user) || localAuth.sessionActive);

      if (data.user) {
        const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle();
        if (profile?.role) {
          setBaseRole(profile.role as AppRole);
        }
      }

      setAuthReady(true);
    })();
  }, []);

  if (!authReady || !authenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#ffe1bf_0%,_#dff8ee_34%,_#eefbfd_100%)] px-6 text-slate-900">
        <div className="text-center">
          <h1 className="font-[var(--font-display)] text-4xl uppercase tracking-[0.22em] sm:text-6xl sm:tracking-[0.28em]">
            Majestic Family Hub
          </h1>
          <Link
            href="/login"
            className="mt-8 inline-flex items-center justify-center rounded-full border border-[#6ba3b0]/35 bg-[#70b9cd] px-6 py-3 text-sm font-medium text-white shadow-[0_12px_28px_rgba(92,166,186,0.24)] transition hover:bg-[#59a7bc]"
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
          <p className="text-[10px] uppercase tracking-[0.34em] text-[#4b9aa2] sm:text-[11px] sm:tracking-[0.38em]">Family Shared Apartment</p>
          <h1 className="font-[var(--font-display)] text-xl uppercase tracking-[0.16em] sm:text-2xl sm:tracking-[0.2em]">Majestic Family Hub</h1>
        </div>
        <nav className="no-scrollbar flex w-full snap-x gap-1 overflow-x-auto rounded-lg border border-[#bde3df] bg-[#f4fbfa]/96 p-1.5 shadow-[0_12px_28px_rgba(90,154,175,0.16)] backdrop-blur md:w-auto">
          <NavItem href="/" label="Home" icon={<Home className="h-4 w-4" />} />
          <NavItem href="/reservations" label="Reservations" icon={<CalendarDays className="h-4 w-4" />} />
          <NavItem href="/stats" label="Stats" icon={<ChartColumnBig className="h-4 w-4" />} />
          <NavItem href="/maintenance" label="Maintenance" icon={<Wrench className="h-4 w-4" />} />
          <NavItem href="/info" label="Info" icon={<Info className="h-4 w-4" />} />
          <NavItem href="/account" label="Account" icon={<UserRound className="h-4 w-4" />} />
          {effectiveRole === "superadmin" ? <NavItem href="/admin" label="Admin" icon={<ShieldCheck className="h-4 w-4" />} /> : null}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16">{children}</main>
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

import Link from "next/link";
import { compareAsc, format, parseISO } from "date-fns";
import { AppShell } from "@/components/app-shell";
import { HomeMaintenanceStatus } from "@/components/home-maintenance-status";
import { UpcomingReservationsList } from "@/components/upcoming-reservations-list";
import { getAllReservations, getAuthenticatedUserProfile, getMaintenanceSummaries } from "@/lib/live-data";
import { getNumberAppSetting } from "@/lib/app-settings";
import { getReservationApprovalsEnabled, HOMEPAGE_RESERVATIONS_COUNT_KEY } from "@/lib/feature-flags";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getEffectiveUser, getRolePreviewFromCookieValue } from "@/lib/role-preview";
import { isAdminLike } from "@/lib/rbac";
import type { AppRole, Reservation } from "@/lib/types";

const DEFAULT_HOME_RESERVATION_COUNT = 5;

export default async function HomePage() {
  const cookieStore = await cookies();
  const previewRole = getRolePreviewFromCookieValue(cookieStore.get("majestic-role-preview")?.value ?? null);
  const profile = await getAuthenticatedUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const actingUser = getEffectiveUser(profile, previewRole);
  const adminLike = isAdminLike(actingUser);
  const upcomingReservationCount = await getNumberAppSetting(HOMEPAGE_RESERVATIONS_COUNT_KEY, DEFAULT_HOME_RESERVATION_COUNT);
  const approvalsEnabled = await getReservationApprovalsEnabled();
  const [reservations, maintenanceSummaries] = await Promise.all([getAllReservations(), getMaintenanceSummaries()]);
  const normalizedReservations: Reservation[] = approvalsEnabled
    ? reservations
    : reservations.map((reservation) =>
        reservation.status === "pending"
          ? {
              ...reservation,
              status: "approved" as const
            }
          : reservation
      );

  const upcomingReservations = [...normalizedReservations]
    .filter((reservation) => compareAsc(parseISO(reservation.startDate), new Date()) >= 0)
    .sort((left, right) => compareAsc(parseISO(left.startDate), parseISO(right.startDate)));
  const myReservations = normalizedReservations.filter((reservation) => reservation.userId === actingUser.id);
  const upcomingMyReservations = myReservations.filter((reservation) => compareAsc(parseISO(reservation.startDate), new Date()) >= 0);
  const myNextStay = myReservations
    .filter((reservation) => compareAsc(parseISO(reservation.startDate), new Date()) >= 0)
    .sort((left, right) => compareAsc(parseISO(left.startDate), parseISO(right.startDate)))[0];
  const requestMetricLabel = approvalsEnabled ? "Pending requests" : "Reserved";
  const requestMetricValue = approvalsEnabled
    ? normalizedReservations.filter((reservation) => reservation.status === "pending").length
    : normalizedReservations.filter((reservation) => reservation.status === "approved").length;
  const currentRoleMetricValue: AppRole = profile.role === "superadmin" ? profile.role : actingUser.role;

  return (
    <AppShell initialRole={actingUser.role} initialPreviewRole={previewRole}>
      <section className="grid gap-5 sm:gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 bg-gradient-to-r from-[#5fb8c9] via-[#72c9b2] to-[#f6d28d] p-6 text-white sm:p-8">
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#edfdf9] sm:text-xs sm:tracking-[0.32em]">Family Dashboard</p>
            <h2 className="mt-2 text-3xl font-semibold leading-tight sm:text-4xl">{actingUser.fullName}</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#effcf8]">
              {adminLike
                ? "Previewing a higher-level view of the apartment hub with moderation context and shared activity visibility."
                : "Keep family stays coordinated, track reservations, and share apartment updates in one private place."}
            </p>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-3 sm:gap-4 sm:p-6">
            <Metric label={adminLike ? "Visible reservations" : "My reservations"} value={String(adminLike ? reservations.length : myReservations.length)} />
            <Metric label={adminLike ? requestMetricLabel : "Your next stay"} value={adminLike ? String(requestMetricValue) : myNextStay?.startDate ?? "-"} />
            <Metric label={adminLike ? "Current role" : "Upcoming reservations"} value={adminLike ? currentRoleMetricValue : String(upcomingMyReservations.length)} />
          </div>
        </div>

        <div className="card card-strong p-5 sm:p-6">
          <h3 className="text-lg sm:text-xl">Quick Actions</h3>
          <div className="mt-4 grid gap-3">
            <Action href="/reservations" title="Create reservation" subtitle="Plan your next family stay" />
            <Action href="/manage-reservations" title="Manage reservations" subtitle="Edit or cancel your reservations" />
            <Action href="/stats" title="View personal stats" subtitle="Track your own stays and nights" />
          </div>
        </div>
      </section>

      <section className="card mt-5 p-5 sm:mt-6 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[#2f7b84]">Maintenance status</p>
            <h3 className="mt-2 text-xl sm:text-2xl">Maintenance Snapshot</h3>
          </div>
          <Link href="/maintenance" className="text-sm font-medium text-amber-700 hover:text-amber-800">
            Open maintenance
          </Link>
        </div>

        <HomeMaintenanceStatus summaries={maintenanceSummaries} />
      </section>

      <section className="card mt-5 p-5 sm:mt-6 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-amber-700">Upcoming reservations</p>
            <h3 className="mt-2 text-xl sm:text-2xl">next {upcomingReservationCount} reservations</h3>
          </div>
          <p className="text-sm text-slate-500">Showing the next reservations configured by admin.</p>
        </div>

        <UpcomingReservationsList reservations={upcomingReservations} initialVisibleCount={upcomingReservationCount} />
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

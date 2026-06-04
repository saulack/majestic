import Link from "next/link";
import { compareAsc, format, parseISO } from "date-fns";
import { AppShell } from "@/components/app-shell";
import { getAllReservations, getAuthenticatedUserProfile, getMaintenanceSummaries } from "@/lib/live-data";
import { getNumberAppSetting } from "@/lib/app-settings";
import { getReservationApprovalsEnabled, HOMEPAGE_RESERVATIONS_COUNT_KEY } from "@/lib/feature-flags";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getEffectiveUser, getRolePreviewFromCookieValue } from "@/lib/role-preview";
import { isAdminLike } from "@/lib/rbac";
import type { Reservation } from "@/lib/types";

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
    .sort((left, right) => compareAsc(parseISO(left.startDate), parseISO(right.startDate)))
    .slice(0, upcomingReservationCount);
  const myReservations = normalizedReservations.filter((reservation) => reservation.userId === actingUser.id);
  const myNextStay = myReservations
    .filter((reservation) => compareAsc(parseISO(reservation.startDate), new Date()) >= 0)
    .sort((left, right) => compareAsc(parseISO(left.startDate), parseISO(right.startDate)))[0];
  const requestMetricLabel = approvalsEnabled ? "Pending requests" : "Reserved";
  const requestMetricValue = approvalsEnabled
    ? normalizedReservations.filter((reservation) => reservation.status === "pending").length
    : normalizedReservations.filter((reservation) => reservation.status === "approved").length;

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
            <Metric label={adminLike ? "Current role" : "Notification channels"} value={adminLike ? actingUser.role : "Email, SMS, WhatsApp"} />
          </div>
        </div>

        <div className="card card-strong p-5 sm:p-6">
          <h3 className="text-lg sm:text-xl">Quick Actions</h3>
          <div className="mt-4 grid gap-3">
            <Action href="/reservations" title="Create reservation" subtitle="Plan your next family stay" />
            <Action href="/reservations" title={adminLike ? "Manage requests" : "View reservations"} subtitle={adminLike ? "Review approvals, denials, and notes" : "See your stays and booking calendar"} />
            <Action href="/stats" title="View personal stats" subtitle="Track your own stays and nights" />
          </div>
        </div>
      </section>

      <section className="card mt-5 p-5 sm:mt-6 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[#2f7b84]">Maintenance status</p>
            <h3 className="mt-2 text-xl sm:text-2xl">Days Since Last Maintenance</h3>
          </div>
          <Link href="/maintenance" className="text-sm font-medium text-amber-700 hover:text-amber-800">
            Open maintenance
          </Link>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {maintenanceSummaries.map((summary) => {
            const isOverdue =
              summary.daysSinceLastMaintenance !== null && summary.daysSinceLastMaintenance >= summary.thresholdDays;

            return (
              <article key={summary.typeId} className={`rounded-xl border px-4 py-3.5 ${summary.needsAttention ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-slate-900">{summary.typeName}</h4>
                    <p className="mt-1 text-sm text-slate-600">
                      {summary.daysSinceLastMaintenance === null ? "No maintenance logged yet" : `${summary.daysSinceLastMaintenance} days since last maintenance`}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {isOverdue ? (
                      <span className="rounded-full border border-rose-300 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-700">Overdue</span>
                    ) : null}
                    <span className={`rounded-full px-3 py-1 text-xs font-medium ${summary.needsAttention ? "border border-amber-300 bg-white text-amber-800" : "border border-[#bde3df] bg-[#f1fbf9] text-[#2f7b84]"}`}>
                      Threshold {summary.thresholdDays}d
                    </span>
                  </div>
                </div>
                <p className="mt-2 text-sm text-slate-500">{summary.lastMaintenanceDate ? `Last logged: ${summary.lastMaintenanceDate}` : "Schedule the first maintenance entry."}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="card mt-5 p-5 sm:mt-6 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-amber-700">Upcoming reservations</p>
            <h3 className="mt-2 text-xl sm:text-2xl">next {upcomingReservationCount} reservations</h3>
          </div>
          <p className="text-sm text-slate-500">Showing the next reservations configured by admin.</p>
        </div>

        <div className="mt-5 grid gap-3">
          {upcomingReservations.length > 0 ? (
            upcomingReservations.map((reservation) => (
              <article key={reservation.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 sm:px-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h4 className="text-base font-semibold text-slate-900">{reservation.userName}</h4>
                    <p className="mt-1 text-sm text-slate-600">
                      {format(parseISO(reservation.startDate), "MMM d, yyyy")} to {format(parseISO(reservation.endDate), "MMM d, yyyy")}
                    </p>
                  </div>
                  <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                    {reservation.status}
                  </span>
                </div>
                {reservation.notes ? <p className="mt-2 text-sm text-slate-500">{reservation.notes}</p> : null}
              </article>
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
              No upcoming reservations found.
            </div>
          )}
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

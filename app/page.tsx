import Link from "next/link";
import { compareAsc, parseISO } from "date-fns";
import { AppShell } from "@/components/app-shell";
import { HomeMaintenanceStatus } from "@/components/home-maintenance-status";
import { UpcomingReservationsList } from "@/components/upcoming-reservations-list";
import { getAllReservations, getAuthenticatedUserProfile, getInAppNotificationsForUser, getMaintenanceSummaries, getNotificationPreference } from "@/lib/live-data";
import { getNumberAppSetting } from "@/lib/app-settings";
import { getReservationApprovalsEnabled, HOMEPAGE_RESERVATIONS_COUNT_KEY } from "@/lib/feature-flags";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getEffectiveUser, getRolePreviewFromCookieValue } from "@/lib/role-preview";
import { isAdminLike } from "@/lib/rbac";
import { maybeSendInAppInboxDigestEmail } from "@/lib/notifications";
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
  const [reservations, maintenanceSummaries, notifications, notificationPreference] = await Promise.all([
    getAllReservations(),
    getMaintenanceSummaries(),
    getInAppNotificationsForUser(actingUser.id),
    getNotificationPreference(actingUser.id)
  ]);
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
  const myNextStay = myReservations
    .filter((reservation) => compareAsc(parseISO(reservation.startDate), new Date()) >= 0)
    .sort((left, right) => compareAsc(parseISO(left.startDate), parseISO(right.startDate)))[0];
  const notificationCount = notifications.filter((notification) => !notification.isRead).length;

  await maybeSendInAppInboxDigestEmail({
    userId: actingUser.id,
    email: actingUser.email,
    fullName: actingUser.fullName,
    unreadCount: notificationCount,
    enabled: notificationPreference?.inAppInboxDigestEmail ?? false,
    lastSentAt: notificationPreference?.inAppInboxDigestLastSentAt
  });

  return (
    <AppShell initialRole={actingUser.role} initialPreviewRole={previewRole}>
      <section className="grid gap-5 sm:gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="card overflow-hidden">
          <div className="border-b border-slate-200 bg-gradient-to-r from-[#5fb8c9] via-[#72c9b2] to-[#f6d28d] p-5 text-white sm:p-8">
            <p className="text-[11px] uppercase tracking-[0.3em] text-[#edfdf9] sm:text-xs sm:tracking-[0.32em]">Family Dashboard</p>
            <h2 className="mt-2 text-2xl font-semibold leading-tight sm:text-4xl">{actingUser.fullName}</h2>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-[#effcf8]">
              {adminLike
                ? "Previewing a higher-level view of the apartment hub with moderation context and shared activity visibility."
                : "Keep family stays coordinated, track reservations, and share apartment updates in one private place."}
            </p>
          </div>
          <div className="grid gap-3 p-5 sm:grid-cols-3 sm:gap-4 sm:p-6">
            <Metric label="My reservations" value={String(myReservations.length)} />
            <Metric label="Your next stay" value={myNextStay?.startDate ?? "-"} />
            <Metric label="Notifications" value={String(notificationCount)} href="/notifications" />
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
          <Link href="/maintenance" className="inline-flex min-h-11 items-center rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-100">
            Open maintenance
          </Link>
        </div>

        <HomeMaintenanceStatus summaries={maintenanceSummaries} />
      </section>

      <section className="card mt-5 p-5 sm:mt-6 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-amber-700">Upcoming reservations</p>
            <h3 className="mt-2 text-xl sm:text-2xl">Next {upcomingReservationCount} reservations</h3>
          </div>
          <p className="text-sm text-slate-500">Showing the next reservations configured by admin.</p>
        </div>

        <UpcomingReservationsList reservations={upcomingReservations} initialVisibleCount={upcomingReservationCount} />
      </section>
    </AppShell>
  );
}

function Metric({ label, value, href }: { label: string; value: string; href?: string }) {
  const content = (
    <div className="flex h-full flex-col justify-between gap-3">
      <p className="min-h-[2.5rem] text-[11px] uppercase tracking-[0.14em] text-slate-500 sm:min-h-[2.75rem] sm:text-xs sm:tracking-[0.16em]">
        {label}
      </p>
      <p className="text-lg font-semibold leading-tight text-slate-900 sm:text-xl">{value}</p>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="flex min-h-11 h-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 transition hover:border-amber-700 hover:bg-amber-50/40 sm:p-4">
        {content}
      </Link>
    );
  }

  return (
    <div className="flex h-full rounded-xl border border-slate-200 bg-slate-50 p-3.5 sm:p-4">
      {content}
    </div>
  );
}

function Action({ href, title, subtitle }: { href: string; title: string; subtitle: string }) {
  return (
    <Link href={href} className="block min-h-11 rounded-xl border border-slate-200 bg-slate-50 p-3.5 transition hover:border-amber-700 hover:bg-amber-50/40 sm:p-4">
      <p className="text-sm font-semibold text-slate-900 sm:text-base">{title}</p>
      <p className="mt-1 text-sm leading-relaxed text-slate-600">{subtitle}</p>
    </Link>
  );
}

import { AppShell } from "@/components/app-shell";
import { MonthlyReservationsCalendar } from "@/components/monthly-reservations-calendar";
import { buildHolidayMap } from "@/lib/holidays";
import { getReservationApprovalsEnabled } from "@/lib/feature-flags";
import Link from "next/link";
import {
  getAllProfiles,
  getAllReservations,
  getAuthenticatedUserProfile,
  getMaintenanceNotifications,
  getMaintenanceRecords
} from "@/lib/live-data";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getEffectiveUser, getRolePreviewFromCookieValue } from "@/lib/role-preview";

export default async function ReservationsPage() {
  const cookieStore = await cookies();
  const previewRole = getRolePreviewFromCookieValue(cookieStore.get("majestic-role-preview")?.value ?? null);
  const profile = await getAuthenticatedUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const actingUser = getEffectiveUser(profile, previewRole);
  const year = new Date().getFullYear();
  const [reservations, holidayMap, approvalsEnabled, users, maintenanceRecords, maintenanceNotifications] = await Promise.all([
    getAllReservations(),
    Promise.resolve(buildHolidayMap([year - 1, year, year + 1])),
    getReservationApprovalsEnabled(),
    getAllProfiles(),
    getMaintenanceRecords(),
    getMaintenanceNotifications()
  ]);

  const normalizedReservations = approvalsEnabled
    ? reservations
    : reservations.map((reservation) =>
        reservation.status === "pending"
          ? {
              ...reservation,
              status: "approved" as const
            }
          : reservation
      );
  const hasMyReservations = normalizedReservations.some((reservation) => reservation.userId === actingUser.id);

  return (
    <AppShell initialRole={actingUser.role} initialPreviewRole={previewRole}>
      {hasMyReservations ? (
        <section className="card mb-4 flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
          <div>
            <h2 className="text-base font-semibold text-slate-900 sm:text-lg">Already booked dates?</h2>
            <p className="text-sm text-slate-600">Open Manage Reservations to edit or cancel your existing reservations.</p>
          </div>
          <Link
            href="/manage-reservations"
            className="inline-flex items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Go to Manage Reservations
          </Link>
        </section>
      ) : null}
      <div className="max-w-full overflow-x-hidden">
        <MonthlyReservationsCalendar
          reservations={normalizedReservations}
          maintenanceRecords={maintenanceRecords}
          maintenanceNotifications={maintenanceNotifications}
          holidayMap={holidayMap}
          users={users}
          actingUser={actingUser}
          approvalsEnabled={approvalsEnabled}
        />
      </div>
    </AppShell>
  );
}

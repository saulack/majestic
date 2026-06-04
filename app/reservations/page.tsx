import { AppShell } from "@/components/app-shell";
import { MonthlyReservationsCalendar } from "@/components/monthly-reservations-calendar";
import { buildHolidayMap } from "@/lib/holidays";
import { getReservationApprovalsEnabled } from "@/lib/feature-flags";
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

  return (
    <AppShell>
      <MonthlyReservationsCalendar
        reservations={normalizedReservations}
        maintenanceRecords={maintenanceRecords}
        maintenanceNotifications={maintenanceNotifications}
        holidayMap={holidayMap}
        users={users}
        actingUser={actingUser}
        approvalsEnabled={approvalsEnabled}
      />
    </AppShell>
  );
}

import { AppShell } from "@/components/app-shell";
import { MonthlyReservationsCalendar } from "@/components/monthly-reservations-calendar";
import { mockReservations, mockUsers } from "@/lib/mock-data";
import { buildHolidayMap } from "@/lib/holidays";
import { getReservationApprovalsEnabled } from "@/lib/feature-flags";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Reservation, ReservationStatus } from "@/lib/types";

async function fetchReservations(): Promise<Reservation[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return mockReservations;

  const { data, error } = await supabase
    .from("reservations")
    .select(`
      id,
      user_id,
      start_date,
      end_date,
      notes,
      status,
      decline_reason,
      reviewed_by,
      reviewed_at,
      created_at,
      owner:profiles!reservations_user_id_fkey(full_name),
      reviewer:profiles!reservations_reviewed_by_fkey(full_name)
    `)
    .order("created_at", { ascending: false });

  if (error || !data) return mockReservations;

  return data.map((row) => ({
    id: row.id as string,
    userId: row.user_id as string,
    userName: ((row.owner as unknown as { full_name: string } | null)?.full_name) ?? "Unknown",
    startDate: row.start_date as string,
    endDate: row.end_date as string,
    notes: (row.notes as string | null) ?? undefined,
    status: row.status as ReservationStatus,
    declineReason: (row.decline_reason as string | null) ?? undefined,
    reviewedByUserId: (row.reviewed_by as string | null) ?? undefined,
    reviewedByName: ((row.reviewer as unknown as { full_name: string } | null)?.full_name) ?? undefined,
    reviewedAt: (row.reviewed_at as string | null) ?? undefined,
    createdAt: row.created_at as string
  }));
}

export default async function ReservationsPage() {
  const year = new Date().getFullYear();
  const [reservations, holidayMap, approvalsEnabled] = await Promise.all([
    fetchReservations(),
    Promise.resolve(buildHolidayMap([year - 1, year, year + 1])),
    getReservationApprovalsEnabled()
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
        holidayMap={holidayMap}
        users={mockUsers}
        approvalsEnabled={approvalsEnabled}
      />
    </AppShell>
  );
}

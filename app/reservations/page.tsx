import { AppShell } from "@/components/app-shell";
import { MonthlyReservationsCalendar } from "@/components/monthly-reservations-calendar";
import { currentUser, mockReservations, mockUsers } from "@/lib/mock-data";
import { buildHolidayMap } from "@/lib/holidays";
import { getReservationApprovalsEnabled } from "@/lib/feature-flags";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Reservation, ReservationStatus, UserProfile } from "@/lib/types";
import { cookies } from "next/headers";
import { getEffectiveUser, getRolePreviewFromCookieValue } from "@/lib/role-preview";

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
      created_by,
      reviewed_by,
      reviewed_at,
      created_at,
      owner:profiles!reservations_user_id_fkey(full_name),
      creator:profiles!reservations_created_by_fkey(full_name),
      reviewer:profiles!reservations_reviewed_by_fkey(full_name)
    `)
    .order("created_at", { ascending: false });

  if (error || !data) return mockReservations;

  return data.map((row) => ({
    id: row.id as string,
    userId: row.user_id as string,
    userName: ((row.owner as unknown as { full_name: string } | null)?.full_name) ?? "Unknown",
    createdByUserId: (row.created_by as string | null) ?? undefined,
    createdByName: ((row.creator as unknown as { full_name: string } | null)?.full_name) ?? undefined,
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

async function fetchUsers(): Promise<UserProfile[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return mockUsers;

  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,email,role,force_password_reset")
    .order("full_name", { ascending: true });

  if (error || !data) return mockUsers;

  return data.map((entry) => ({
    id: entry.id,
    fullName: entry.full_name,
    email: entry.email,
    role: entry.role,
    forcePasswordReset: entry.force_password_reset
  }));
}

export default async function ReservationsPage() {
  const cookieStore = await cookies();
  const previewRole = getRolePreviewFromCookieValue(cookieStore.get("majestic-role-preview")?.value ?? null);
  const actingUser: UserProfile = getEffectiveUser(currentUser, previewRole);
  const year = new Date().getFullYear();
  const [reservations, holidayMap, approvalsEnabled, users] = await Promise.all([
    fetchReservations(),
    Promise.resolve(buildHolidayMap([year - 1, year, year + 1])),
    getReservationApprovalsEnabled(),
    fetchUsers()
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
        users={users}
        actingUser={actingUser}
        approvalsEnabled={approvalsEnabled}
      />
    </AppShell>
  );
}

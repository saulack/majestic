import { buildMaintenanceSummaries } from "@/lib/maintenance";
import type {
  MaintenanceNotification,
  MaintenanceRecord,
  MaintenanceSummary,
  MaintenanceType,
  NotificationPreference,
  Reservation,
  ReservationStatus,
  UserProfile
} from "@/lib/types";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function getAuthenticatedUserProfile(): Promise<UserProfile | null> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return null;
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return null;
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id,full_name,email,role,force_password_reset")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || !profile) {
    return null;
  }

  return {
    id: profile.id,
    fullName: profile.full_name,
    email: profile.email,
    role: profile.role,
    forcePasswordReset: profile.force_password_reset
  };
}

export async function getNotificationPreference(userId: string): Promise<NotificationPreference | undefined> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return undefined;
  }

  const { data, error } = await supabase
    .from("notification_preferences")
    .select("email_enabled,sms_enabled")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !data) {
    return undefined;
  }

  const channels: Array<"email" | "sms"> = [];

  if (data.email_enabled) {
    channels.push("email");
  }

  if (data.sms_enabled) {
    channels.push("sms");
  }

  return {
    userId,
    channels
  };
}

export async function getAllReservations(): Promise<Reservation[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return [];
  }

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

  if (error || !data) {
    return [];
  }

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

export async function getAllProfiles(): Promise<UserProfile[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id,full_name,email,role,force_password_reset")
    .order("full_name", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((entry) => ({
    id: entry.id,
    fullName: entry.full_name,
    email: entry.email,
    role: entry.role,
    forcePasswordReset: entry.force_password_reset
  }));
}

export async function getMaintenanceTypes(): Promise<MaintenanceType[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("maintenance_types")
    .select("id,name,threshold_days,created_by,created_at")
    .order("name", { ascending: true });

  if (error || !data) {
    return [];
  }

  return data.map((entry) => ({
    id: entry.id,
    name: entry.name,
    thresholdDays: entry.threshold_days,
    createdByUserId: (entry.created_by as string | null) ?? undefined,
    createdAt: entry.created_at
  }));
}

export async function getMaintenanceRecords(): Promise<MaintenanceRecord[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("maintenance_records")
    .select(`
      id,
      scheduled_for,
      created_by,
      created_at,
      maintenance_type:maintenance_types!maintenance_records_maintenance_type_id_fkey(id,name),
      creator:profiles!maintenance_records_created_by_fkey(full_name)
    `)
    .order("scheduled_for", { ascending: false })
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((entry) => ({
    id: entry.id,
    typeId: (entry.maintenance_type as unknown as { id: string; name: string } | null)?.id ?? "",
    typeName: (entry.maintenance_type as unknown as { id: string; name: string } | null)?.name ?? "Unknown",
    scheduledFor: entry.scheduled_for,
    createdByUserId: entry.created_by,
    createdByName: ((entry.creator as unknown as { full_name: string } | null)?.full_name) ?? "Unknown",
    createdAt: entry.created_at
  }));
}

export async function getMaintenanceNotifications(): Promise<MaintenanceNotification[]> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from("maintenance_notifications")
    .select(`
      id,
      reservation_id,
      notified_user_id,
      reservation_start_date,
      reservation_end_date,
      triggered_on,
      created_at,
      maintenance_type:maintenance_types!maintenance_notifications_maintenance_type_id_fkey(id,name),
      notified_user:profiles!maintenance_notifications_notified_user_id_fkey(full_name)
    `)
    .order("created_at", { ascending: false });

  if (error || !data) {
    return [];
  }

  return data.map((entry) => ({
    id: entry.id,
    typeId: (entry.maintenance_type as unknown as { id: string; name: string } | null)?.id ?? "",
    typeName: (entry.maintenance_type as unknown as { id: string; name: string } | null)?.name ?? "Unknown",
    notifiedUserId: entry.notified_user_id,
    notifiedUserName: ((entry.notified_user as unknown as { full_name: string } | null)?.full_name) ?? "Unknown",
    reservationId: (entry.reservation_id as string | null) ?? undefined,
    reservationStartDate: entry.reservation_start_date,
    reservationEndDate: entry.reservation_end_date,
    triggeredOn: entry.triggered_on,
    createdAt: entry.created_at
  }));
}

export async function getMaintenanceSummaries(): Promise<MaintenanceSummary[]> {
  const [maintenanceTypes, maintenanceRecords] = await Promise.all([getMaintenanceTypes(), getMaintenanceRecords()]);
  return buildMaintenanceSummaries(maintenanceTypes, maintenanceRecords);
}

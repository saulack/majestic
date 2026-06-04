"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMaintenanceAlert, getDueMaintenanceTypes } from "@/lib/maintenance";
import type { MaintenanceType } from "@/lib/types";

export type ActionResult = { error?: string; success?: boolean; maintenanceAlerts?: string[] };

export async function createReservation(params: {
  startDate: string;
  endDate: string;
  notes: string;
  approvalEnabled: boolean;
  bookedForUserId: string;
  allowDoubleBooking?: boolean;
}): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { error: "Supabase is not configured on the server." };
  }

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "You must be signed in to make a reservation." };
  }

  const { startDate, endDate, notes, approvalEnabled, bookedForUserId, allowDoubleBooking = false } = params;

  const { data: actingProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  const canBookForOthers = actingProfile?.role === "admin" || actingProfile?.role === "superadmin";

  if (bookedForUserId !== user.id && !canBookForOthers) {
    return { error: "You can only create reservations for your own account." };
  }

  if (!startDate || !endDate) {
    return { error: "Start and end dates are required." };
  }

  if (!bookedForUserId) {
    return { error: "Please choose who this reservation is for." };
  }

  if (endDate < startDate) {
    return { error: "End date must be on or after start date." };
  }

  if (!allowDoubleBooking) {
    // Check for overlapping approved or pending reservations unless explicitly allowed.
    const { data: conflicts } = await supabase
      .from("reservations")
      .select("id")
      .lte("start_date", endDate)
      .gte("end_date", startDate)
      .in("status", ["pending", "approved"]);

    if (conflicts && conflicts.length > 0) {
      return { error: "This date range conflicts with an existing reservation." };
    }
  }

  const { data: insertedReservation, error: insertError } = await supabase
    .from("reservations")
    .insert({
      user_id: bookedForUserId,
      created_by: user.id,
      start_date: startDate,
      end_date: endDate,
      notes: notes.trim() || null,
      status: approvalEnabled ? "pending" : "approved"
    })
    .select("id,user_id,start_date,end_date")
    .single();

  if (insertError || !insertedReservation) {
    if (insertError?.code === "42501" || /permission denied/i.test(insertError?.message ?? "")) {
      return { error: "You do not have permission for that reservation action." };
    }

    return { error: insertError.message };
  }

  const [maintenanceTypesResult, maintenanceRecordsResult] = await Promise.all([
    supabase.from("maintenance_types").select("id,name,threshold_days,created_by,created_at").order("name", { ascending: true }),
    supabase
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
  ]);

  const maintenanceTypes: MaintenanceType[] = !maintenanceTypesResult.error && maintenanceTypesResult.data
    ? maintenanceTypesResult.data.map((entry) => ({
        id: entry.id,
        name: entry.name,
        thresholdDays: entry.threshold_days,
        createdByUserId: (entry.created_by as string | null) ?? undefined,
        createdAt: entry.created_at
      }))
    : [];

  const maintenanceRecords = !maintenanceRecordsResult.error && maintenanceRecordsResult.data
    ? maintenanceRecordsResult.data.map((entry) => ({
        id: entry.id,
        typeId: (entry.maintenance_type as unknown as { id: string; name: string } | null)?.id ?? "",
        typeName: (entry.maintenance_type as unknown as { id: string; name: string } | null)?.name ?? "Unknown",
        scheduledFor: entry.scheduled_for,
        createdByUserId: entry.created_by,
        createdByName: ((entry.creator as unknown as { full_name: string } | null)?.full_name) ?? "Unknown",
        createdAt: entry.created_at
      }))
    : [];

  const dueMaintenanceTypes = getDueMaintenanceTypes(maintenanceTypes, maintenanceRecords, endDate);

  if (dueMaintenanceTypes.length > 0) {
    const admin = createAdminClient();

    if (admin) {
      await admin.from("maintenance_notifications").insert(
        dueMaintenanceTypes.map((maintenanceType) => ({
          maintenance_type_id: maintenanceType.id,
          reservation_id: insertedReservation.id,
          notified_user_id: insertedReservation.user_id,
          reservation_start_date: insertedReservation.start_date,
          reservation_end_date: insertedReservation.end_date,
          triggered_on: insertedReservation.end_date
        }))
      );
    }
  }

  revalidatePath("/reservations");
  revalidatePath("/");
  return { success: true, maintenanceAlerts: dueMaintenanceTypes.map(formatMaintenanceAlert) };
}

export async function moderateReservation(
  reservationId: string,
  newStatus: "approved" | "declined",
  declineReason?: string
): Promise<ActionResult> {
  if (newStatus === "declined" && !declineReason?.trim()) {
    return { error: "A reason is required when declining a reservation." };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { error: "Supabase is not configured on the server." };
  }

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "You must be signed in." };
  }

  // Get the acting user's role
  const { data: actingProfile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!actingProfile || (actingProfile.role !== "admin" && actingProfile.role !== "superadmin")) {
    return { error: "Only admins can moderate reservations." };
  }

  // Fetch the reservation and its owner's profile
  const { data: reservation } = await supabase
    .from("reservations")
    .select("id, user_id, profiles!reservations_user_id_fkey(role)")
    .eq("id", reservationId)
    .single();

  if (!reservation) {
    return { error: "Reservation not found." };
  }

  if (reservation.user_id === user.id) {
    return { error: "You cannot moderate your own reservation." };
  }

  const { error: updateError } = await supabase
    .from("reservations")
    .update({
      status: newStatus,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      ...(newStatus === "declined" ? { decline_reason: declineReason } : { decline_reason: null })
    })
    .eq("id", reservationId);

  if (updateError) {
    return { error: updateError.message };
  }

  revalidatePath("/reservations");
  return { success: true };
}

export async function deleteReservation(reservationId: string): Promise<ActionResult> {
  const targetId = reservationId.trim();

  if (!targetId) {
    return { error: "Reservation id is required." };
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return { error: "Supabase is not configured on the server." };
  }

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "You must be signed in." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "superadmin") {
    return { error: "Only superadmin can delete reservations." };
  }

  const admin = createAdminClient();
  if (!admin) {
    return { error: "Supabase is not configured on the server." };
  }

  const { error: deleteError } = await admin.from("reservations").delete().eq("id", targetId);

  if (deleteError) {
    return { error: deleteError.message };
  }

  revalidatePath("/reservations");
  revalidatePath("/");
  revalidatePath("/stats");
  return { success: true };
}

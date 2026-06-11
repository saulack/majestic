"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatMaintenanceAlert, getDueMaintenanceTypes, type MaintenanceContactInfo } from "@/lib/maintenance";
import { getMaintenanceRecords, getMaintenanceTypes } from "@/lib/live-data";
import { sendReservationConfirmationEmail } from "@/lib/notifications";
import { hasDateConflict } from "@/lib/reservation-utils";

export type ActionResult = { error?: string; success?: boolean; maintenanceAlerts?: string[] };

export async function createReservation(params: {
  startDate: string;
  endDate: string;
  notes: string;
  approvalEnabled: boolean;
  bookedForUserId: string;
  allowDoubleBooking?: boolean;
  sharedWithUserIds?: string[];
  sharedRangeStartDate?: string;
  sharedRangeEndDate?: string;
}): Promise<ActionResult> {
  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();
  if (!supabase) {
    return { error: "Supabase is not configured on the server." };
  }

  if (!admin) {
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
  const sharedWithUserIds = allowDoubleBooking ? [...new Set((params.sharedWithUserIds ?? []).map((entry) => entry.trim()).filter(Boolean))] : [];
  const sharedRangeStartDate = allowDoubleBooking ? (params.sharedRangeStartDate?.trim() ?? "") : "";
  const sharedRangeEndDate = allowDoubleBooking ? (params.sharedRangeEndDate?.trim() ?? "") : "";

  const { data: actingProfile } = await admin
    .from("profiles")
    .select("role,full_name")
    .eq("id", user.id)
    .maybeSingle();

  const isBookingForAnotherUser = bookedForUserId !== user.id;
  if (isBookingForAnotherUser) {
    const { data: bookingTarget } = await admin
      .from("profiles")
      .select("id")
      .eq("id", bookedForUserId)
      .maybeSingle();

    if (!bookingTarget) {
      return { error: "Selected booking user was not found." };
    }
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

  if (allowDoubleBooking && sharedWithUserIds.length === 0) {
    return { error: "Choose at least one user to share overlap access with." };
  }

  if (allowDoubleBooking && (sharedRangeStartDate || sharedRangeEndDate)) {
    if (!sharedRangeStartDate || !sharedRangeEndDate) {
      return { error: "Choose both share range dates, or leave both empty to share the whole reservation." };
    }

    if (sharedRangeEndDate < sharedRangeStartDate) {
      return { error: "Sharable range end date must be on or after sharable range start date." };
    }

    if (sharedRangeStartDate < startDate || sharedRangeEndDate > endDate) {
      return { error: "Sharable range must be within the reservation date range." };
    }
  }

  // Check for overlapping approved or pending reservations.
  const { data: conflicts } = await admin
    .from("reservations")
    .select("id,user_id,start_date,end_date,shared_with_user_ids,shared_range_start_date,shared_range_end_date")
    .lte("start_date", endDate)
    .gte("end_date", startDate)
    .in("status", ["pending", "approved"]);

  const conflictRows = (conflicts ?? []).map((conflict) => ({
    id: conflict.id as string,
    userId: conflict.user_id as string,
    userName: "Unknown",
    startDate: conflict.start_date as string,
    endDate: conflict.end_date as string,
    sharedWithUserIds: (conflict.shared_with_user_ids as string[] | null) ?? [],
    sharedRangeStartDate: (conflict.shared_range_start_date as string | null) ?? undefined,
    sharedRangeEndDate: (conflict.shared_range_end_date as string | null) ?? undefined,
    status: "approved" as const,
    createdAt: new Date().toISOString()
  }));

  const disallowedConflict = hasDateConflict(
    conflictRows,
    startDate,
    endDate,
    undefined,
    bookedForUserId,
    allowDoubleBooking ? sharedWithUserIds : [],
    allowDoubleBooking && sharedRangeStartDate && sharedRangeEndDate ? sharedRangeStartDate : undefined,
    allowDoubleBooking && sharedRangeStartDate && sharedRangeEndDate ? sharedRangeEndDate : undefined
  );

  if (disallowedConflict) {
    return { error: "This date range conflicts with a reservation that is not shared with the selected user set." };
  }

  const { data: insertedReservation, error: insertError } = await admin
    .from("reservations")
    .insert({
      user_id: bookedForUserId,
      created_by: user.id,
      shared_with_user_ids: sharedWithUserIds,
      shared_range_start_date: allowDoubleBooking && sharedRangeStartDate && sharedRangeEndDate ? sharedRangeStartDate : null,
      shared_range_end_date: allowDoubleBooking && sharedRangeStartDate && sharedRangeEndDate ? sharedRangeEndDate : null,
      start_date: startDate,
      end_date: endDate,
      notes: notes.trim() || null,
      status: approvalEnabled ? "pending" : "approved"
    })
    .select("id,user_id,start_date,end_date,created_at")
    .single();

  if (insertError || !insertedReservation) {
    if (insertError?.code === "42501" || /permission denied/i.test(insertError?.message ?? "")) {
      return { error: "You do not have permission for that reservation action." };
    }

    return { error: insertError.message };
  }

  const [maintenanceTypes, maintenanceRecords] = await Promise.all([getMaintenanceTypes(), getMaintenanceRecords()]);

  const { data: maintenanceContactsResult } = await admin
    .from("info_contacts")
    .select("name,number,email,address,role_function,maintenance_category")
    .eq("is_maintenance", true)
    .order("name", { ascending: true });

  const dueMaintenanceTypes = getDueMaintenanceTypes(maintenanceTypes, maintenanceRecords, endDate);

  const contactsByTypeName = new Map<string, MaintenanceContactInfo[]>();

  for (const contact of maintenanceContactsResult ?? []) {
    const category = (contact.maintenance_category || contact.role_function || "").trim().toLowerCase();
    if (!category) {
      continue;
    }

    const existing = contactsByTypeName.get(category) ?? [];
    existing.push({
      name: contact.name,
      number: contact.number || undefined,
      email: contact.email || undefined,
      address: contact.address || undefined
    });
    contactsByTypeName.set(category, existing);
  }

  if (dueMaintenanceTypes.length > 0) {
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

  const [notificationPreferenceResult, bookedUserResult] = await Promise.all([
    admin
      .from("notification_preferences")
      .select("reservation_confirmation_email,reservation_booked_by_other_email,email_enabled")
      .eq("user_id", insertedReservation.user_id)
      .maybeSingle(),
    admin
      .from("profiles")
      .select("full_name,email")
      .eq("id", insertedReservation.user_id)
      .maybeSingle()
  ]);

  const bookedByOtherUser = insertedReservation.user_id !== user.id;
  const shouldSendConfirmation = bookedByOtherUser
    ? Boolean(notificationPreferenceResult.data?.reservation_booked_by_other_email)
    : Boolean(notificationPreferenceResult.data?.reservation_confirmation_email);

  if (!notificationPreferenceResult.error && !bookedUserResult.error && shouldSendConfirmation && notificationPreferenceResult.data?.email_enabled && bookedUserResult.data?.email) {
    await sendReservationConfirmationEmail({
      email: bookedUserResult.data.email,
      fullName: bookedUserResult.data.full_name,
      bookingDate: insertedReservation.created_at,
      startDate: insertedReservation.start_date,
      endDate: insertedReservation.end_date,
      durationNights:
        Math.max(
          0,
          Math.round((new Date(insertedReservation.end_date).getTime() - new Date(insertedReservation.start_date).getTime()) / (1000 * 60 * 60 * 24))
        ) + 1,
      bookedByName:
        bookedByOtherUser
          ? actingProfile?.full_name?.trim() || "another user"
          : undefined
    });
  }

  revalidatePath("/reservations");
  revalidatePath("/");
  return {
    success: true,
    maintenanceAlerts: dueMaintenanceTypes.map((maintenanceType) =>
      formatMaintenanceAlert(maintenanceType, contactsByTypeName.get(maintenanceType.name.trim().toLowerCase()) ?? [])
    )
  };
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
  const admin = createAdminClient();
  if (!supabase) {
    return { error: "Supabase is not configured on the server." };
  }

  if (!admin) {
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
  const { data: actingProfile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!actingProfile || (actingProfile.role !== "admin" && actingProfile.role !== "superadmin")) {
    return { error: "Only admins can moderate reservations." };
  }

  // Fetch the reservation and its owner's profile
  const { data: reservation } = await admin
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

  const { error: updateError } = await admin
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

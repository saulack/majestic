"use server";

import { revalidatePath } from "next/cache";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export type ActionResult = { error?: string; success?: boolean };

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
    // Supabase not configured — mock mode
    return { success: true };
  }

  const {
    data: { user },
    error: authError
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "You must be signed in to make a reservation." };
  }

  const { startDate, endDate, notes, approvalEnabled, bookedForUserId, allowDoubleBooking = false } = params;

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

  const { error: insertError } = await supabase.from("reservations").insert({
    user_id: bookedForUserId,
    created_by: user.id,
    start_date: startDate,
    end_date: endDate,
    notes: notes.trim() || null,
    status: approvalEnabled ? "pending" : "approved"
  });

  if (insertError) {
    return { error: insertError.message };
  }

  revalidatePath("/reservations");
  return { success: true };
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
    return { success: true };
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

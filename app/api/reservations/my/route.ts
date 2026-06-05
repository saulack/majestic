import { NextResponse } from "next/server";
import { requireAuthenticated } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { hasDateConflict } from "@/lib/reservation-utils";

type UpdateReservationInput = {
  reservationId?: string;
  startDate?: string;
  endDate?: string;
  notes?: string;
};

type DeleteReservationInput = {
  reservationId?: string;
};

export async function PATCH(request: Request) {
  const auth = await requireAuthenticated();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 403 });
  }

  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();
  if (!supabase || !admin) {
    return NextResponse.json({ error: "Supabase is not configured on the server." }, { status: 500 });
  }

  const body = (await request.json()) as UpdateReservationInput;
  const reservationId = body.reservationId?.trim() ?? "";
  const startDate = body.startDate?.trim() ?? "";
  const endDate = body.endDate?.trim() ?? "";
  const notes = body.notes?.trim() ?? "";

  if (!reservationId || !startDate || !endDate) {
    return NextResponse.json({ error: "Reservation id, start date, and end date are required." }, { status: 400 });
  }

  if (endDate < startDate) {
    return NextResponse.json({ error: "End date must be on or after start date." }, { status: 400 });
  }

  const { data: existingReservation, error: existingError } = await admin
    .from("reservations")
    .select("id,user_id,start_date,end_date,shared_with_user_ids,shared_range_start_date,shared_range_end_date")
    .eq("id", reservationId)
    .maybeSingle();

  if (existingError || !existingReservation) {
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
  }

  if (existingReservation.user_id !== auth.userId) {
    return NextResponse.json({ error: "You can only edit your own reservations." }, { status: 403 });
  }

  const { data: conflicts } = await admin
    .from("reservations")
    .select("id,user_id,start_date,end_date,shared_with_user_ids,shared_range_start_date,shared_range_end_date")
    .lte("start_date", endDate)
    .gte("end_date", startDate)
    .in("status", ["pending", "approved"])
    .neq("id", reservationId);

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

  const requestedSharedWithUserIds = (existingReservation.shared_with_user_ids as string[] | null) ?? [];
  const requestedSharedRangeStartDate = (existingReservation.shared_range_start_date as string | null) ?? undefined;
  const requestedSharedRangeEndDate = (existingReservation.shared_range_end_date as string | null) ?? undefined;

  const hasDisallowedConflict = hasDateConflict(
    conflictRows,
    startDate,
    endDate,
    undefined,
    auth.userId,
    requestedSharedWithUserIds,
    requestedSharedRangeStartDate,
    requestedSharedRangeEndDate
  );

  if (hasDisallowedConflict) {
    return NextResponse.json({ error: "This date range conflicts with an existing reservation." }, { status: 400 });
  }

  const { data, error } = await admin
    .from("reservations")
    .update({
      start_date: startDate,
      end_date: endDate,
      notes: notes || null
    })
    .eq("id", reservationId)
    .eq("user_id", auth.userId)
    .select("id,user_id,start_date,end_date,notes,status,decline_reason,created_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to update reservation." }, { status: 400 });
  }

  return NextResponse.json({
    mode: "live",
    message: "Reservation updated.",
    reservation: {
      id: data.id,
      userId: data.user_id,
      startDate: data.start_date,
      endDate: data.end_date,
      notes: data.notes ?? undefined,
      status: data.status,
      declineReason: data.decline_reason ?? undefined,
      createdAt: data.created_at
    }
  });
}

export async function DELETE(request: Request) {
  const auth = await requireAuthenticated();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 403 });
  }

  const supabase = await createServerSupabaseClient();
  const admin = createAdminClient();
  if (!supabase || !admin) {
    return NextResponse.json({ error: "Supabase is not configured on the server." }, { status: 500 });
  }

  const body = (await request.json()) as DeleteReservationInput;
  const reservationId = body.reservationId?.trim() ?? "";

  if (!reservationId) {
    return NextResponse.json({ error: "Reservation id is required." }, { status: 400 });
  }

  const { data: existingReservation, error: existingError } = await admin
    .from("reservations")
    .select("id,user_id")
    .eq("id", reservationId)
    .maybeSingle();

  if (existingError || !existingReservation) {
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
  }

  if (existingReservation.user_id !== auth.userId) {
    return NextResponse.json({ error: "You can only cancel your own reservations." }, { status: 403 });
  }

  const { data, error } = await admin
    .from("reservations")
    .update({
      status: "declined",
      decline_reason: "Canceled by user",
      reviewed_by: auth.userId,
      reviewed_at: new Date().toISOString()
    })
    .eq("id", reservationId)
    .eq("user_id", auth.userId)
    .select("id,user_id,start_date,end_date,notes,status,decline_reason,created_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to cancel reservation." }, { status: 400 });
  }

  return NextResponse.json({
    mode: "live",
    message: "Reservation canceled.",
    reservation: {
      id: data.id,
      userId: data.user_id,
      startDate: data.start_date,
      endDate: data.end_date,
      notes: data.notes ?? undefined,
      status: data.status,
      declineReason: data.decline_reason ?? undefined,
      createdAt: data.created_at
    }
  });
}

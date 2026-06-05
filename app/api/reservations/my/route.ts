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
  allowDoubleBooking?: boolean;
  sharedWithUserIds?: string[];
  sharedRangeStartDate?: string;
  sharedRangeEndDate?: string;
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
  const allowDoubleBooking = body.allowDoubleBooking === true;

  if (!reservationId || !startDate || !endDate) {
    return NextResponse.json({ error: "Reservation id, start date, and end date are required." }, { status: 400 });
  }

  if (endDate < startDate) {
    return NextResponse.json({ error: "End date must be on or after start date." }, { status: 400 });
  }

  const requestedSharedWithUserIds = allowDoubleBooking
    ? Array.from(new Set((body.sharedWithUserIds ?? []).map((id) => id.trim()).filter((id) => id && id !== auth.userId)))
    : [];
  const requestedSharedRangeStartDate = allowDoubleBooking ? body.sharedRangeStartDate?.trim() || undefined : undefined;
  const requestedSharedRangeEndDate = allowDoubleBooking ? body.sharedRangeEndDate?.trim() || undefined : undefined;

  if (allowDoubleBooking && requestedSharedWithUserIds.length === 0) {
    return NextResponse.json({ error: "Select at least one user to allow overlap." }, { status: 400 });
  }

  if (allowDoubleBooking) {
    if ((requestedSharedRangeStartDate && !requestedSharedRangeEndDate) || (!requestedSharedRangeStartDate && requestedSharedRangeEndDate)) {
      return NextResponse.json({ error: "Select both sharable range dates or use whole reservation." }, { status: 400 });
    }

    if (requestedSharedRangeStartDate && requestedSharedRangeEndDate) {
      if (requestedSharedRangeEndDate < requestedSharedRangeStartDate) {
        return NextResponse.json({ error: "Sharable range end date must be on or after start date." }, { status: 400 });
      }

      if (requestedSharedRangeStartDate < startDate || requestedSharedRangeEndDate > endDate) {
        return NextResponse.json({ error: "Sharable range must stay within reservation dates." }, { status: 400 });
      }
    }
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
      notes: notes || null,
      shared_with_user_ids: allowDoubleBooking ? requestedSharedWithUserIds : [],
      shared_range_start_date: allowDoubleBooking ? requestedSharedRangeStartDate ?? null : null,
      shared_range_end_date: allowDoubleBooking ? requestedSharedRangeEndDate ?? null : null
    })
    .eq("id", reservationId)
    .eq("user_id", auth.userId)
    .select("id,user_id,start_date,end_date,notes,shared_with_user_ids,shared_range_start_date,shared_range_end_date,status,decline_reason,created_at")
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
      sharedWithUserIds: (data.shared_with_user_ids as string[] | null) ?? [],
      sharedRangeStartDate: (data.shared_range_start_date as string | null) ?? undefined,
      sharedRangeEndDate: (data.shared_range_end_date as string | null) ?? undefined,
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

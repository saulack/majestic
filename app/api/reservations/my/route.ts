import { NextResponse } from "next/server";
import { requireAuthenticated } from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

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
  if (!supabase) {
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

  const { data: existingReservation, error: existingError } = await supabase
    .from("reservations")
    .select("id,user_id")
    .eq("id", reservationId)
    .maybeSingle();

  if (existingError || !existingReservation) {
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
  }

  if (existingReservation.user_id !== auth.userId) {
    return NextResponse.json({ error: "You can only edit your own reservations." }, { status: 403 });
  }

  const { data: conflicts } = await supabase
    .from("reservations")
    .select("id")
    .lte("start_date", endDate)
    .gte("end_date", startDate)
    .in("status", ["pending", "approved"])
    .neq("id", reservationId);

  if (conflicts && conflicts.length > 0) {
    return NextResponse.json({ error: "This date range conflicts with an existing reservation." }, { status: 400 });
  }

  const { data, error } = await supabase
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
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured on the server." }, { status: 500 });
  }

  const body = (await request.json()) as DeleteReservationInput;
  const reservationId = body.reservationId?.trim() ?? "";

  if (!reservationId) {
    return NextResponse.json({ error: "Reservation id is required." }, { status: 400 });
  }

  const { data: existingReservation, error: existingError } = await supabase
    .from("reservations")
    .select("id,user_id")
    .eq("id", reservationId)
    .maybeSingle();

  if (existingError || !existingReservation) {
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
  }

  if (existingReservation.user_id !== auth.userId) {
    return NextResponse.json({ error: "You can only delete your own reservations." }, { status: 403 });
  }

  const { error } = await supabase
    .from("reservations")
    .delete()
    .eq("id", reservationId)
    .eq("user_id", auth.userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ mode: "live", message: "Reservation deleted.", reservationId });
}

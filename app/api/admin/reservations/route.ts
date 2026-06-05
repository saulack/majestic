import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

type DeleteReservationInput = {
  reservationId?: string;
};

export async function DELETE(request: Request) {
  const auth = await requireSuperadmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Supabase is not configured on the server." }, { status: 500 });
  }

  const body = (await request.json()) as DeleteReservationInput;
  const reservationId = body.reservationId?.trim() ?? "";

  if (!reservationId) {
    return NextResponse.json({ error: "Reservation id is required." }, { status: 400 });
  }

  const { data: reservation, error: reservationError } = await admin
    .from("reservations")
    .select("id")
    .eq("id", reservationId)
    .maybeSingle();

  if (reservationError || !reservation) {
    return NextResponse.json({ error: "Reservation not found." }, { status: 404 });
  }

  const { error: deleteError } = await admin.from("reservations").delete().eq("id", reservationId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  revalidatePath("/");
  revalidatePath("/manage-reservations");
  revalidatePath("/reservations");
  revalidatePath("/stats");

  return NextResponse.json({ mode: "live", message: "Reservation deleted.", reservationId });
}
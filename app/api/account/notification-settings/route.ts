import { NextResponse } from "next/server";
import { requireAuthenticated } from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type NotificationSettingsInput = {
  reservationConfirmationEmail?: boolean;
  reservationBookedByOtherEmail?: boolean;
};

export async function POST(request: Request) {
  const auth = await requireAuthenticated();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 403 });
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured on the server." }, { status: 500 });
  }

  const body = (await request.json()) as NotificationSettingsInput;
  const reservationConfirmationEmail = Boolean(body.reservationConfirmationEmail);
  const reservationBookedByOtherEmail = Boolean(body.reservationBookedByOtherEmail);

  const { error } = await supabase.from("notification_preferences").upsert(
    {
      user_id: auth.userId,
      reservation_confirmation_email: reservationConfirmationEmail,
      reservation_booked_by_other_email: reservationBookedByOtherEmail,
      updated_at: new Date().toISOString()
    },
    { onConflict: "user_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    mode: "live",
    message: "Notification preferences saved.",
    reservationConfirmationEmail,
    reservationBookedByOtherEmail
  });
}

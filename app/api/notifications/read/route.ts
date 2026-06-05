import { NextResponse } from "next/server";
import { requireAuthenticated } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

type ReadNotificationInput = {
  notificationId?: string;
};

export async function POST(request: Request) {
  const auth = await requireAuthenticated();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Supabase is not configured on the server." }, { status: 500 });
  }

  const body = (await request.json()) as ReadNotificationInput;
  const notificationId = body.notificationId?.trim() ?? "";

  if (!notificationId) {
    return NextResponse.json({ error: "Notification id is required." }, { status: 400 });
  }

  const now = new Date().toISOString();
  const { error } = await admin.from("notification_reads").upsert(
    {
      user_id: auth.userId,
      notification_id: notificationId,
      read_at: now
    },
    { onConflict: "user_id,notification_id" }
  );

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, notificationId, readAt: now });
}

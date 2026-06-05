import { NextResponse } from "next/server";
import { requireAuthenticated } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

type ReadAllInput = {
  notificationIds?: string[];
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

  const body = (await request.json()) as ReadAllInput;
  const notificationIds = (body.notificationIds ?? []).map((entry) => entry.trim()).filter(Boolean);

  if (notificationIds.length === 0) {
    return NextResponse.json({ success: true, count: 0 });
  }

  const now = new Date().toISOString();
  const payload = notificationIds.map((notificationId) => ({
    user_id: auth.userId,
    notification_id: notificationId,
    read_at: now
  }));

  const { error } = await admin.from("notification_reads").upsert(payload, { onConflict: "user_id,notification_id" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ success: true, count: notificationIds.length, readAt: now });
}

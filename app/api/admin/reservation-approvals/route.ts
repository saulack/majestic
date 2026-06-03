import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { RESERVATION_APPROVALS_FLAG_KEY } from "@/lib/feature-flags";

export async function POST(request: Request) {
  const auth = await requireSuperadmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 403 });
  }

  const body = (await request.json()) as { enabled?: boolean | string };
  const enabled = body.enabled === true || body.enabled === "true";

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ mode: "mock", enabled, message: `Mock reservation approvals set to ${enabled ? "on" : "off"}.` });
  }

  const { error } = await admin.from("app_settings").upsert({
    key: RESERVATION_APPROVALS_FLAG_KEY,
    value: enabled,
    updated_at: new Date().toISOString()
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ mode: "live", enabled, message: `Reservation approvals ${enabled ? "enabled" : "disabled"}.` });
}

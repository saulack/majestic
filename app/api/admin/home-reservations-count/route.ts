import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { HOMEPAGE_RESERVATIONS_COUNT_KEY } from "@/lib/feature-flags";

export async function POST(request: Request) {
  const auth = await requireSuperadmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 403 });
  }

  const body = (await request.json()) as { count?: number | string };
  const countValue = Number(body.count);
  const count = Number.isFinite(countValue) ? Math.max(1, Math.min(10, Math.floor(countValue))) : 5;

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ mode: "mock", count, message: `Mock homepage reservation count set to ${count}.` });
  }

  const { error } = await admin.from("app_settings").upsert({
    key: HOMEPAGE_RESERVATIONS_COUNT_KEY,
    value: count,
    updated_at: new Date().toISOString()
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ mode: "live", count, message: `Homepage now shows ${count} upcoming reservations.` });
}

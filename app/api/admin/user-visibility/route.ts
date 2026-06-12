import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const auth = await requireSuperadmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 403 });
  }

  const body = (await request.json()) as { userId?: string; hidden?: boolean };
  const userId = body.userId?.trim();
  const hidden = body.hidden;

  if (!userId) {
    return NextResponse.json({ error: "User id is required." }, { status: 400 });
  }

  if (typeof hidden !== "boolean") {
    return NextResponse.json({ error: "Hidden must be true or false." }, { status: 400 });
  }

  if (userId === auth.userId) {
    return NextResponse.json({ error: "Superadmin cannot hide own account." }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Supabase is not configured on the server." }, { status: 500 });
  }

  const { data: targetProfile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (targetProfile?.role === "superadmin") {
    return NextResponse.json({ error: "Superadmin accounts cannot be hidden." }, { status: 400 });
  }

  const { error } = await admin.auth.admin.updateUserById(userId, {
    ban_duration: hidden ? "876000h" : "none"
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ mode: "live", message: hidden ? "User hidden (deactivated)." : "User restored (reactivated)." });
}

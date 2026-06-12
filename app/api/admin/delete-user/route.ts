import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const auth = await requireSuperadmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 403 });
  }

  const body = (await request.json()) as { userId?: string; fullName?: string };
  const userId = body.userId?.trim();
  const fullName = body.fullName?.trim();

  if (!userId) {
    return NextResponse.json({ error: "User id is required." }, { status: 400 });
  }

  if (!fullName) {
    return NextResponse.json({ error: "Full name confirmation is required." }, { status: 400 });
  }

  if (userId === auth.userId) {
    return NextResponse.json({ error: "Superadmin cannot delete self." }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Supabase is not configured on the server." }, { status: 500 });
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("full_name,role")
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  if (!profile) {
    return NextResponse.json({ error: "User profile not found." }, { status: 404 });
  }

  if (profile.role === "superadmin") {
    return NextResponse.json({ error: "Superadmin account cannot be deleted." }, { status: 400 });
  }

  if (profile.full_name.trim().toLowerCase() !== fullName.toLowerCase()) {
    return NextResponse.json({ error: "Full name confirmation does not match." }, { status: 400 });
  }

  const { error: reservationsDeleteError } = await admin.from("reservations").delete().eq("user_id", userId);

  if (reservationsDeleteError) {
    return NextResponse.json({ error: reservationsDeleteError.message }, { status: 400 });
  }

  const { error } = await admin.auth.admin.deleteUser(userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ mode: "live", message: "User deleted and their reservations removed." });
}

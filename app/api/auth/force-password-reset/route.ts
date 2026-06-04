import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const body = (await request.json()) as { email?: string; password?: string };
  const email = body.email?.trim().toLowerCase();
  const password = body.password?.trim();

  if (!email || !password) {
    return NextResponse.json({ error: "Email and new password are required." }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ mode: "mock", message: "Mock password reset completed." });
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id,force_password_reset")
    .eq("email", email)
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  if (!profile?.id || !profile.force_password_reset) {
    return NextResponse.json({ error: "A forced reset is not active for this account." }, { status: 400 });
  }

  const { error: updateError } = await admin.auth.admin.updateUserById(profile.id, {
    password
  });

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  const { error: clearError } = await admin
    .from("profiles")
    .update({ force_password_reset: false })
    .eq("id", profile.id);

  if (clearError) {
    return NextResponse.json({ error: clearError.message }, { status: 400 });
  }

  return NextResponse.json({ mode: "live", message: "Password reset completed. Sign in with your new password." });
}

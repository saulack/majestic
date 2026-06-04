import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const auth = await requireSuperadmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 403 });
  }

  const body = (await request.json()) as { userId?: string; role?: "user" | "admin" };
  const userId = body.userId?.trim();
  const nextRole = body.role;

  if (!userId || !nextRole || !["user", "admin"].includes(nextRole)) {
    return NextResponse.json({ error: "User ID and role are required." }, { status: 400 });
  }

  if (userId === auth.userId) {
    return NextResponse.json({ error: "Superadmin role cannot be changed here." }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Supabase is not configured on the server." }, { status: 500 });
  }

  const { data: targetUser, error: userError } = await admin
    .from("profiles")
    .select("id,email,role")
    .eq("id", userId)
    .single();

  if (userError || !targetUser) {
    return NextResponse.json({ error: "User not found." }, { status: 404 });
  }

  if (targetUser.role === "superadmin") {
    return NextResponse.json({ error: "Superadmin access cannot be changed here." }, { status: 400 });
  }

  const { error: profileError } = await admin.from("profiles").update({ role: nextRole }).eq("id", userId);
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  if (nextRole === "admin") {
    const { error: grantError } = await admin.from("role_grants").upsert({
      email: targetUser.email,
      role: "admin"
    });

    if (grantError) {
      return NextResponse.json({ error: grantError.message }, { status: 400 });
    }
  } else {
    const { error: grantError } = await admin.from("role_grants").delete().eq("email", targetUser.email).eq("role", "admin");

    if (grantError) {
      return NextResponse.json({ error: grantError.message }, { status: 400 });
    }
  }

  return NextResponse.json({
    message: nextRole === "admin" ? "Admin access granted." : "Admin access removed."
  });
}
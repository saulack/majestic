import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const auth = await requireSuperadmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 403 });
  }

  const body = (await request.json()) as {
    email?: string;
    fullName?: string;
    role?: "user" | "admin";
  };

  const email = body.email?.trim().toLowerCase();
  const fullName = body.fullName?.trim();
  const role = body.role ?? "user";

  if (!email || !fullName) {
    return NextResponse.json({ error: "Full name and email are required." }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({
      mode: "mock",
      message: `Mock create user prepared for ${email} (${role}).`
    });
  }

  const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: {
      full_name: fullName,
      role
    },
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/signup`
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  if (data.user?.id) {
    const { error: profileError } = await admin.from("profiles").upsert({
      id: data.user.id,
      email,
      full_name: fullName,
      role
    });

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 400 });
    }
  }

  return NextResponse.json({
    mode: "live",
    message: `Invitation sent to ${email}.`
  });
}

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const auth = await requireSuperadmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 403 });
  }

  const body = (await request.json()) as { email?: string };
  const email = body.email?.trim().toLowerCase();

  if (!email) {
    return NextResponse.json({ error: "Email is required." }, { status: 400 });
  }

  const token = randomUUID().replaceAll("-", "");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const inviteUrl = `${appUrl}/signup?invite_token=${token}`;

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ inviteUrl, mode: "mock" });
  }

  const { error } = await admin.from("admin_invites").insert({
    token,
    email,
    role: "admin",
    created_by: auth.userId,
    expires_at: expiresAt
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ inviteUrl, mode: "live" });
}

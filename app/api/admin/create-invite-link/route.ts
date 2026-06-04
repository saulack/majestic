import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const auth = await requireSuperadmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 403 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  const token = randomUUID().replaceAll("-", "");
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({
      mode: "mock",
      inviteUrl: `${appUrl}/signup?invite_token=${token}`,
      message: "Mock invite link generated."
    });
  }

  const { error } = await admin.from("signup_invites").insert({
    token,
    created_by: auth.userId,
    expires_at: expiresAt
  });

  if (error) {
    return NextResponse.json({ error: error.message ?? "Failed to create invite link." }, { status: 400 });
  }

  return NextResponse.json({
    mode: "live",
    inviteUrl: `${appUrl}/signup?invite_token=${token}`,
    message: "Invite link generated."
  });
}
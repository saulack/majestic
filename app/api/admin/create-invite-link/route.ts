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
    return NextResponse.json({ error: "Invite email is required." }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;

  const admin = createAdminClient();
  if (!admin) {
    const mockToken = randomUUID().replaceAll("-", "");
    return NextResponse.json({
      mode: "mock",
      inviteUrl: `${appUrl}/signup?mock_invite=${mockToken}`,
      message: `Mock invite link generated for ${email}.`
    });
  }

  const adminAuth = admin.auth.admin as unknown as {
    generateLink?: (params: {
      type: "invite";
      email: string;
      options?: { redirectTo?: string };
    }) => Promise<{
      data?: { properties?: { action_link?: string } };
      error?: { message?: string } | null;
    }>;
  };

  if (typeof adminAuth.generateLink !== "function") {
    return NextResponse.json({ error: "Invite link generation is not supported in this environment." }, { status: 501 });
  }

  const { data, error } = await adminAuth.generateLink({
    type: "invite",
    email,
    options: {
      redirectTo: `${appUrl}/signup`
    }
  });

  if (error) {
    return NextResponse.json({ error: error.message ?? "Failed to create invite link." }, { status: 400 });
  }

  const inviteUrl = data?.properties?.action_link;
  if (!inviteUrl) {
    return NextResponse.json({ error: "No invite link was returned." }, { status: 400 });
  }

  return NextResponse.json({
    mode: "live",
    inviteUrl,
    message: `Invite link generated for ${email}.`
  });
}
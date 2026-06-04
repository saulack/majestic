import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function passwordMeetsRules(password: string) {
  return password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password) && /[^A-Za-z0-9]/.test(password);
}

function emailLooksValid(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    inviteToken?: string;
    fullName?: string;
    email?: string;
    password?: string;
  };

  const inviteToken = body.inviteToken?.trim() ?? "";
  const fullName = body.fullName?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";
  const password = body.password?.trim() ?? "";

  if (!inviteToken || !fullName || !email || !password) {
    return NextResponse.json({ error: "Invite token, name, email, and password are required." }, { status: 400 });
  }

  if (fullName.length < 2) {
    return NextResponse.json({ error: "Please enter your full name." }, { status: 400 });
  }

  if (!emailLooksValid(email)) {
    return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
  }

  if (!passwordMeetsRules(password)) {
    return NextResponse.json({ error: "Password does not meet security requirements." }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Supabase is not configured on the server." }, { status: 500 });
  }

  const { data: invite, error: inviteError } = await admin
    .from("signup_invites")
    .select("token,consumed_at,expires_at")
    .eq("token", inviteToken)
    .maybeSingle();

  if (inviteError) {
    return NextResponse.json({ error: inviteError.message }, { status: 400 });
  }

  if (!invite || invite.consumed_at) {
    return NextResponse.json({ error: "This invite link is no longer valid." }, { status: 400 });
  }

  if (new Date(invite.expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ error: "This invite link has expired." }, { status: 400 });
  }

  const { data: createdUser, error: createUserError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName
    }
  });

  if (createUserError || !createdUser.user) {
    return NextResponse.json({ error: createUserError?.message ?? "Failed to create account." }, { status: 400 });
  }

  const { data: roleGrant } = await admin
    .from("role_grants")
    .select("role")
    .ilike("email", email)
    .maybeSingle();

  const resolvedRole = roleGrant?.role === "admin" || roleGrant?.role === "superadmin" ? roleGrant.role : "user";

  const { error: profileUpsertError } = await admin.from("profiles").upsert(
    {
      id: createdUser.user.id,
      email,
      full_name: fullName,
      role: resolvedRole,
      force_password_reset: false
    },
    { onConflict: "id" }
  );

  if (profileUpsertError) {
    return NextResponse.json({ error: profileUpsertError.message }, { status: 400 });
  }

  const { error: consumeError } = await admin
    .from("signup_invites")
    .update({ consumed_by: createdUser.user.id, consumed_at: new Date().toISOString() })
    .eq("token", inviteToken)
    .is("consumed_at", null);

  if (consumeError) {
    return NextResponse.json({ error: consumeError.message }, { status: 400 });
  }

  return NextResponse.json({ message: "Account created. You can now sign in.", loginEmail: email });
}
import { NextResponse } from "next/server";
import { requireAuthenticated } from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

type ProfileBody = {
  fullName?: string;
  email?: string;
};

export async function POST(request: Request) {
  const auth = await requireAuthenticated();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 403 });
  }

  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured on the server." }, { status: 500 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Supabase is not configured on the server." }, { status: 500 });
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json({ error: "You must be authenticated." }, { status: 403 });
  }

  const body = (await request.json()) as ProfileBody;
  const fullName = body.fullName?.trim() ?? "";
  const email = body.email?.trim().toLowerCase() ?? "";

  if (!fullName || !email) {
    return NextResponse.json({ error: "Full name and email are required." }, { status: 400 });
  }

  const { data: updatedProfile, error: profileError } = await admin
    .from("profiles")
    .update({ full_name: fullName, email })
    .eq("id", auth.userId)
    .select("id")
    .maybeSingle();

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  if (!updatedProfile) {
    const { error: upsertProfileError } = await admin.from("profiles").upsert(
      {
        id: auth.userId,
        full_name: fullName,
        email
      },
      { onConflict: "id" }
    );

    if (upsertProfileError) {
      return NextResponse.json({ error: upsertProfileError.message }, { status: 400 });
    }
  }

  if (user.email !== email) {
    const { error: authError } = await supabase.auth.updateUser({ email });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ mode: "live", message: "Profile updated successfully." });
}

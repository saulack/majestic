import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ProfileBody = {
  fullName?: string;
  email?: string;
};

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    return NextResponse.json({ mode: "mock", message: "Profile saved locally in mock mode." });
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

  const { error: profileError } = await supabase
    .from("profiles")
    .update({ full_name: fullName, email })
    .eq("id", user.id);

  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 400 });
  }

  if (user.email !== email) {
    const { error: authError } = await supabase.auth.updateUser({ email });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }
  }

  return NextResponse.json({ mode: "live", message: "Profile updated successfully." });
}

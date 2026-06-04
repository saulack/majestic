import { NextResponse } from "next/server";
import { requireAuthenticated } from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type AccessCodeInput = {
  title?: string;
  passcode?: string;
  location?: string;
  notes?: string;
};

export async function GET() {
  const auth = await requireAuthenticated();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 403 });
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured on the server." }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("info_access_codes")
    .select("id,title,passcode,location,notes")
    .order("title", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ mode: "live", accessCodes: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAuthenticated();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 403 });
  }

  const body = (await request.json()) as AccessCodeInput;
  const title = body.title?.trim() ?? "";
  const passcode = body.passcode?.trim() ?? "";
  const location = body.location?.trim() ?? "";
  const notes = body.notes?.trim() ?? "";

  if (!title || !passcode) {
    return NextResponse.json({ error: "Title and passcode are required." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured on the server." }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("info_access_codes")
    .insert({
      title,
      passcode,
      location,
      notes,
      created_by: auth.userId
    })
    .select("id,title,passcode,location,notes")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to create access code." }, { status: 400 });
  }

  return NextResponse.json({ mode: "live", accessCode: data }, { status: 201 });
}

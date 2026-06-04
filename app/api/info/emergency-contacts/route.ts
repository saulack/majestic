import { NextResponse } from "next/server";
import { requireAuthenticated } from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type EmergencyContactInput = {
  title?: string;
  name?: string;
  phoneNumber?: string;
};

export async function GET() {
  const auth = await requireAuthenticated();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 403 });
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ mode: "mock", contacts: [] });
  }

  const { data, error } = await supabase
    .from("info_emergency_contacts")
    .select("id,title,name,phone_number")
    .order("title", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const contacts = (data ?? []).map((entry) => ({
    id: entry.id,
    title: entry.title,
    name: entry.name,
    phoneNumber: entry.phone_number
  }));

  return NextResponse.json({ mode: "live", contacts });
}

export async function POST(request: Request) {
  const auth = await requireAuthenticated();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 403 });
  }

  const body = (await request.json()) as EmergencyContactInput;
  const title = body.title?.trim() ?? "";
  const name = body.name?.trim() ?? "";
  const phoneNumber = body.phoneNumber?.trim() ?? "";

  if (!title || !name || !phoneNumber) {
    return NextResponse.json({ error: "Title, name, and phone number are required." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      {
        mode: "mock",
        contact: { id: crypto.randomUUID(), title, name, phoneNumber }
      },
      { status: 201 }
    );
  }

  const { data, error } = await supabase
    .from("info_emergency_contacts")
    .insert({
      title,
      name,
      phone_number: phoneNumber,
      created_by: auth.userId
    })
    .select("id,title,name,phone_number")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to create emergency contact." }, { status: 400 });
  }

  return NextResponse.json(
    {
      mode: "live",
      contact: {
        id: data.id,
        title: data.title,
        name: data.name,
        phoneNumber: data.phone_number
      }
    },
    { status: 201 }
  );
}

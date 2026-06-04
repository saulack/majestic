import { NextResponse } from "next/server";
import { requireAuthenticated } from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ContactInput = {
  name?: string;
  number?: string;
  email?: string;
  address?: string;
  function?: string;
  isStaff?: boolean;
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
    .from("info_contacts")
    .select("id,name,number,email,address,role_function,is_staff")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const contacts = (data ?? []).map((entry) => ({
    id: entry.id,
    name: entry.name,
    number: entry.number,
    email: entry.email,
    address: entry.address,
    function: entry.role_function,
    isStaff: entry.is_staff
  }));

  return NextResponse.json({ mode: "live", contacts });
}

export async function POST(request: Request) {
  const auth = await requireAuthenticated();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 403 });
  }

  const body = (await request.json()) as ContactInput;
  const name = body.name?.trim() ?? "";
  const roleFunction = body.function?.trim() ?? "";
  const number = body.number?.trim() ?? "";
  const email = body.email?.trim() ?? "";
  const address = body.address?.trim() ?? "";

  if (!name || !roleFunction) {
    return NextResponse.json({ error: "Name and function are required." }, { status: 400 });
  }

  if (!number && !email && !address) {
    return NextResponse.json({ error: "Please provide at least one contact field: phone, email, or address." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured on the server." }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("info_contacts")
    .insert({
      name,
      number,
      email,
      address,
      role_function: roleFunction,
      is_staff: Boolean(body.isStaff),
      created_by: auth.userId
    })
    .select("id,name,number,email,address,role_function,is_staff")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to create contact." }, { status: 400 });
  }

  return NextResponse.json(
    {
      mode: "live",
      contact: {
        id: data.id,
        name: data.name,
        number: data.number,
        email: data.email,
        address: data.address,
        function: data.role_function,
        isStaff: data.is_staff
      }
    },
    { status: 201 }
  );
}

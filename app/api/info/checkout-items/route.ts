import { NextResponse } from "next/server";
import { requireAuthenticated } from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type CheckoutItemInput = {
  text?: string;
};

type CheckoutItemUpdateInput = {
  id?: string;
  done?: boolean;
};

export async function GET() {
  const auth = await requireAuthenticated();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 403 });
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ mode: "mock", items: [] });
  }

  const { data, error } = await supabase
    .from("info_checkout_items")
    .select("id,text,done")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ mode: "live", items: data ?? [] });
}

export async function POST(request: Request) {
  const auth = await requireAuthenticated();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 403 });
  }

  const body = (await request.json()) as CheckoutItemInput;
  const text = body.text?.trim() ?? "";

  if (!text) {
    return NextResponse.json({ error: "Item text is required." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ mode: "mock", item: { id: crypto.randomUUID(), text, done: false } }, { status: 201 });
  }

  const { data, error } = await supabase
    .from("info_checkout_items")
    .insert({
      text,
      done: false,
      created_by: auth.userId
    })
    .select("id,text,done")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to create checklist item." }, { status: 400 });
  }

  return NextResponse.json({ mode: "live", item: data }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await requireAuthenticated();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 403 });
  }

  const body = (await request.json()) as CheckoutItemUpdateInput;
  const id = body.id?.trim() ?? "";

  if (!id || typeof body.done !== "boolean") {
    return NextResponse.json({ error: "Item id and done state are required." }, { status: 400 });
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ mode: "mock", item: { id, done: body.done } });
  }

  const { data, error } = await supabase
    .from("info_checkout_items")
    .update({ done: body.done })
    .eq("id", id)
    .select("id,text,done")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to update checklist item." }, { status: 400 });
  }

  return NextResponse.json({ mode: "live", item: data });
}

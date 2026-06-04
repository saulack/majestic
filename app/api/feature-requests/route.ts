import { NextResponse } from "next/server";
import { requireAuthenticated } from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type CreateFeatureRequestInput = {
  title?: string;
  description?: string;
  statusEmailOptIn?: boolean;
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

  const body = (await request.json()) as CreateFeatureRequestInput;
  const title = (body.title ?? "").trim();
  const description = (body.description ?? "").trim();
  const statusEmailOptIn = Boolean(body.statusEmailOptIn);

  if (title.length < 3) {
    return NextResponse.json({ error: "Title must be at least 3 characters." }, { status: 400 });
  }

  if (description.length < 10) {
    return NextResponse.json({ error: "Description must be at least 10 characters." }, { status: 400 });
  }

  const { error } = await supabase.from("feature_requests").insert({
    requested_by: auth.userId,
    title,
    description,
    status_email_opt_in: statusEmailOptIn
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    mode: "live",
    message: "Feature request submitted and marked as pending."
  });
}

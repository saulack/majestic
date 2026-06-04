import { NextResponse } from "next/server";
import { requireAuthenticated } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

type CreateFeatureRequestInput = {
  requestType?: "feature" | "bug";
  title?: string;
  description?: string;
  statusEmailOptIn?: boolean;
};

export async function POST(request: Request) {
  const auth = await requireAuthenticated();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Supabase is not configured on the server." }, { status: 500 });
  }

  const body = (await request.json()) as CreateFeatureRequestInput;
  const requestType = body.requestType;
  const title = (body.title ?? "").trim();
  const description = (body.description ?? "").trim();
  const statusEmailOptIn = Boolean(body.statusEmailOptIn);

  if (requestType !== "feature" && requestType !== "bug") {
    return NextResponse.json({ error: "Please select either feature request or bug report." }, { status: 400 });
  }

  if (title.length < 3) {
    return NextResponse.json({ error: "Title must be at least 3 characters." }, { status: 400 });
  }

  if (description.length < 10) {
    return NextResponse.json({ error: "Description must be at least 10 characters." }, { status: 400 });
  }

  const { error } = await admin.from("feature_requests").insert({
    requested_by: auth.userId,
    request_type: requestType,
    title,
    description,
    status_email_opt_in: statusEmailOptIn
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({
    mode: "live",
    message: requestType === "bug" ? "Bug report submitted and marked as pending." : "Feature request submitted and marked as pending."
  });
}

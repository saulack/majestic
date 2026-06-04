import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

type FeatureRequestModerationInput = {
  requestId?: string;
  action?: "queue" | "decline";
};

export async function POST(request: Request) {
  const auth = await requireSuperadmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Supabase is not configured on the server." }, { status: 500 });
  }

  const body = (await request.json()) as FeatureRequestModerationInput;
  const requestId = body.requestId?.trim() ?? "";
  const action = body.action;

  if (!requestId || (action !== "queue" && action !== "decline")) {
    return NextResponse.json({ error: "Request id and action are required." }, { status: 400 });
  }

  const { data: requestRow, error: requestError } = await admin
    .from("feature_requests")
    .select("id,status,title")
    .eq("id", requestId)
    .single();

  if (requestError || !requestRow) {
    return NextResponse.json({ error: "Feature request not found." }, { status: 404 });
  }

  if (requestRow.status !== "pending") {
    return NextResponse.json({ error: "Only pending requests can be updated here." }, { status: 400 });
  }

  const nextStatus = action === "queue" ? "in_progress" : "declined";

  const { error: updateError } = await admin
    .from("feature_requests")
    .update({
      status: nextStatus,
      reviewed_by: auth.userId,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })
    .eq("id", requestId);

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  return NextResponse.json({
    mode: "live",
    message:
      action === "queue"
        ? `Feature request \"${requestRow.title}\" moved to queue.`
        : `Feature request \"${requestRow.title}\" was declined.`
  });
}

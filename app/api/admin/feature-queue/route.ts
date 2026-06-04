import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/admin-auth";
import { sendFeatureRequestStatusEmail } from "@/lib/notifications";
import { createAdminClient } from "@/lib/supabase/admin";

type FeatureQueueUpdateInput = {
  requestId?: string;
  action?: "complete" | "reject";
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

  const body = (await request.json()) as FeatureQueueUpdateInput;
  const requestId = body.requestId?.trim() ?? "";
  const action = body.action;

  if (!requestId || (action !== "complete" && action !== "reject")) {
    return NextResponse.json({ error: "Request id and action are required." }, { status: 400 });
  }

  const { data: requestRow, error: requestError } = await admin
    .from("feature_requests")
    .select(
      "id,title,status,request_type,status_email_opt_in,requester:profiles!feature_requests_requested_by_fkey(full_name,email)"
    )
    .eq("id", requestId)
    .single();

  if (requestError || !requestRow) {
    return NextResponse.json({ error: "Feature request not found." }, { status: 404 });
  }

  if (requestRow.status !== "in_progress") {
    return NextResponse.json({ error: "Only in-progress requests can be completed or rejected." }, { status: 400 });
  }

  const nextStatus = action === "complete" ? "completed" : "rejected";

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

  const requester = requestRow.requester as { full_name?: string; email?: string } | null;

  if (requestRow.status_email_opt_in && requester?.email) {
    await sendFeatureRequestStatusEmail({
      email: requester.email,
      fullName: requester.full_name ?? "there",
      requestType: requestRow.request_type,
      title: requestRow.title,
      status: nextStatus
    });
  }

  const requestLabel = requestRow.request_type === "bug" ? "Bug report" : "Feature request";

  return NextResponse.json({
    mode: "live",
    message:
      action === "complete"
        ? `${requestLabel} \"${requestRow.title}\" marked complete.`
        : `${requestLabel} \"${requestRow.title}\" marked rejected.`
  });
}

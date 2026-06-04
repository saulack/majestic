import { NextResponse } from "next/server";
import { requireAuthenticated } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

type FeatureRequestVoteInput = {
  requestId?: string;
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

  const body = (await request.json()) as FeatureRequestVoteInput;
  const requestId = body.requestId?.trim() ?? "";

  if (!requestId) {
    return NextResponse.json({ error: "Request id is required." }, { status: 400 });
  }

  const { data: requestRow, error: requestError } = await admin
    .from("feature_requests")
    .select("id,status,title,request_type")
    .eq("id", requestId)
    .single();

  if (requestError || !requestRow) {
    return NextResponse.json({ error: "Request not found." }, { status: 404 });
  }

  if (requestRow.status !== "pending" && requestRow.status !== "in_progress") {
    return NextResponse.json({ error: "Only unresolved requests can be boosted." }, { status: 400 });
  }

  const { data: existingVote, error: voteLookupError } = await admin
    .from("feature_request_votes")
    .select("id")
    .eq("feature_request_id", requestId)
    .eq("voted_by", auth.userId)
    .maybeSingle();

  if (voteLookupError) {
    return NextResponse.json({ error: voteLookupError.message }, { status: 400 });
  }

  if (existingVote) {
    const { count } = await admin.from("feature_request_votes").select("id", { count: "exact", head: true }).eq("feature_request_id", requestId);

    return NextResponse.json({
      mode: "live",
      message: "You already boosted this request.",
      requestId,
      voteCount: count ?? 0
    });
  }

  const { error: insertError } = await admin.from("feature_request_votes").insert({
    feature_request_id: requestId,
    voted_by: auth.userId
  });

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 400 });
  }

  const { count } = await admin.from("feature_request_votes").select("id", { count: "exact", head: true }).eq("feature_request_id", requestId);

  return NextResponse.json({
    mode: "live",
    message:
      requestRow.request_type === "bug"
        ? `Bug report "${requestRow.title}" boosted.`
        : `Feature request "${requestRow.title}" boosted.`,
    requestId,
    voteCount: count ?? 0
  });
}
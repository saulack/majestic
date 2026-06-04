import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

type ApprovalActionInput = {
  approvalId?: string;
  action?: "approve" | "reject";
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

  const body = (await request.json()) as ApprovalActionInput;
  const approvalId = body.approvalId?.trim() ?? "";
  const action = body.action;

  if (!approvalId || (action !== "approve" && action !== "reject")) {
    return NextResponse.json({ error: "Approval id and action are required." }, { status: 400 });
  }

  const { data: approval, error: approvalError } = await admin
    .from("maintenance_threshold_approvals")
    .select("id,maintenance_type_id,proposed_threshold_days,status,maintenance_type:maintenance_types!maintenance_threshold_approvals_maintenance_type_id_fkey(name)")
    .eq("id", approvalId)
    .single();

  if (approvalError || !approval) {
    return NextResponse.json({ error: "Approval request not found." }, { status: 404 });
  }

  if (approval.status !== "pending") {
    return NextResponse.json({ error: "This request has already been handled." }, { status: 400 });
  }

  if (action === "approve") {
    const { error: thresholdError } = await admin
      .from("maintenance_types")
      .update({ threshold_days: approval.proposed_threshold_days })
      .eq("id", approval.maintenance_type_id);

    if (thresholdError) {
      return NextResponse.json({ error: thresholdError.message }, { status: 400 });
    }
  }

  const { error: approvalUpdateError } = await admin
    .from("maintenance_threshold_approvals")
    .update({
      status: action === "approve" ? "approved" : "rejected",
      decided_by: auth.userId,
      decided_at: new Date().toISOString()
    })
    .eq("id", approval.id);

  if (approvalUpdateError) {
    return NextResponse.json({ error: approvalUpdateError.message }, { status: 400 });
  }

  const typeName = ((approval.maintenance_type as { name?: string } | null)?.name ?? "Maintenance type").toString();

  return NextResponse.json({
    mode: "live",
    message:
      action === "approve"
        ? `${typeName} threshold updated to ${approval.proposed_threshold_days} days.`
        : `${typeName} threshold request rejected.`
  });
}

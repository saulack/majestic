import { NextResponse } from "next/server";
import { requireAuthenticated } from "@/lib/admin-auth";
import { getAuthenticatedUserProfile } from "@/lib/live-data";
import { createAdminClient } from "@/lib/supabase/admin";

type ThresholdRequestInput = {
  maintenanceTypeId?: string;
  thresholdDays?: number | string;
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

  const body = (await request.json()) as ThresholdRequestInput;
  const maintenanceTypeId = body.maintenanceTypeId?.trim() ?? "";
  const thresholdDaysValue = Number(body.thresholdDays);
  const thresholdDays = Number.isFinite(thresholdDaysValue) ? Math.max(1, Math.floor(thresholdDaysValue)) : NaN;

  if (!maintenanceTypeId || !Number.isFinite(thresholdDays)) {
    return NextResponse.json({ error: "Maintenance type and threshold days are required." }, { status: 400 });
  }

  const { data: maintenanceType, error: maintenanceTypeError } = await admin
    .from("maintenance_types")
    .select("id,name")
    .eq("id", maintenanceTypeId)
    .single();

  if (maintenanceTypeError || !maintenanceType) {
    return NextResponse.json({ error: "Maintenance type not found." }, { status: 404 });
  }

  const profile = await getAuthenticatedUserProfile();

  if (!profile) {
    return NextResponse.json({ error: "Unable to resolve current user profile." }, { status: 403 });
  }

  if (profile.role === "superadmin") {
    const { error: updateError } = await admin
      .from("maintenance_types")
      .update({ threshold_days: thresholdDays })
      .eq("id", maintenanceTypeId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 400 });
    }

    return NextResponse.json({
      mode: "live",
      message: `${maintenanceType.name} threshold updated to ${thresholdDays} days.`
    });
  }

  const { data: pendingApproval } = await admin
    .from("maintenance_threshold_approvals")
    .select("id")
    .eq("maintenance_type_id", maintenanceTypeId)
    .eq("requested_by", auth.userId)
    .eq("status", "pending")
    .maybeSingle();

  if (pendingApproval?.id) {
    const { error: updateApprovalError } = await admin
      .from("maintenance_threshold_approvals")
      .update({ proposed_threshold_days: thresholdDays, created_at: new Date().toISOString() })
      .eq("id", pendingApproval.id);

    if (updateApprovalError) {
      return NextResponse.json({ error: updateApprovalError.message }, { status: 400 });
    }
  } else {
    const { error: insertError } = await admin.from("maintenance_threshold_approvals").insert({
      maintenance_type_id: maintenanceTypeId,
      proposed_threshold_days: thresholdDays,
      requested_by: auth.userId,
      status: "pending"
    });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 400 });
    }
  }

  return NextResponse.json({
    mode: "live",
    message: `Threshold change is pending approval from the site administrator.`
  });
}

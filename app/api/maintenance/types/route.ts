import { NextResponse } from "next/server";
import { requireAuthenticated } from "@/lib/admin-auth";
import { getAuthenticatedUserProfile } from "@/lib/live-data";
import { createAdminClient } from "@/lib/supabase/admin";

type MaintenanceTypeInput = {
  name?: string;
  thresholdDays?: number | string;
};

export async function POST(request: Request) {
  const auth = await requireAuthenticated();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 403 });
  }

  const profile = await getAuthenticatedUserProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unable to resolve current user profile." }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Supabase is not configured on the server." }, { status: 500 });
  }

  const body = (await request.json()) as MaintenanceTypeInput;
  const name = body.name?.trim() ?? "";
  const thresholdDaysValue = Number(body.thresholdDays);
  const thresholdDays = Number.isFinite(thresholdDaysValue) ? Math.max(1, Math.floor(thresholdDaysValue)) : NaN;

  if (!name || !Number.isFinite(thresholdDays)) {
    return NextResponse.json({ error: "Name and threshold days are required." }, { status: 400 });
  }

  const { data: existingType } = await admin
    .from("maintenance_types")
    .select("id,name")
    .ilike("name", name)
    .maybeSingle();

  if (existingType) {
    return NextResponse.json({ error: "A maintenance type with that name already exists." }, { status: 409 });
  }

  const directThreshold = profile.role === "superadmin" ? thresholdDays : 30;
  const { data, error } = await admin
    .from("maintenance_types")
    .insert({
      name,
      threshold_days: directThreshold,
      created_by: auth.userId
    })
    .select("id,name,threshold_days,created_by,created_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to create maintenance type." }, { status: 400 });
  }

  let message = `${data.name} added.`;
  if (profile.role !== "superadmin" && thresholdDays !== directThreshold) {
    const { data: pendingApproval } = await admin
      .from("maintenance_threshold_approvals")
      .select("id")
      .eq("maintenance_type_id", data.id)
      .eq("requested_by", auth.userId)
      .eq("status", "pending")
      .maybeSingle();

    if (pendingApproval?.id) {
      await admin
        .from("maintenance_threshold_approvals")
        .update({ proposed_threshold_days: thresholdDays, created_at: new Date().toISOString() })
        .eq("id", pendingApproval.id);
    } else {
      await admin.from("maintenance_threshold_approvals").insert({
        maintenance_type_id: data.id,
        proposed_threshold_days: thresholdDays,
        requested_by: auth.userId,
        status: "pending"
      });
    }

    message = `${data.name} added with a default threshold of 30 days. Your ${thresholdDays}-day threshold request is pending site-admin approval.`;
  }

  return NextResponse.json({
    mode: "live",
    message,
    maintenanceType: {
      id: data.id,
      name: data.name,
      thresholdDays: data.threshold_days,
      createdByUserId: data.created_by ?? undefined,
      createdAt: data.created_at
    }
  });
}

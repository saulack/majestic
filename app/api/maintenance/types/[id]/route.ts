import { NextResponse } from "next/server";
import { requireAuthenticated } from "@/lib/admin-auth";
import { getAuthenticatedUserProfile } from "@/lib/live-data";
import { createAdminClient } from "@/lib/supabase/admin";

type MaintenanceTypeInput = {
  name?: string;
  thresholdDays?: number | string;
};

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
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

  const resolvedParams = await params;
  const typeId = resolvedParams.id.trim();
  if (!typeId) {
    return NextResponse.json({ error: "Maintenance type ID is required." }, { status: 400 });
  }

  const body = (await request.json()) as MaintenanceTypeInput;
  const name = body.name?.trim();
  const thresholdDaysValue = body.thresholdDays ? Number(body.thresholdDays) : null;
  const thresholdDays = thresholdDaysValue !== null && Number.isFinite(thresholdDaysValue) ? Math.max(1, Math.floor(thresholdDaysValue)) : null;

  if (!name && thresholdDays === null) {
    return NextResponse.json({ error: "At least one field (name or thresholdDays) is required." }, { status: 400 });
  }

  // Fetch the existing type
  const { data: existingType, error: fetchError } = await admin
    .from("maintenance_types")
    .select("id,name,threshold_days")
    .eq("id", typeId)
    .single();

  if (fetchError || !existingType) {
    return NextResponse.json({ error: "Maintenance type not found." }, { status: 404 });
  }

  // If name is being changed, check for duplicates
  if (name && name.toLowerCase() !== existingType.name.toLowerCase()) {
    const { data: duplicateType } = await admin
      .from("maintenance_types")
      .select("id")
      .ilike("name", name)
      .neq("id", typeId)
      .maybeSingle();

    if (duplicateType) {
      return NextResponse.json({ error: "A maintenance type with that name already exists." }, { status: 409 });
    }
  }

  // Build update object
  const updateData: Record<string, unknown> = {};
  if (name) {
    updateData.name = name;
  }

  // Handle threshold changes
  if (thresholdDays !== null && thresholdDays !== existingType.threshold_days) {
    if (profile.role === "superadmin") {
      // Superadmin can change directly
      updateData.threshold_days = thresholdDays;
    } else {
      // Non-superadmin needs to submit a threshold request
      const { data: existingPending } = await admin
        .from("maintenance_threshold_approvals")
        .select("id")
        .eq("maintenance_type_id", typeId)
        .eq("requested_by", auth.userId)
        .eq("status", "pending")
        .maybeSingle();

      if (existingPending?.id) {
        await admin
          .from("maintenance_threshold_approvals")
          .update({ proposed_threshold_days: thresholdDays, created_at: new Date().toISOString() })
          .eq("id", existingPending.id);
      } else {
        await admin.from("maintenance_threshold_approvals").insert({
          maintenance_type_id: typeId,
          proposed_threshold_days: thresholdDays,
          requested_by: auth.userId,
          status: "pending"
        });
      }
    }
  }

  // Update the maintenance type
  const { data: updated, error: updateError } = await admin
    .from("maintenance_types")
    .update(updateData)
    .eq("id", typeId)
    .select("id,name,threshold_days,created_by,created_at")
    .single();

  if (updateError || !updated) {
    return NextResponse.json({ error: updateError?.message ?? "Failed to update maintenance type." }, { status: 400 });
  }

  let message = `${updated.name} updated.`;
  if (thresholdDays !== null && thresholdDays !== existingType.threshold_days && profile.role !== "superadmin") {
    message = `${updated.name} updated. Your ${thresholdDays}-day threshold change is pending site-admin approval.`;
  }

  return NextResponse.json({
    message,
    maintenanceType: {
      id: updated.id,
      name: updated.name,
      thresholdDays: updated.threshold_days,
      createdByUserId: updated.created_by ?? undefined,
      createdAt: updated.created_at
    }
  });
}

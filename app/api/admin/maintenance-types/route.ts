import { NextResponse } from "next/server";
import { requireAdminLike } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

type MaintenanceTypeInput = {
  name?: string;
  thresholdDays?: number | string;
};

export async function POST(request: Request) {
  const auth = await requireAdminLike();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 403 });
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

  const { data, error } = await admin
    .from("maintenance_types")
    .insert({
      name,
      threshold_days: thresholdDays,
      created_by: auth.userId
    })
    .select("id,name,threshold_days,created_by,created_at")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to create maintenance type." }, { status: 400 });
  }

  return NextResponse.json({
    mode: "live",
    message: `${data.name} added.`,
    maintenanceType: {
      id: data.id,
      name: data.name,
      thresholdDays: data.threshold_days,
      createdByUserId: data.created_by ?? undefined,
      createdAt: data.created_at
    }
  });
}

type MaintenanceTypeDeleteInput = {
  maintenanceTypeId?: string;
};

export async function DELETE(request: Request) {
  const auth = await requireAdminLike();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Supabase is not configured on the server." }, { status: 500 });
  }

  const body = (await request.json()) as MaintenanceTypeDeleteInput;
  const maintenanceTypeId = body.maintenanceTypeId?.trim() ?? "";

  if (!maintenanceTypeId) {
    return NextResponse.json({ error: "Maintenance type is required." }, { status: 400 });
  }

  const { data: foundType, error: findError } = await admin
    .from("maintenance_types")
    .select("id,name")
    .eq("id", maintenanceTypeId)
    .single();

  if (findError || !foundType) {
    return NextResponse.json({ error: "Maintenance type not found." }, { status: 404 });
  }

  const { error: deleteError } = await admin.from("maintenance_types").delete().eq("id", maintenanceTypeId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  await admin
    .from("info_contacts")
    .update({ is_maintenance: false, maintenance_category: null })
    .ilike("maintenance_category", foundType.name);

  return NextResponse.json({
    mode: "live",
    message: `${foundType.name} removed from maintenance categories.`
  });
}
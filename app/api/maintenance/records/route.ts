import { NextResponse } from "next/server";
import { requireAuthenticated } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

type MaintenanceRecordInput = {
  maintenanceTypeId?: string;
  scheduledFor?: string;
};

type MaintenanceRecordDeleteInput = {
  recordId?: string;
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

  const body = (await request.json()) as MaintenanceRecordInput;
  const maintenanceTypeId = body.maintenanceTypeId?.trim() ?? "";
  const scheduledFor = body.scheduledFor?.trim() ?? "";

  if (!maintenanceTypeId || !scheduledFor) {
    return NextResponse.json({ error: "Maintenance type and date are required." }, { status: 400 });
  }

  const { data, error } = await admin
    .from("maintenance_records")
    .insert({
      maintenance_type_id: maintenanceTypeId,
      scheduled_for: scheduledFor,
      created_by: auth.userId
    })
    .select(`
      id,
      scheduled_for,
      created_by,
      created_at,
      maintenance_type:maintenance_types!maintenance_records_maintenance_type_id_fkey(id,name),
      creator:profiles!maintenance_records_created_by_fkey(full_name)
    `)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to save maintenance record." }, { status: 400 });
  }

  return NextResponse.json(
    {
      mode: "live",
      message: `${((data.creator as unknown as { full_name: string } | null)?.full_name) ?? "A user"} has scheduled ${((data.maintenance_type as unknown as { name: string } | null)?.name ?? "maintenance")} for ${data.scheduled_for}.`,
      record: {
        id: data.id,
        typeId: ((data.maintenance_type as unknown as { id: string; name: string } | null)?.id) ?? maintenanceTypeId,
        typeName: ((data.maintenance_type as unknown as { id: string; name: string } | null)?.name) ?? "Unknown",
        scheduledFor: data.scheduled_for,
        createdByUserId: data.created_by,
        createdByName: ((data.creator as unknown as { full_name: string } | null)?.full_name) ?? "Unknown",
        createdAt: data.created_at
      }
    },
    { status: 201 }
  );
}

export async function DELETE(request: Request) {
  const auth = await requireAuthenticated();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Supabase is not configured on the server." }, { status: 500 });
  }

  const body = (await request.json()) as MaintenanceRecordDeleteInput;
  const recordId = body.recordId?.trim() ?? "";

  if (!recordId) {
    return NextResponse.json({ error: "Record id is required." }, { status: 400 });
  }

  const today = new Date().toISOString().slice(0, 10);
  const { data: existingRecord, error: existingError } = await admin
    .from("maintenance_records")
    .select("id,created_by,scheduled_for")
    .eq("id", recordId)
    .maybeSingle();

  if (existingError || !existingRecord) {
    return NextResponse.json({ error: "Maintenance booking not found." }, { status: 404 });
  }

  if (existingRecord.created_by !== auth.userId) {
    return NextResponse.json({ error: "You can only cancel your own maintenance bookings." }, { status: 403 });
  }

  if (existingRecord.scheduled_for < today) {
    return NextResponse.json({ error: "Past maintenance bookings cannot be canceled." }, { status: 400 });
  }

  const { error: deleteError } = await admin.from("maintenance_records").delete().eq("id", recordId).eq("created_by", auth.userId);

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 400 });
  }

  return NextResponse.json({ mode: "live", message: "Maintenance booking canceled.", recordId });
}
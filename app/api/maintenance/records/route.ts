import { NextResponse } from "next/server";
import { requireAuthenticated } from "@/lib/admin-auth";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type MaintenanceRecordInput = {
  maintenanceTypeId?: string;
  scheduledFor?: string;
};

export async function POST(request: Request) {
  const auth = await requireAuthenticated();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 403 });
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured on the server." }, { status: 500 });
  }

  const body = (await request.json()) as MaintenanceRecordInput;
  const maintenanceTypeId = body.maintenanceTypeId?.trim() ?? "";
  const scheduledFor = body.scheduledFor?.trim() ?? "";

  if (!maintenanceTypeId || !scheduledFor) {
    return NextResponse.json({ error: "Maintenance type and date are required." }, { status: 400 });
  }

  const { data, error } = await supabase
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
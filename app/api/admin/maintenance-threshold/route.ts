import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

type MaintenanceThresholdInput = {
  maintenanceTypeId?: string;
  thresholdDays?: number | string;
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

  const body = (await request.json()) as MaintenanceThresholdInput;
  const maintenanceTypeId = body.maintenanceTypeId?.trim() ?? "";
  const thresholdDaysValue = Number(body.thresholdDays);
  const thresholdDays = Number.isFinite(thresholdDaysValue) ? Math.max(1, Math.floor(thresholdDaysValue)) : NaN;

  if (!maintenanceTypeId || !Number.isFinite(thresholdDays)) {
    return NextResponse.json({ error: "Maintenance type and threshold days are required." }, { status: 400 });
  }

  const { data, error } = await admin
    .from("maintenance_types")
    .update({ threshold_days: thresholdDays })
    .eq("id", maintenanceTypeId)
    .select("id,name,threshold_days")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to update threshold." }, { status: 400 });
  }

  return NextResponse.json({
    mode: "live",
    message: `${data.name} threshold updated to ${data.threshold_days} days.`,
    maintenanceType: {
      id: data.id,
      name: data.name,
      thresholdDays: data.threshold_days
    }
  });
}
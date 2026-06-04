import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

type MaintenanceTypeInput = {
  name?: string;
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
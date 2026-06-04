import { NextResponse } from "next/server";
import { requireAuthenticated } from "@/lib/admin-auth";
import { getAuthenticatedUserProfile } from "@/lib/live-data";
import { createAdminClient } from "@/lib/supabase/admin";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ContactInput = {
  name?: string;
  number?: string;
  email?: string;
  address?: string;
  function?: string;
  isStaff?: boolean;
  isMaintenance?: boolean;
  maintenanceCategory?: string;
  maintenanceThresholdDays?: number | string;
};

export async function GET() {
  const auth = await requireAuthenticated();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 403 });
  }

  const supabase = await createServerSupabaseClient();
  if (!supabase) {
    return NextResponse.json({ error: "Supabase is not configured on the server." }, { status: 500 });
  }

  const { data, error } = await supabase
    .from("info_contacts")
    .select("id,name,number,email,address,role_function,is_staff,is_maintenance,maintenance_category")
    .order("name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const contacts = (data ?? []).map((entry) => ({
    id: entry.id,
    name: entry.name,
    number: entry.number,
    email: entry.email,
    address: entry.address,
    function: entry.role_function,
    isStaff: entry.is_staff,
    isMaintenance: entry.is_maintenance,
    maintenanceCategory: entry.maintenance_category ?? undefined
  }));

  return NextResponse.json({ mode: "live", contacts });
}

export async function POST(request: Request) {
  const auth = await requireAuthenticated();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 403 });
  }

  const body = (await request.json()) as ContactInput;
  const name = body.name?.trim() ?? "";
  const roleFunction = body.function?.trim() ?? "";
  const number = body.number?.trim() ?? "";
  const email = body.email?.trim() ?? "";
  const address = body.address?.trim() ?? "";
  const isMaintenance = Boolean(body.isMaintenance);
  const maintenanceCategory = (body.maintenanceCategory?.trim() ?? roleFunction).trim();
  const thresholdDaysValue = Number(body.maintenanceThresholdDays);
  const maintenanceThresholdDays = Number.isFinite(thresholdDaysValue) ? Math.max(1, Math.floor(thresholdDaysValue)) : 30;

  if (!name || !roleFunction) {
    return NextResponse.json({ error: "Name and function are required." }, { status: 400 });
  }

  if (!number && !email && !address) {
    return NextResponse.json({ error: "Please provide at least one contact field: phone, email, or address." }, { status: 400 });
  }

  if (isMaintenance && !maintenanceCategory) {
    return NextResponse.json({ error: "Maintenance category is required for maintenance contacts." }, { status: 400 });
  }

  const profile = await getAuthenticatedUserProfile();
  if (!profile) {
    return NextResponse.json({ error: "Unable to resolve current user profile." }, { status: 403 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ error: "Supabase is not configured on the server." }, { status: 500 });
  }

  const { data, error } = await admin
    .from("info_contacts")
    .insert({
      name,
      number,
      email,
      address,
      role_function: roleFunction,
      is_staff: Boolean(body.isStaff),
      is_maintenance: isMaintenance,
      maintenance_category: isMaintenance ? maintenanceCategory : null,
      created_by: auth.userId
    })
    .select("id,name,number,email,address,role_function,is_staff,is_maintenance,maintenance_category")
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "Failed to create contact." }, { status: 400 });
  }

  if (isMaintenance) {
    const { data: existingType } = await admin
      .from("maintenance_types")
      .select("id,threshold_days")
      .ilike("name", maintenanceCategory)
      .maybeSingle();

    let maintenanceTypeId = existingType?.id;

    if (!existingType) {
      const { data: createdType } = await admin
        .from("maintenance_types")
        .insert({
        name: maintenanceCategory,
        threshold_days: 30,
        created_by: auth.userId
        })
        .select("id")
        .single();

      maintenanceTypeId = createdType?.id;
    }

    if (maintenanceTypeId) {
      if (profile.role === "superadmin") {
        await admin.from("maintenance_types").update({ threshold_days: maintenanceThresholdDays }).eq("id", maintenanceTypeId);
      } else {
        const { data: pendingApproval } = await admin
          .from("maintenance_threshold_approvals")
          .select("id")
          .eq("maintenance_type_id", maintenanceTypeId)
          .eq("requested_by", auth.userId)
          .eq("status", "pending")
          .maybeSingle();

        if (pendingApproval?.id) {
          await admin
            .from("maintenance_threshold_approvals")
            .update({ proposed_threshold_days: maintenanceThresholdDays, created_at: new Date().toISOString() })
            .eq("id", pendingApproval.id);
        } else {
          await admin.from("maintenance_threshold_approvals").insert({
            maintenance_type_id: maintenanceTypeId,
            proposed_threshold_days: maintenanceThresholdDays,
            requested_by: auth.userId,
            status: "pending"
          });
        }
      }
    }
  }

  const maintenanceMessage =
    isMaintenance && profile.role !== "superadmin"
      ? "Threshold change is pending approval from the site administrator."
      : undefined;

  return NextResponse.json(
    {
      mode: "live",
      message: maintenanceMessage,
      contact: {
        id: data.id,
        name: data.name,
        number: data.number,
        email: data.email,
        address: data.address,
        function: data.role_function,
        isStaff: data.is_staff,
        isMaintenance: data.is_maintenance,
        maintenanceCategory: data.maintenance_category ?? undefined
      }
    },
    { status: 201 }
  );
}

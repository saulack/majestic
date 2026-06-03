import { NextResponse } from "next/server";
import { requireSuperadmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  const auth = await requireSuperadmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: 403 });
  }

  const body = (await request.json()) as { userId?: string };
  const userId = body.userId?.trim();

  if (!userId) {
    return NextResponse.json({ error: "User id is required." }, { status: 400 });
  }

  if (userId === auth.userId) {
    return NextResponse.json({ error: "Superadmin cannot delete self." }, { status: 400 });
  }

  const admin = createAdminClient();
  if (!admin) {
    return NextResponse.json({ mode: "mock", message: `Mock delete prepared for ${userId}.` });
  }

  const { error } = await admin.auth.admin.deleteUser(userId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ mode: "live", message: "User deleted." });
}

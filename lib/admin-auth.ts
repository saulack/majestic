import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function requireAuthenticated(): Promise<{ ok: true; userId: string } | { ok: false; message: string }> {
  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    return { ok: false, message: "Supabase is not configured on the server." };
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, message: "You must be authenticated." };
  }

  return { ok: true, userId: user.id };
}

export async function requireSuperadmin(): Promise<{ ok: true; userId: string } | { ok: false; message: string }> {
  const supabase = await createServerSupabaseClient();

  if (!supabase) {
    return { ok: false, message: "Supabase is not configured on the server." };
  }

  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return { ok: false, message: "You must be authenticated." };
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile || profile.role !== "superadmin") {
    return { ok: false, message: "Only superadmin can manage accounts." };
  }

  return { ok: true, userId: user.id };
}

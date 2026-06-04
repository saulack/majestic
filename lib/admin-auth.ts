import { createServerSupabaseClient } from "@/lib/supabase/server";
import { getAuthenticatedUserProfile } from "@/lib/live-data";

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

  const profile = await getAuthenticatedUserProfile();

  if (!profile || profile.role !== "superadmin") {
    return { ok: false, message: "Only superadmin can manage accounts." };
  }

  return { ok: true, userId: user.id };
}

export async function requireAdminLike(): Promise<{ ok: true; userId: string } | { ok: false; message: string }> {
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

  const profile = await getAuthenticatedUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "superadmin")) {
    return { ok: false, message: "Only admins can manage maintenance categories." };
  }

  return { ok: true, userId: user.id };
}

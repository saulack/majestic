import { createAdminClient } from "@/lib/supabase/admin";

async function readAppSetting(key: string): Promise<unknown | null> {
  const admin = createAdminClient();
  if (!admin) {
    return null;
  }

  const { data, error } = await admin.from("app_settings").select("value").eq("key", key).maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.value;
}

export async function getBooleanAppSetting(key: string, fallback = false): Promise<boolean> {
  const value = await readAppSetting(key);
  return typeof value === "boolean" ? value : fallback;
}

export async function getNumberAppSetting(key: string, fallback: number): Promise<number> {
  const value = await readAppSetting(key);
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

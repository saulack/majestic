import { createBrowserClient } from "@supabase/ssr";

export function getMissingSupabasePublicEnvVars(): string[] {
  const missing: string[] = [];

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    missing.push("NEXT_PUBLIC_SUPABASE_URL");
  }

  if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    missing.push("NEXT_PUBLIC_SUPABASE_ANON_KEY");
  }

  return missing;
}

export function createClient() {
  const missing = getMissingSupabasePublicEnvVars();

  if (missing.length > 0) {
    return null;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

  return createBrowserClient(url, anonKey);
}

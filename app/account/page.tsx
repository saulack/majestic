import { AccountClientPage } from "@/app/account/account-client";
import { currentUser, mockPreferences } from "@/lib/mock-data";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";
import { getEffectiveUser, getRolePreviewFromCookieValue } from "@/lib/role-preview";

export default async function AccountPage() {
  const cookieStore = await cookies();
  const previewRole = getRolePreviewFromCookieValue(cookieStore.get("majestic-role-preview")?.value ?? null);
  const supabase = await createServerSupabaseClient();
  let user = getEffectiveUser(currentUser, previewRole);

  if (supabase) {
    const {
      data: { user: authUser }
    } = await supabase.auth.getUser();

    if (authUser) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("id,full_name,email,role")
        .eq("id", authUser.id)
        .maybeSingle();

      if (profile) {
        user = getEffectiveUser(
          {
            id: profile.id,
            fullName: profile.full_name,
            email: profile.email,
            role: profile.role
          },
          previewRole
        );
      }
    }
  }

  const preferences = mockPreferences.find((item) => item.userId === user.id);

  return <AccountClientPage user={user} preferences={preferences} />;
}

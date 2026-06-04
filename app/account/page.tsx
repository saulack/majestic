import { AccountClientPage } from "@/app/account/account-client";
import { getAuthenticatedUserProfile, getNotificationPreference } from "@/lib/live-data";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getEffectiveUser, getRolePreviewFromCookieValue } from "@/lib/role-preview";

export default async function AccountPage() {
  const cookieStore = await cookies();
  const previewRole = getRolePreviewFromCookieValue(cookieStore.get("majestic-role-preview")?.value ?? null);
  const profile = await getAuthenticatedUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const user = getEffectiveUser(profile, previewRole);
  const preferences = await getNotificationPreference(user.id);

  return <AccountClientPage user={user} preferences={preferences} previewRole={previewRole} />;
}

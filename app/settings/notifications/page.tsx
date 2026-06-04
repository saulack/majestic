import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAuthenticatedUserProfile } from "@/lib/live-data";
import { getEffectiveUser, getRolePreviewFromCookieValue } from "@/lib/role-preview";
import { isSuperadmin } from "@/lib/rbac";

export default async function NotificationsPage() {
  const cookieStore = await cookies();
  const previewRole = getRolePreviewFromCookieValue(cookieStore.get("majestic-role-preview")?.value ?? null);
  const profile = await getAuthenticatedUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const effectiveUser = getEffectiveUser(profile, previewRole);

  if (!isSuperadmin(effectiveUser)) {
    redirect("/");
  }

  redirect("/admin");
}

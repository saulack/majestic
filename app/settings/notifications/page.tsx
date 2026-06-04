import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/mock-data";
import { getEffectiveUser, getRolePreviewFromCookieValue } from "@/lib/role-preview";
import { isSuperadmin } from "@/lib/rbac";

export default async function NotificationsPage() {
  const cookieStore = await cookies();
  const previewRole = getRolePreviewFromCookieValue(cookieStore.get("majestic-role-preview")?.value ?? null);
  const effectiveUser = getEffectiveUser(currentUser, previewRole);

  if (!isSuperadmin(effectiveUser)) {
    redirect("/");
  }

  redirect("/admin");
}

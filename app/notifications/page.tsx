import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getAuthenticatedUserProfile, getInAppNotificationsForUser } from "@/lib/live-data";
import { getEffectiveUser, getRolePreviewFromCookieValue } from "@/lib/role-preview";
import { NotificationsFeedClient } from "@/app/notifications/notifications-feed-client";

export default async function NotificationsPage() {
  const cookieStore = await cookies();
  const previewRole = getRolePreviewFromCookieValue(cookieStore.get("majestic-role-preview")?.value ?? null);
  const profile = await getAuthenticatedUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const actingUser = getEffectiveUser(profile, previewRole);
  const notifications = await getInAppNotificationsForUser(actingUser.id);

  return (
    <AppShell initialRole={actingUser.role} initialPreviewRole={previewRole}>
      <NotificationsFeedClient initialNotifications={notifications} />
    </AppShell>
  );
}

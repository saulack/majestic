import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FeatureQueueClient } from "@/app/feature-queue/feature-queue-client";
import { getAuthenticatedUserProfile, getQueuedFeatureRequests } from "@/lib/live-data";
import { getEffectiveUser, getRolePreviewFromCookieValue } from "@/lib/role-preview";
import { isSuperadmin } from "@/lib/rbac";

export default async function FeatureQueuePage() {
  const cookieStore = await cookies();
  const previewRole = getRolePreviewFromCookieValue(cookieStore.get("majestic-role-preview")?.value ?? null);
  const profile = await getAuthenticatedUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const actingUser = getEffectiveUser(profile, previewRole);
  if (!isSuperadmin(actingUser)) {
    redirect("/");
  }

  const requests = await getQueuedFeatureRequests();

  return (
    <AppShell initialRole={actingUser.role} initialPreviewRole={previewRole}>
      <FeatureQueueClient requests={requests} />
    </AppShell>
  );
}

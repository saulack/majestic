import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FeatureQueueClient } from "@/app/feature-queue/feature-queue-client";
import { getAllFeatureRequests, getAuthenticatedUserProfile, getFeatureRequestVoteCounts } from "@/lib/live-data";
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

  const [requests, voteCounts] = await Promise.all([getAllFeatureRequests(), getFeatureRequestVoteCounts()]);
  const hydratedRequests = requests.map((request) => ({
    ...request,
    voteCount: voteCounts[request.id] ?? 0
  }));

  return (
    <AppShell initialRole={actingUser.role} initialPreviewRole={previewRole}>
      <FeatureQueueClient requests={hydratedRequests} />
    </AppShell>
  );
}

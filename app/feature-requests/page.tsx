import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { FeatureRequestsClient } from "@/app/feature-requests/feature-requests-client";
import {
  getAllFeatureRequests,
  getAuthenticatedUserProfile,
  getFeatureRequestVoteCounts,
  getMyFeatureRequestVoteIds
} from "@/lib/live-data";
import { getEffectiveUser, getRolePreviewFromCookieValue } from "@/lib/role-preview";

export default async function FeatureRequestsPage() {
  const cookieStore = await cookies();
  const previewRole = getRolePreviewFromCookieValue(cookieStore.get("majestic-role-preview")?.value ?? null);
  const profile = await getAuthenticatedUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const actingUser = getEffectiveUser(profile, previewRole);
  const [requests, voteCounts, votedRequestIds] = await Promise.all([
    getAllFeatureRequests(),
    getFeatureRequestVoteCounts(),
    getMyFeatureRequestVoteIds(actingUser.id)
  ]);

  const hydratedRequests = requests.map((request) => ({
    ...request,
    voteCount: voteCounts[request.id] ?? 0,
    votedByCurrentUser: votedRequestIds.includes(request.id)
  }));

  return (
    <AppShell initialRole={actingUser.role} initialPreviewRole={previewRole}>
      <FeatureRequestsClient requests={hydratedRequests} actingUserId={actingUser.id} />
    </AppShell>
  );
}

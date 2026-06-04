import { cookies } from "next/headers";
import { StatsClientPage } from "@/app/stats/stats-client";
import { getAllReservations, getAuthenticatedUserProfile } from "@/lib/live-data";
import { redirect } from "next/navigation";
import { getEffectiveUser, getRolePreviewFromCookieValue } from "@/lib/role-preview";

export default async function StatsPage() {
  const cookieStore = await cookies();
  const previewRole = getRolePreviewFromCookieValue(cookieStore.get("majestic-role-preview")?.value ?? null);
  const profile = await getAuthenticatedUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const actingUser = getEffectiveUser(profile, previewRole);
  const reservations = await getAllReservations();

  return <StatsClientPage actingUser={actingUser} reservations={reservations} previewRole={previewRole} />;
}

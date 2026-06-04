import { cookies } from "next/headers";
import { StatsClientPage } from "@/app/stats/stats-client";
import { currentUser, mockReservations } from "@/lib/mock-data";
import { getEffectiveUser, getRolePreviewFromCookieValue } from "@/lib/role-preview";

export default async function StatsPage() {
  const cookieStore = await cookies();
  const previewRole = getRolePreviewFromCookieValue(cookieStore.get("majestic-role-preview")?.value ?? null);
  const actingUser = getEffectiveUser(currentUser, previewRole);

  return <StatsClientPage actingUser={actingUser} reservations={mockReservations} />;
}

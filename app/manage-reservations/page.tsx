import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ManageReservationsClient } from "@/app/manage-reservations/manage-reservations-client";
import { getAuthenticatedUserProfile, getReservationsForUser } from "@/lib/live-data";
import { getEffectiveUser, getRolePreviewFromCookieValue } from "@/lib/role-preview";

export default async function ManageReservationsPage() {
  const cookieStore = await cookies();
  const previewRole = getRolePreviewFromCookieValue(cookieStore.get("majestic-role-preview")?.value ?? null);
  const profile = await getAuthenticatedUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const actingUser = getEffectiveUser(profile, previewRole);
  const reservations = await getReservationsForUser(actingUser.id);

  return (
    <AppShell initialRole={actingUser.role} initialPreviewRole={previewRole}>
      <ManageReservationsClient initialReservations={reservations} />
    </AppShell>
  );
}

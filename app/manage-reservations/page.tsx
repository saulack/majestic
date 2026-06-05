import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ManageReservationsClient } from "@/app/manage-reservations/manage-reservations-client";
import { getAllProfiles, getAllReservations, getAuthenticatedUserProfile, getReservationsForUser } from "@/lib/live-data";
import { getEffectiveUser, getRolePreviewFromCookieValue } from "@/lib/role-preview";

export default async function ManageReservationsPage() {
  const cookieStore = await cookies();
  const previewRole = getRolePreviewFromCookieValue(cookieStore.get("majestic-role-preview")?.value ?? null);
  const profile = await getAuthenticatedUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const actingUser = getEffectiveUser(profile, previewRole);
  const isSuperadmin = actingUser.role === "superadmin";
  const [myReservations, allReservations, profiles] = await Promise.all([
    getReservationsForUser(actingUser.id),
    isSuperadmin ? getAllReservations() : Promise.resolve([]),
    getAllProfiles()
  ]);
  const otherReservations = isSuperadmin ? allReservations.filter((reservation) => reservation.userId !== actingUser.id) : [];

  const userNameById = Object.fromEntries(profiles.map((entry) => [entry.id, entry.fullName]));
  const userOptions = profiles.map((entry) => ({ id: entry.id, fullName: entry.fullName }));

  return (
    <AppShell initialRole={actingUser.role} initialPreviewRole={previewRole}>
      <ManageReservationsClient
        initialMyReservations={myReservations}
        initialOtherReservations={otherReservations}
        isSuperadmin={isSuperadmin}
        userNameById={userNameById}
        userOptions={userOptions}
      />
    </AppShell>
  );
}

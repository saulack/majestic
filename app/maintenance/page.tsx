import { AppShell } from "@/components/app-shell";
import { MaintenanceClientPage } from "@/app/maintenance/maintenance-client";
import { getAuthenticatedUserProfile, getMaintenanceRecords, getMaintenanceTypes, getPendingMaintenanceThresholdApprovals } from "@/lib/live-data";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getEffectiveUser, getRolePreviewFromCookieValue } from "@/lib/role-preview";

export default async function MaintenancePage() {
  const cookieStore = await cookies();
  const previewRole = getRolePreviewFromCookieValue(cookieStore.get("majestic-role-preview")?.value ?? null);
  const profile = await getAuthenticatedUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const [maintenanceTypes, maintenanceRecords, pendingThresholdApprovals] = await Promise.all([
    getMaintenanceTypes(),
    getMaintenanceRecords(),
    getPendingMaintenanceThresholdApprovals()
  ]);
  const actingUser = getEffectiveUser(profile, previewRole);
  const myPendingThresholdApprovals = pendingThresholdApprovals.filter((approval) => approval.requestedByUserId === profile.id);

  return (
    <AppShell initialRole={actingUser.role} initialPreviewRole={previewRole}>
      <MaintenanceClientPage
        actingUser={actingUser}
        maintenanceTypes={maintenanceTypes}
        initialRecords={maintenanceRecords}
        initialPendingThresholdApprovals={myPendingThresholdApprovals}
      />
    </AppShell>
  );
}
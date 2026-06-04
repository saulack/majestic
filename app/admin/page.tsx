import { AppShell } from "@/components/app-shell";
import { AdminConsole } from "@/app/admin/admin-console";
import { getNumberAppSetting } from "@/lib/app-settings";
import { getReservationApprovalsEnabled, HOMEPAGE_RESERVATIONS_COUNT_KEY } from "@/lib/feature-flags";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UserProfile } from "@/lib/types";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getEffectiveUser, getRolePreviewFromCookieValue } from "@/lib/role-preview";
import { isSuperadmin } from "@/lib/rbac";
import {
  getAuthenticatedUserProfile,
  getMaintenanceTypes,
  getPendingFeatureRequests,
  getPendingMaintenanceThresholdApprovals
} from "@/lib/live-data";

const DEFAULT_HOME_RESERVATION_COUNT = 5;

export default async function AdminPage() {
  const cookieStore = await cookies();
  const previewRole = getRolePreviewFromCookieValue(cookieStore.get("majestic-role-preview")?.value ?? null);
  const profile = await getAuthenticatedUserProfile();

  if (!profile) {
    redirect("/login");
  }

  const effectiveUser = getEffectiveUser(profile, previewRole);

  if (!isSuperadmin(effectiveUser)) {
    redirect("/");
  }

  const approvalsEnabled = await getReservationApprovalsEnabled();
  const homepageReservationCount = await getNumberAppSetting(HOMEPAGE_RESERVATIONS_COUNT_KEY, DEFAULT_HOME_RESERVATION_COUNT);
  const admin = createAdminClient();
  const [maintenanceTypes, pendingThresholdApprovals, pendingFeatureRequests] = await Promise.all([
    getMaintenanceTypes(),
    getPendingMaintenanceThresholdApprovals(),
    getPendingFeatureRequests()
  ]);
  let users: UserProfile[] = [];

  if (admin) {
    const { data, error } = await admin
      .from("profiles")
      .select("id,full_name,email,role,force_password_reset")
      .order("full_name", { ascending: true });

    if (!error && data) {
      users = data.map((entry) => ({
        id: entry.id,
        fullName: entry.full_name,
        email: entry.email,
        role: entry.role,
        forcePasswordReset: entry.force_password_reset
      }));
    }
  }

  return (
    <AppShell initialRole={effectiveUser.role} initialPreviewRole={previewRole}>
      <section className="card mb-6 overflow-hidden p-0">
        <div className="bg-gradient-to-r from-[#65c2c0] via-[#7ac9dd] to-[#f7d89f] px-6 py-7 text-white">
          <p className="text-xs uppercase tracking-[0.3em] text-[#eefdf8]">Security</p>
          <h1 className="mt-2 text-3xl">Admin Area</h1>
          <p className="mt-2 max-w-3xl text-sm text-[#eefdf8]">
            Signed in as {profile.fullName}. Superadmin can create/delete accounts, preview lower roles, trigger password resets, and control shared app settings.
          </p>
        </div>
        <div className="px-6 py-4 text-sm text-slate-600">
          Preview mode hides this area unless your effective role is still superadmin.
        </div>
      </section>

      <section>
        <AdminConsole
          initialApprovalsEnabled={approvalsEnabled}
          initialHomepageReservationCount={homepageReservationCount}
          initialMaintenanceTypes={maintenanceTypes}
          initialThresholdApprovals={pendingThresholdApprovals}
          initialPendingFeatureRequests={pendingFeatureRequests}
          initialUsers={users}
          currentUserId={profile.id}
        />
      </section>
    </AppShell>
  );
}

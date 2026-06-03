import { AppShell } from "@/components/app-shell";
import { currentUser } from "@/lib/mock-data";
import { AdminConsole } from "@/app/admin/admin-console";
import { getNumberAppSetting } from "@/lib/app-settings";
import { getReservationApprovalsEnabled, HOMEPAGE_RESERVATIONS_COUNT_KEY } from "@/lib/feature-flags";

const DEFAULT_HOME_RESERVATION_COUNT = 5;

export default async function AdminPage() {
  const approvalsEnabled = await getReservationApprovalsEnabled();
  const homepageReservationCount = await getNumberAppSetting(HOMEPAGE_RESERVATIONS_COUNT_KEY, DEFAULT_HOME_RESERVATION_COUNT);

  return (
    <AppShell>
      <section className="card mb-6 p-6">
        <p className="text-xs uppercase tracking-[0.3em] text-amber-700">Security</p>
        <h1 className="mt-2 text-3xl">Admin Area</h1>
        <p className="mt-2 text-sm text-slate-600">
          Signed in as {currentUser.fullName}. Superadmin can create/delete accounts, turn reservation approvals on or off, and change how many upcoming reservations appear on the homepage.
        </p>
      </section>

      <AdminConsole initialApprovalsEnabled={approvalsEnabled} initialHomepageReservationCount={homepageReservationCount} />
    </AppShell>
  );
}

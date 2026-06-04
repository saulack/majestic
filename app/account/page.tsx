import { AppShell } from "@/components/app-shell";
import { BiometricAuthManager } from "@/app/account/biometric-auth-manager";
import { PasswordManager } from "@/app/account/password-manager";
import { currentUser, mockPreferences } from "@/lib/mock-data";

export default function AccountPage() {
  const preferences = mockPreferences.find((item) => item.userId === currentUser.id);

  return (
    <AppShell>
      <section className="card relative overflow-hidden p-5 sm:p-6">
        <h2 className="text-xl sm:text-2xl">My Account</h2>
        <p className="mt-2 text-sm text-slate-600">Edit your profile details and notification preferences.</p>

        <div className="mt-6 grid gap-5 sm:gap-6 lg:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4">
            <h3 className="text-lg font-semibold">Profile Details</h3>
            <form className="mt-4 grid gap-4 text-sm">
              <label className="grid gap-1.5 font-medium">
                <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Full name</span>
                <input defaultValue={currentUser.fullName} className="rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="grid gap-1.5 font-medium">
                <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Email</span>
                <input defaultValue={currentUser.email} className="rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <button type="button" className="w-fit rounded-lg bg-amber-700 px-4 py-2 text-white">
                Save profile
              </button>
            </form>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4">
            <h3 className="text-lg font-semibold">Notification Preferences</h3>
            <form className="mt-4 grid gap-4 text-sm">
              <label className="flex items-center gap-2">
                <input type="checkbox" defaultChecked={preferences?.channels.includes("email")} />
                Email
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" defaultChecked={preferences?.channels.includes("sms")} />
                SMS
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" defaultChecked={preferences?.channels.includes("whatsapp")} />
                WhatsApp
              </label>
              <button type="button" className="w-fit rounded-lg bg-amber-700 px-4 py-2 text-white">
                Save preferences
              </button>
            </form>
          </div>

          <PasswordManager />

          <BiometricAuthManager />
        </div>
      </section>
    </AppShell>
  );
}

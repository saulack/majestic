import { AppShell } from "@/components/app-shell";
import { BookOpen } from "lucide-react";
import { ContactsManager } from "@/app/info/contacts-manager";
import { AccessCodesManager } from "@/app/info/access-codes-manager";
import { EmergencyContactsManager } from "@/app/info/emergency-contacts-manager";
import { CheckoutChecklistManager } from "@/app/info/checkout-checklist-manager";

export default function InfoPage() {
  return (
    <AppShell>
      <section className="card p-6">
        <h2 className="text-2xl">Apartment Information</h2>
        <p className="mt-2 text-sm text-slate-600">
          Everything the family needs for the shared apartment: contacts, access details, and practical info.
        </p>

        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <ContactsManager />

          <AccessCodesManager />

          <EmergencyContactsManager />

          <CheckoutChecklistManager />

          <InfoCard
            icon={<BookOpen className="h-5 w-5 text-amber-700" />}
            iconBg="bg-amber-100"
            title="House Rules & Guidelines"
            description="Rules, check-in / check-out procedures, and any house guidelines will be listed here."
          />
        </div>
      </section>
    </AppShell>
  );
}

function InfoCard({
  icon,
  iconBg,
  title,
  description
}: {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-3">
        <span className={`rounded-lg p-2 ${iconBg}`}>{icon}</span>
        <h3 className="text-lg font-semibold">{title}</h3>
      </div>
      <p className="mt-3 text-sm text-slate-500 italic">{description}</p>
      <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-xs text-slate-400">
        Content coming soon
      </div>
    </div>
  );
}

import { AppShell } from "@/components/app-shell";
import { Users, Wifi, BookOpen, Phone } from "lucide-react";

export default function InfoPage() {
  return (
    <AppShell>
      <section className="card p-6">
        <h2 className="text-2xl">Apartment Information</h2>
        <p className="mt-2 text-sm text-slate-600">
          Everything the family needs for the shared apartment: contacts, access details, and practical info.
        </p>

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <InfoCard
            icon={<Users className="h-5 w-5 text-amber-700" />}
            iconBg="bg-amber-100"
            title="Contacts & Directory"
            description="Family members, assigned roles, and contact information will be listed here."
          />

          <InfoCard
            icon={<Wifi className="h-5 w-5 text-amber-700" />}
            iconBg="bg-amber-100"
            title="Wi-Fi & Access Codes"
            description="Network names, Wi-Fi passwords, door codes, and lock combinations will be listed here."
          />

          <InfoCard
            icon={<BookOpen className="h-5 w-5 text-amber-700" />}
            iconBg="bg-amber-100"
            title="House Rules & Guidelines"
            description="Rules, check-in / check-out procedures, and any house guidelines will be listed here."
          />

          <InfoCard
            icon={<Phone className="h-5 w-5 text-amber-700" />}
            iconBg="bg-amber-100"
            title="Emergency Contacts"
            description="Local emergency numbers, building super, and urgent repair contacts will be listed here."
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

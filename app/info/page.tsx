import { AppShell } from "@/components/app-shell";
import { BookOpen } from "lucide-react";
import { AccessCodesManager, type AccessCode } from "@/app/info/access-codes-manager";
import { CheckoutChecklistManager, type ChecklistItem } from "@/app/info/checkout-checklist-manager";
import { ContactsManager, type Contact } from "@/app/info/contacts-manager";
import { EmergencyContactsManager, type EmergencyContact } from "@/app/info/emergency-contacts-manager";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function InfoPage() {
  const supabase = await createServerSupabaseClient();
  let contacts: Contact[] = [];
  let accessCodes: AccessCode[] = [];
  let emergencyContacts: EmergencyContact[] = [];
  let checkoutItems: ChecklistItem[] = [];

  if (supabase) {
    const [contactsResult, accessCodesResult, emergencyResult, checkoutResult] = await Promise.all([
      supabase.from("info_contacts").select("id,name,number,email,address,role_function,is_staff").order("name", { ascending: true }),
      supabase.from("info_access_codes").select("id,title,passcode,location,notes").order("title", { ascending: true }),
      supabase.from("info_emergency_contacts").select("id,title,name,phone_number").order("title", { ascending: true }),
      supabase.from("info_checkout_items").select("id,text,done").order("created_at", { ascending: false })
    ]);

    if (!contactsResult.error && contactsResult.data) {
      contacts = contactsResult.data.map((entry) => ({
        id: entry.id,
        name: entry.name,
        number: entry.number,
        email: entry.email,
        address: entry.address,
        function: entry.role_function,
        isStaff: entry.is_staff
      }));
    }

    if (!accessCodesResult.error && accessCodesResult.data) {
      accessCodes = accessCodesResult.data;
    }

    if (!emergencyResult.error && emergencyResult.data) {
      emergencyContacts = emergencyResult.data.map((entry) => ({
        id: entry.id,
        title: entry.title,
        name: entry.name,
        phoneNumber: entry.phone_number
      }));
    }

    if (!checkoutResult.error && checkoutResult.data) {
      checkoutItems = checkoutResult.data;
    }
  }

  return (
    <AppShell>
      <section className="card p-6">
        <h2 className="text-2xl">Apartment Information</h2>
        <p className="mt-2 text-sm text-slate-600">
          Everything the family needs for the shared apartment: contacts, access details, and practical info.
        </p>

        <div className="mt-8 grid gap-6 xl:grid-cols-2">
          <ContactsManager initialContacts={contacts} />

          <AccessCodesManager initialAccessCodes={accessCodes} />

          <EmergencyContactsManager initialContacts={emergencyContacts} />

          <CheckoutChecklistManager initialItems={checkoutItems} />

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

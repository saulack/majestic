import { AppShell } from "@/components/app-shell";
import { currentUser, mockReservations, mockUsers } from "@/lib/mock-data";
import { canModerateReservation } from "@/lib/rbac";
import { hasDateConflict, totalDaysInReservation } from "@/lib/reservation-utils";

export default function ReservationsPage() {
  const hasConflictExample = hasDateConflict(mockReservations, "2026-07-10", "2026-07-14");

  return (
    <AppShell>
      <section className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="card p-6">
          <h2 className="text-2xl">Shared Reservation Timeline</h2>
          <p className="mt-2 text-sm text-slate-600">All authenticated users can view current and upcoming bookings.</p>

          <div className="mt-5 grid gap-3">
            {mockReservations.map((reservation) => (
              <article key={reservation.id} className="rounded-xl border border-slate-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold">{reservation.userName}</h3>
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800">
                    {totalDaysInReservation(reservation)} days
                  </span>
                </div>
                <p className="mt-1 text-sm text-slate-600">
                  {reservation.startDate} to {reservation.endDate}
                </p>
                <p className="mt-2">
                  <StatusBadge status={reservation.status} />
                </p>
                <p className="mt-2 text-sm text-slate-500">{reservation.notes || "No notes"}</p>
                {reservation.userId === currentUser.id ? (
                  <p className="mt-3 text-xs uppercase tracking-wide text-emerald-700">Editable by you</p>
                ) : canModerateReservation(
                    currentUser,
                    mockUsers.find((user) => user.id === reservation.userId) ?? currentUser,
                    reservation
                  ) ? (
                  <div className="mt-3 flex gap-2">
                    <button type="button" className="rounded-lg bg-emerald-700 px-3 py-1 text-xs text-white">
                      Approve
                    </button>
                    <button type="button" className="rounded-lg bg-rose-700 px-3 py-1 text-xs text-white">
                      Decline
                    </button>
                  </div>
                ) : (
                  <p className="mt-3 text-xs uppercase tracking-wide text-slate-500">
                    View only (admins cannot moderate each other)
                  </p>
                )}
              </article>
            ))}
          </div>
        </div>

        <aside className="card card-strong p-6">
          <h3 className="text-xl">Create Reservation</h3>
          <p className="mt-2 text-sm text-slate-600">Overlapping dates are automatically blocked.</p>

          <form className="mt-5 grid gap-3 text-sm">
            <label className="grid gap-2">
              Start date
              <input type="date" className="rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="grid gap-2">
              End date
              <input type="date" className="rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <label className="grid gap-2">
              Notes
              <textarea className="min-h-20 rounded-lg border border-slate-300 px-3 py-2" />
            </label>
            <button type="button" className="rounded-lg bg-slate-900 px-4 py-2 text-white">
              Save reservation
            </button>
          </form>

          <p className="mt-4 text-xs text-slate-600">
            Conflict check preview: {hasConflictExample ? "Conflict detected" : "No conflict"}
          </p>
        </aside>
      </section>
    </AppShell>
  );
}

function StatusBadge({ status }: { status: "pending" | "approved" | "declined" }) {
  if (status === "approved") {
    return <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-800">Approved</span>;
  }

  if (status === "declined") {
    return <span className="rounded-full bg-rose-100 px-3 py-1 text-xs text-rose-800">Declined</span>;
  }

  return <span className="rounded-full bg-amber-100 px-3 py-1 text-xs text-amber-800">Pending review</span>;
}

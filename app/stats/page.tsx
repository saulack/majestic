import { AppShell } from "@/components/app-shell";
import { StatsChart } from "@/components/stats-chart";
import { mockReservations, currentUser } from "@/lib/mock-data";
import { yearlyDaysByUser, totalDaysInReservation } from "@/lib/reservation-utils";
import { isSuperadmin } from "@/lib/rbac";
import { format, parseISO } from "date-fns";

export default function StatsPage() {
  const year = new Date().getFullYear();
  const user = currentUser;

  // Personal stats — visible to all roles
  const myReservations = mockReservations.filter((r) => r.userId === user.id);
  const myApproved = myReservations.filter((r) => r.status === "approved");
  const myPending = myReservations.filter((r) => r.status === "pending");
  const myTotalNights = myApproved.reduce((sum, r) => sum + totalDaysInReservation(r), 0);
  const myUpcoming = myApproved.filter((r) => r.startDate >= format(new Date(), "yyyy-MM-dd"));

  // Aggregate stats — superadmin only
  const grouped = yearlyDaysByUser(mockReservations, year);
  const chartData = Object.entries(grouped).map(([name, days]) => ({ name, days }));

  return (
    <AppShell>
      <div className="grid gap-5 sm:gap-6">
        {/* ── Personal stats ──────────────────────────── */}
        <section className="card p-5 sm:p-6">
          <h2 className="text-xl sm:text-2xl">My Apartment Stats</h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600">
            Your personal booking history and upcoming stays.
          </p>

          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatTile label="Total bookings" value={myReservations.length} />
            <StatTile label="Nights approved" value={myTotalNights} accent="copper" />
            <StatTile label="Pending review" value={myPending.length} accent="amber" />
            <StatTile label="Upcoming stays" value={myUpcoming.length} accent="copper" />
          </div>

          {myReservations.length > 0 ? (
            <div className="mt-6">
              <h3 className="mb-3 text-base font-semibold">All My Reservations</h3>
              <div className="grid gap-3">
                {myReservations.map((r) => (
                  <div key={r.id} className="flex items-start justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-3 sm:px-4">
                    <div>
                      <p className="text-sm font-medium text-slate-800">
                        {format(parseISO(r.startDate), "MMM d")} – {format(parseISO(r.endDate), "MMM d, yyyy")}
                      </p>
                      {r.notes ? <p className="mt-0.5 text-xs text-slate-500">{r.notes}</p> : null}
                      {r.status === "declined" && r.declineReason ? (
                        <p className="mt-1 text-xs text-rose-600">
                          <span className="font-semibold">Declined: </span>{r.declineReason}
                        </p>
                      ) : null}
                    </div>
                    <StatusBadge status={r.status} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-6 text-sm text-slate-500">You have no reservations yet.</p>
          )}
        </section>

        {/* ── Aggregate chart — superadmin only ──────── */}
        {isSuperadmin(user) ? (
          <section className="card p-5 sm:p-6">
            <h2 className="text-xl sm:text-2xl">Family Overview — {year}</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Total nights per member for the current calendar year.
            </p>
            <StatsChart data={chartData} year={year} />
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}

function StatTile({
  label,
  value,
  accent = "slate"
}: {
  label: string;
  value: number;
  accent?: "slate" | "copper" | "amber";
}) {
  const ring = {
    slate: "border-slate-200 bg-white",
    copper: "border-amber-700/40 bg-amber-50/30",
    amber: "border-amber-700/40 bg-amber-50/20"
  }[accent];
  const text = {
    slate: "text-slate-800",
    copper: "text-amber-700",
    amber: "text-amber-700"
  }[accent];
  return (
    <div className={`rounded-xl border p-3.5 text-center sm:p-4 ${ring}`}>
      <p className={`text-2xl font-bold sm:text-3xl ${text}`}>{value}</p>
      <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved")
    return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">Approved</span>;
  if (status === "declined")
    return <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-800">Declined</span>;
  return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Pending</span>;
}

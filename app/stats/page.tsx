"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { AppShell } from "@/components/app-shell";
import { currentUser, mockReservations } from "@/lib/mock-data";
import { totalDaysInReservation } from "@/lib/reservation-utils";

type Scope = "currentYear" | "allTime";

export default function StatsPage() {
  const [scope, setScope] = useState<Scope>("currentYear");
  const currentYear = new Date().getFullYear();

  const myReservations = useMemo(() => {
    const mine = mockReservations.filter((reservation) => reservation.userId === currentUser.id);

    if (scope === "allTime") {
      return mine;
    }

    return mine.filter((reservation) => parseISO(reservation.startDate).getFullYear() === currentYear);
  }, [scope, currentYear]);

  const canceledReservations = myReservations.filter((reservation) => reservation.status === "declined");
  const reservedDays = myReservations
    .filter((reservation) => reservation.status === "approved")
    .reduce((sum, reservation) => sum + totalDaysInReservation(reservation), 0);

  return (
    <AppShell>
      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl">My Reservation Stats</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              Personal stats only: total reservations, total days reserved, and total canceled reservations.
            </p>
          </div>

          <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1">
            <button
              type="button"
              onClick={() => setScope("currentYear")}
              className={[
                "rounded-md px-3 py-1.5 text-sm",
                scope === "currentYear" ? "bg-amber-700 text-white" : "text-slate-700"
              ].join(" ")}
            >
              Current year
            </button>
            <button
              type="button"
              onClick={() => setScope("allTime")}
              className={[
                "rounded-md px-3 py-1.5 text-sm",
                scope === "allTime" ? "bg-amber-700 text-white" : "text-slate-700"
              ].join(" ")}
            >
              All time
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatTile label="Reservations" value={myReservations.length} />
          <StatTile label="Days reserved" value={reservedDays} accent="copper" />
          <StatTile label="Canceled reservations" value={canceledReservations.length} accent="rose" />
        </div>

        {myReservations.length > 0 ? (
          <div className="mt-6">
            <h3 className="mb-3 text-base font-semibold">
              My reservations ({scope === "currentYear" ? String(currentYear) : "all time"})
            </h3>
            <div className="grid gap-3">
              {myReservations.map((reservation) => (
                <div key={reservation.id} className="flex items-start justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-3 sm:px-4">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {format(parseISO(reservation.startDate), "MMM d")} - {format(parseISO(reservation.endDate), "MMM d, yyyy")}
                    </p>
                    {reservation.notes ? <p className="mt-0.5 text-xs text-slate-500">{reservation.notes}</p> : null}
                    {reservation.status === "declined" && reservation.declineReason ? (
                      <p className="mt-1 text-xs text-rose-600">
                        <span className="font-semibold">Canceled/Declined: </span>
                        {reservation.declineReason}
                      </p>
                    ) : null}
                  </div>
                  <StatusBadge status={reservation.status} />
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="mt-6 text-sm text-slate-500">No reservations found for this period.</p>
        )}
      </section>
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
  accent?: "slate" | "copper" | "rose";
}) {
  const ring = {
    slate: "border-slate-200 bg-white",
    copper: "border-amber-700/40 bg-amber-50/30",
    rose: "border-rose-400/40 bg-rose-50/30"
  }[accent];

  const text = {
    slate: "text-slate-800",
    copper: "text-amber-700",
    rose: "text-rose-700"
  }[accent];

  return (
    <div className={`rounded-xl border p-3.5 text-center sm:p-4 ${ring}`}>
      <p className={`text-2xl font-bold sm:text-3xl ${text}`}>{value}</p>
      <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") {
    return <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-xs text-emerald-800">Approved</span>;
  }

  if (status === "declined") {
    return <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-800">Canceled</span>;
  }

  return <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800">Pending</span>;
}

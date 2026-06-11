"use client";

import { format, parseISO } from "date-fns";
import { useMemo, useState } from "react";
import Link from "next/link";
import type { Reservation } from "@/lib/types";

type Props = {
  reservations: Reservation[];
  initialVisibleCount: number;
};

export function UpcomingReservationsList({ reservations, initialVisibleCount }: Props) {
  const safeInitialCount = Math.max(1, initialVisibleCount);
  const [visibleCount, setVisibleCount] = useState(safeInitialCount);

  const visibleReservations = useMemo(() => reservations.slice(0, visibleCount), [reservations, visibleCount]);
  const hasMore = visibleCount < reservations.length;

  if (reservations.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
        No upcoming reservations found.
      </div>
    );
  }

  return (
    <div className="mt-5 grid gap-2.5 sm:gap-3">
      {visibleReservations.map((reservation) => (
        <Link
          key={reservation.id}
          href={`/reservations?start=${reservation.startDate}&end=${reservation.endDate}`}
          className="rounded-xl border border-slate-200 bg-white px-4 py-3 sm:px-5 sm:py-3.5 transition hover:border-slate-300 hover:shadow-md"
        >
          <article>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h4 className="text-base font-semibold text-slate-900">{reservation.userName}</h4>
                <p className="mt-1 text-sm text-slate-600">
                  {format(parseISO(reservation.startDate), "MMM d, yyyy")} to {format(parseISO(reservation.endDate), "MMM d, yyyy")}
                </p>
              </div>
              <span className="inline-flex min-h-7 items-center rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
                {reservation.status}
              </span>
            </div>
            {reservation.notes ? <p className="mt-2 text-sm text-slate-500">{reservation.notes}</p> : null}
          </article>
        </Link>
      ))}

      {hasMore ? (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setVisibleCount((current) => current + safeInitialCount)}
            className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 sm:w-auto"
          >
            Load more reservations
          </button>
        </div>
      ) : null}
    </div>
  );
}

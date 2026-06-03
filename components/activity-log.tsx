"use client";

import { useMemo, useState } from "react";
import { addMonths, format, formatDistanceToNow, parseISO, startOfMonth, subMonths } from "date-fns";
import { CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, XCircle } from "lucide-react";
import { totalDaysInReservation } from "@/lib/reservation-utils";
import { getHolidayLabelsInRange, summarizeHolidayLabels } from "@/lib/reservation-holiday-utils";
import type { HolidayMap } from "@/lib/holidays";
import type { Reservation } from "@/lib/types";

type LogEntry = {
  id: string;
  type: "created" | "approved" | "declined";
  userName: string;
  reviewerName?: string;
  startDate: string;
  endDate: string;
  declineReason?: string;
  timestamp: string;
  nights: number;
  holidaySummary?: string;
};

function buildLogEntries(reservations: Reservation[], holidayMap: HolidayMap, approvalsEnabled: boolean): LogEntry[] {
  const entries: LogEntry[] = [];

  for (const reservation of reservations) {
    const nights = totalDaysInReservation(reservation);
    const holidaySummary = summarizeHolidayLabels(getHolidayLabelsInRange(reservation, holidayMap));

    entries.push({
      id: `${reservation.id}-created`,
      type: "created",
      userName: reservation.userName,
      startDate: reservation.startDate,
      endDate: reservation.endDate,
      timestamp: reservation.createdAt,
      nights,
      holidaySummary
    });

    if (approvalsEnabled && (reservation.status === "approved" || reservation.status === "declined") && reservation.reviewedAt) {
      entries.push({
        id: `${reservation.id}-${reservation.status}`,
        type: reservation.status,
        userName: reservation.userName,
        reviewerName: reservation.reviewedByName,
        startDate: reservation.startDate,
        endDate: reservation.endDate,
        declineReason: reservation.declineReason,
        timestamp: reservation.reviewedAt,
        nights
      });
    }
  }

  return entries.sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1));
}

function formatDateRange(startDate: string, endDate: string, nights: number) {
  const s = format(parseISO(startDate), "MMM d");
  const e = format(parseISO(endDate), "MMM d, yyyy");
  return `${s} - ${e} · ${nights} ${nights === 1 ? "night" : "nights"}`;
}

function formatRelative(timestamp: string) {
  try {
    return formatDistanceToNow(parseISO(timestamp), { addSuffix: true });
  } catch {
    return "";
  }
}

export function ActivityLog({
  reservations,
  holidayMap,
  approvalsEnabled
}: {
  reservations: Reservation[];
  holidayMap: HolidayMap;
  approvalsEnabled: boolean;
}) {
  const entries = useMemo(
    () => buildLogEntries(reservations, holidayMap, approvalsEnabled),
    [reservations, holidayMap, approvalsEnabled]
  );

  const [monthCursor, setMonthCursor] = useState(startOfMonth(new Date()));

  const monthEntries = useMemo(
    () => entries.filter((entry) => startOfMonth(parseISO(entry.timestamp)).getTime() === monthCursor.getTime()),
    [entries, monthCursor]
  );

  if (entries.length === 0) {
    return (
      <div className="card p-5 sm:p-6">
        <h3 className="text-lg sm:text-xl">Activity Log</h3>
        <p className="mt-4 text-sm text-slate-500">No activity yet.</p>
      </div>
    );
  }

  return (
    <div className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-lg sm:text-xl">Activity Log</h3>
          <p className="mt-1 text-sm text-slate-500">Browse booking activity by month.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMonthCursor((current) => subMonths(current, 1))}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <p className="min-w-28 text-center text-sm font-medium text-slate-700">{format(monthCursor, "MMMM yyyy")}</p>
          <button
            type="button"
            onClick={() => setMonthCursor((current) => addMonths(current, 1))}
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {monthEntries.length === 0 ? (
        <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
          No log entries for {format(monthCursor, "MMMM yyyy")}. Use arrows to move between months.
        </div>
      ) : (
        <ol className="relative mt-5 border-l border-slate-300/70">
          {monthEntries.map((entry) => {
            if (entry.type === "created") {
              return (
                <li key={entry.id} className="mb-6 ml-6 last:mb-0">
                  <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-amber-100 ring-4 ring-[rgb(33,27,24)]">
                    <CalendarDays className="h-4 w-4 text-amber-700" />
                  </span>

                  <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <p className="text-sm font-medium text-slate-800">
                        {entry.holidaySummary
                          ? `${entry.userName} booked ${entry.nights} ${entry.nights === 1 ? "day" : "days"} of ${entry.holidaySummary}`
                          : `${entry.userName} booked ${entry.nights} ${entry.nights === 1 ? "day" : "days"}`}
                      </p>
                      <time className="whitespace-nowrap text-[11px] text-slate-400 sm:text-xs">{formatRelative(entry.timestamp)}</time>
                    </div>

                    <p className="mt-1 text-xs text-slate-500">{formatDateRange(entry.startDate, entry.endDate, entry.nights)}</p>
                  </div>
                </li>
              );
            }

            const isApproved = entry.type === "approved";

            return (
              <li key={entry.id} className="mb-6 ml-6 last:mb-0">
                <span
                  className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-[rgb(33,27,24)] ${isApproved ? "bg-emerald-100" : "bg-rose-100"}`}
                >
                  {isApproved ? <CheckCircle2 className="h-4 w-4 text-emerald-700" /> : <XCircle className="h-4 w-4 text-rose-700" />}
                </span>

                <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="text-sm font-medium text-slate-800">
                      {isApproved
                        ? `${entry.reviewerName ?? "An admin"} approved ${entry.userName}'s booking`
                        : `${entry.reviewerName ?? "An admin"} declined ${entry.userName}'s booking`}
                    </p>
                    <time className="whitespace-nowrap text-[11px] text-slate-400 sm:text-xs">{formatRelative(entry.timestamp)}</time>
                  </div>

                  <p className="mt-1 text-xs text-slate-500">{formatDateRange(entry.startDate, entry.endDate, entry.nights)}</p>

                  {!isApproved && entry.declineReason ? (
                    <div className="mt-2 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                      <span className="font-semibold">Reason: </span>
                      {entry.declineReason}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

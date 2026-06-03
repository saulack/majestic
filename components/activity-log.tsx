"use client";

import { useMemo } from "react";
import { format, formatDistanceToNow, parseISO } from "date-fns";
import { CalendarDays, CheckCircle2, XCircle } from "lucide-react";
import { totalDaysInReservation } from "@/lib/reservation-utils";
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
};

function buildLogEntries(reservations: Reservation[]): LogEntry[] {
  const entries: LogEntry[] = [];

  for (const r of reservations) {
    const nights = totalDaysInReservation(r);

    entries.push({
      id: `${r.id}-created`,
      type: "created",
      userName: r.userName,
      startDate: r.startDate,
      endDate: r.endDate,
      timestamp: r.createdAt,
      nights
    });

    if ((r.status === "approved" || r.status === "declined") && r.reviewedAt) {
      entries.push({
        id: `${r.id}-${r.status}`,
        type: r.status,
        userName: r.userName,
        reviewerName: r.reviewedByName,
        startDate: r.startDate,
        endDate: r.endDate,
        declineReason: r.declineReason,
        timestamp: r.reviewedAt,
        nights
      });
    }
  }

  return entries.sort((a, b) => (a.timestamp > b.timestamp ? -1 : 1));
}

function formatDateRange(startDate: string, endDate: string, nights: number) {
  const s = format(parseISO(startDate), "MMM d");
  const e = format(parseISO(endDate), "MMM d, yyyy");
  return `${s} – ${e} · ${nights} ${nights === 1 ? "night" : "nights"}`;
}

function formatRelative(timestamp: string) {
  try {
    return formatDistanceToNow(parseISO(timestamp), { addSuffix: true });
  } catch {
    return "";
  }
}

const entryConfig = {
  created: {
    icon: <CalendarDays className="h-4 w-4 text-amber-700" />,
    bg: "bg-amber-100",
    verb: (userName: string) => `${userName} submitted a booking request`
  },
  approved: {
    icon: <CheckCircle2 className="h-4 w-4 text-emerald-700" />,
    bg: "bg-emerald-100",
    verb: (userName: string, reviewerName?: string) =>
      `${reviewerName ?? "An admin"} approved ${userName}'s booking`
  },
  declined: {
    icon: <XCircle className="h-4 w-4 text-rose-700" />,
    bg: "bg-rose-100",
    verb: (userName: string, reviewerName?: string) =>
      `${reviewerName ?? "An admin"} declined ${userName}'s booking`
  }
};

export function ActivityLog({ reservations }: { reservations: Reservation[] }) {
  const entries = useMemo(() => buildLogEntries(reservations), [reservations]);

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
      <h3 className="text-lg sm:text-xl">Activity Log</h3>
      <p className="mt-1 mb-6 text-sm text-slate-500">A record of all booking requests, approvals, and denials.</p>

      <ol className="relative border-l border-slate-300/70">
        {entries.map((entry) => {
          const config = entryConfig[entry.type];
          return (
            <li key={entry.id} className="mb-6 ml-6 last:mb-0">
              <span
                className={`absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full ring-4 ring-[rgb(33,27,24)] ${config.bg}`}
              >
                {config.icon}
              </span>

              <div className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="text-sm font-medium text-slate-800">
                    {config.verb(entry.userName, entry.reviewerName)}
                  </p>
                  <time className="whitespace-nowrap text-[11px] text-slate-400 sm:text-xs">
                    {formatRelative(entry.timestamp)}
                  </time>
                </div>

                <p className="mt-1 text-xs text-slate-500">
                  {formatDateRange(entry.startDate, entry.endDate, entry.nights)}
                </p>

                {entry.type === "declined" && entry.declineReason ? (
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
    </div>
  );
}

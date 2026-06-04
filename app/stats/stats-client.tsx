"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { AppShell } from "@/components/app-shell";
import { totalDaysInReservation } from "@/lib/reservation-utils";
import { isAdminLike } from "@/lib/rbac";
import type { FeatureRequest, Reservation, UserProfile } from "@/lib/types";

type Scope = "currentYear" | "allTime";

export function StatsClientPage({
  actingUser,
  reservations,
  requests,
  previewRole
}: {
  actingUser: UserProfile;
  reservations: Reservation[];
  requests: FeatureRequest[];
  previewRole: Extract<UserProfile["role"], "admin" | "user"> | null;
}) {
  const [scope, setScope] = useState<Scope>("currentYear");
  const currentYear = new Date().getFullYear();
  const adminLike = isAdminLike(actingUser);

  const filteredReservations = useMemo(() => {
    const base = adminLike ? reservations : reservations.filter((reservation) => reservation.userId === actingUser.id);

    if (scope === "allTime") {
      return base;
    }

    return base.filter((reservation) => parseISO(reservation.startDate).getFullYear() === currentYear);
  }, [actingUser.id, adminLike, currentYear, reservations, scope]);

  const filteredRequests = useMemo(() => {
    const base = adminLike ? requests : requests.filter((request) => request.requestedByUserId === actingUser.id);

    if (scope === "allTime") {
      return base;
    }

    return base.filter((request) => parseISO(request.createdAt).getFullYear() === currentYear);
  }, [actingUser.id, adminLike, currentYear, requests, scope]);

  const canceledReservations = filteredReservations.filter((reservation) => reservation.status === "declined");
  const reservedDays = filteredReservations
    .filter((reservation) => reservation.status === "approved")
    .reduce((sum, reservation) => sum + totalDaysInReservation(reservation), 0);
  const pendingReservations = filteredReservations.filter((reservation) => reservation.status === "pending");
  const featureRequests = filteredRequests.filter((request) => request.requestType === "feature");
  const bugReports = filteredRequests.filter((request) => request.requestType === "bug");
  const totalVolume = filteredReservations.length + filteredRequests.length;

  const perUserRows = useMemo(() => {
    if (!adminLike) {
      return [];
    }

    const userMap = new Map<
      string,
      {
        name: string;
        reservations: number;
        featureRequests: number;
        bugReports: number;
      }
    >();

    for (const reservation of filteredReservations) {
      const existing = userMap.get(reservation.userId);
      if (existing) {
        existing.reservations += 1;
      } else {
        userMap.set(reservation.userId, {
          name: reservation.userName,
          reservations: 1,
          featureRequests: 0,
          bugReports: 0
        });
      }
    }

    for (const request of filteredRequests) {
      const existing = userMap.get(request.requestedByUserId);
      if (existing) {
        if (request.requestType === "feature") {
          existing.featureRequests += 1;
        } else {
          existing.bugReports += 1;
        }
      } else {
        userMap.set(request.requestedByUserId, {
          name: request.requestedByName,
          reservations: 0,
          featureRequests: request.requestType === "feature" ? 1 : 0,
          bugReports: request.requestType === "bug" ? 1 : 0
        });
      }
    }

    return [...userMap.entries()]
      .map(([userId, entry]) => ({
        userId,
        ...entry,
        totalVolume: entry.reservations + entry.featureRequests + entry.bugReports
      }))
      .sort((a, b) => b.totalVolume - a.totalVolume || a.name.localeCompare(b.name));
  }, [adminLike, filteredRequests, filteredReservations]);

  return (
    <AppShell initialRole={actingUser.role} initialPreviewRole={previewRole}>
      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl">{adminLike ? "Reservation Overview" : "My Reservation Stats"}</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-600">
              {adminLike
                ? "High-level activity view including reservations, feature requests, and bug reports across users."
                : "Personal activity stats including reservations, feature requests, and bug reports."}
            </p>
          </div>

          <div className="inline-flex rounded-lg border border-slate-300 bg-white p-1">
            <button
              type="button"
              onClick={() => setScope("currentYear")}
              className={["rounded-md px-3 py-1.5 text-sm", scope === "currentYear" ? "bg-amber-700 text-white" : "text-slate-700"].join(" ")}
            >
              Current year
            </button>
            <button
              type="button"
              onClick={() => setScope("allTime")}
              className={["rounded-md px-3 py-1.5 text-sm", scope === "allTime" ? "bg-amber-700 text-white" : "text-slate-700"].join(" ")}
            >
              All time
            </button>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatTile label="Total volume" value={totalVolume} />
          <StatTile label={adminLike ? "Visible reservations" : "Reservations"} value={filteredReservations.length} />
          <StatTile label="Feature requests" value={featureRequests.length} accent="copper" />
          <StatTile label="Bug reports" value={bugReports.length} accent="rose" />
          <StatTile label={adminLike ? "Pending reservations" : "Days reserved"} value={adminLike ? pendingReservations.length : reservedDays} accent="copper" />
          <StatTile label="Canceled reservations" value={canceledReservations.length} accent="rose" />
        </div>

        {adminLike ? (
          <div className="mt-6">
            <h3 className="mb-3 text-base font-semibold">
              Per-user volume ({scope === "currentYear" ? String(currentYear) : "all time"})
            </h3>
            {perUserRows.length === 0 ? (
              <p className="text-sm text-slate-500">No user activity found for this period.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="min-w-full text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.08em] text-slate-500">
                    <tr>
                      <th className="px-3 py-2.5">User</th>
                      <th className="px-3 py-2.5">Total volume</th>
                      <th className="px-3 py-2.5">Reservations</th>
                      <th className="px-3 py-2.5">Feature requests</th>
                      <th className="px-3 py-2.5">Bug reports</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perUserRows.map((row) => (
                      <tr key={row.userId} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-3 py-2.5 font-medium text-slate-800">{row.name}</td>
                        <td className="px-3 py-2.5 text-slate-700">{row.totalVolume}</td>
                        <td className="px-3 py-2.5 text-slate-700">{row.reservations}</td>
                        <td className="px-3 py-2.5 text-slate-700">{row.featureRequests}</td>
                        <td className="px-3 py-2.5 text-slate-700">{row.bugReports}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}

        {filteredReservations.length > 0 ? (
          <div className="mt-6">
            <h3 className="mb-3 text-base font-semibold">
              {adminLike ? "Recent visible reservations" : "My reservations"} ({scope === "currentYear" ? String(currentYear) : "all time"})
            </h3>
            <div className="grid gap-3">
              {filteredReservations.map((reservation) => (
                <div key={reservation.id} className="flex items-start justify-between rounded-xl border border-slate-200 bg-white px-3.5 py-3 sm:px-4">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {adminLike ? `${reservation.userName}: ` : ""}
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
    copper: "border-[#6ab7c2]/40 bg-[#e4f7fa]",
    rose: "border-rose-400/40 bg-rose-50/30"
  }[accent];

  const text = {
    slate: "text-slate-800",
    copper: "text-[#2f8b97]",
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

  return <span className="rounded-full bg-[#d9f1f5] px-2 py-0.5 text-xs text-[#317f8c]">Pending</span>;
}

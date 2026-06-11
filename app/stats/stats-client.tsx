"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { AppShell } from "@/components/app-shell";
import { totalDaysInReservation } from "@/lib/reservation-utils";
import { isAdminLike } from "@/lib/rbac";
import type { FeatureRequest, MaintenanceRecord, Reservation, UserProfile } from "@/lib/types";

type Scope = "currentYear" | "allTime";

const MAINTENANCE_PIE_COLORS = ["#0f766e", "#b45309", "#1d4ed8", "#be123c", "#166534", "#7c3aed", "#0369a1", "#c2410c"];

export function StatsClientPage({
  actingUser,
  reservations,
  requests,
  maintenanceRecords,
  users,
  previewRole
}: {
  actingUser: UserProfile;
  reservations: Reservation[];
  requests: FeatureRequest[];
  maintenanceRecords: MaintenanceRecord[];
  users: UserProfile[];
  previewRole: Extract<UserProfile["role"], "admin" | "user"> | null;
}) {
  const [scope, setScope] = useState<Scope>("currentYear");
  const currentYear = new Date().getFullYear();
  const adminLike = isAdminLike(actingUser);
  const isSuperadmin = actingUser.role === "superadmin";

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

  const filteredMaintenanceRecords = useMemo(() => {
    const base = adminLike ? maintenanceRecords : maintenanceRecords.filter((record) => record.createdByUserId === actingUser.id);

    if (scope === "allTime") {
      return base;
    }

    return base.filter((record) => parseISO(record.createdAt).getFullYear() === currentYear);
  }, [actingUser.id, adminLike, currentYear, maintenanceRecords, scope]);

  const canceledReservations = filteredReservations.filter((reservation) => reservation.status === "declined");
  const reservedDays = filteredReservations
    .filter((reservation) => reservation.status === "approved")
    .reduce((sum, reservation) => sum + totalDaysInReservation(reservation), 0);
  const pendingReservations = filteredReservations.filter((reservation) => reservation.status === "pending");
  const featureRequests = filteredRequests.filter((request) => request.requestType === "feature");
  const bugReports = filteredRequests.filter((request) => request.requestType === "bug");
  const totalVolume = filteredReservations.length + filteredRequests.length;
  const metricRows = useMemo(
    () => [
      { key: "total", label: "Total volume", value: totalVolume, barClass: "bg-slate-600" },
      { key: "reservations", label: adminLike ? "Visible reservations" : "Reservations", value: filteredReservations.length, barClass: "bg-slate-700" },
      { key: "features", label: "Feature requests", value: featureRequests.length, barClass: "bg-cyan-600" },
      { key: "bugs", label: "Bug reports", value: bugReports.length, barClass: "bg-rose-600" },
      {
        key: "pending_or_days",
        label: adminLike ? "Pending reservations" : "Days reserved",
        value: adminLike ? pendingReservations.length : reservedDays,
        barClass: "bg-emerald-600"
      },
      { key: "canceled", label: "Canceled reservations", value: canceledReservations.length, barClass: "bg-amber-600" }
    ],
    [
      adminLike,
      bugReports.length,
      canceledReservations.length,
      featureRequests.length,
      filteredReservations.length,
      pendingReservations.length,
      reservedDays,
      totalVolume
    ]
  );
  const maxMetricValue = useMemo(() => Math.max(...metricRows.map((entry) => entry.value), 1), [metricRows]);

  const maintenanceByTypeRows = useMemo(() => {
    const typeCounts = new Map<string, number>();

    for (const record of filteredMaintenanceRecords) {
      typeCounts.set(record.typeName, (typeCounts.get(record.typeName) ?? 0) + 1);
    }

    return [...typeCounts.entries()]
      .map(([typeName, count]) => ({ typeName, count }))
      .sort((a, b) => b.count - a.count || a.typeName.localeCompare(b.typeName));
  }, [filteredMaintenanceRecords]);

  const maxMaintenanceTypeCount = useMemo(
    () => Math.max(...maintenanceByTypeRows.map((entry) => entry.count), 1),
    [maintenanceByTypeRows]
  );

  const maintenanceShareByType = useMemo(() => {
    if (!isSuperadmin) {
      return [];
    }

    const userNameById = new Map(users.map((user) => [user.id, user.fullName]));
    const byType = new Map<string, Map<string, number>>();

    for (const record of filteredMaintenanceRecords) {
      const typeBucket = byType.get(record.typeName) ?? new Map<string, number>();
      typeBucket.set(record.createdByUserId, (typeBucket.get(record.createdByUserId) ?? 0) + 1);
      byType.set(record.typeName, typeBucket);
    }

    return [...byType.entries()]
      .map(([typeName, userCounts]) => {
        const total = [...userCounts.values()].reduce((sum, count) => sum + count, 0);
        const slices = [...userCounts.entries()]
          .map(([userId, count], index) => ({
            userId,
            name: userNameById.get(userId) ?? "Unknown",
            count,
            percentage: total > 0 ? Number(((count / total) * 100).toFixed(1)) : 0,
            color: MAINTENANCE_PIE_COLORS[index % MAINTENANCE_PIE_COLORS.length]
          }))
          .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));

        return {
          typeName,
          total,
          slices
        };
      })
      .sort((a, b) => b.total - a.total || a.typeName.localeCompare(b.typeName));
  }, [filteredMaintenanceRecords, isSuperadmin, users]);

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

    for (const user of users) {
      userMap.set(user.id, {
        name: user.fullName,
        reservations: 0,
        featureRequests: 0,
        bugReports: 0
      });
    }

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
  }, [adminLike, filteredRequests, filteredReservations, users]);

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

          <div className="grid w-full grid-cols-2 rounded-lg border border-slate-300 bg-white p-1 sm:inline-flex sm:w-auto">
            <button
              type="button"
              onClick={() => setScope("currentYear")}
              className={[
                "min-h-11 rounded-md px-3 py-1.5 text-sm",
                scope === "currentYear" ? "bg-amber-700 text-white" : "text-slate-700"
              ].join(" ")}
            >
              Current year
            </button>
            <button
              type="button"
              onClick={() => setScope("allTime")}
              className={[
                "min-h-11 rounded-md px-3 py-1.5 text-sm",
                scope === "allTime" ? "bg-amber-700 text-white" : "text-slate-700"
              ].join(" ")}
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

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="text-base font-semibold">Visual metric breakdown</h3>
          <p className="mt-1 text-sm text-slate-500">Each bar shows the relative volume for that metric in the selected scope.</p>
          <div className="mt-4 grid gap-3">
            {metricRows.map((metric) => (
              <div key={metric.key} className="grid gap-1.5">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-slate-700">{metric.label}</span>
                  <span className="text-slate-600">{metric.value}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100">
                  <div
                    className={`h-2 rounded-full ${metric.barClass}`}
                    style={{ width: `${Math.max(6, (metric.value / maxMetricValue) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
          <h3 className="text-base font-semibold">
            Maintenance by type ({scope === "currentYear" ? String(currentYear) : "all time"})
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {adminLike
              ? "How many maintenance logs exist by type in the selected scope."
              : "How many times you logged each maintenance type in the selected scope."}
          </p>

          {maintenanceByTypeRows.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">No maintenance activity found for this period.</p>
          ) : (
            <div className="mt-4 grid gap-3">
              {maintenanceByTypeRows.map((row) => (
                <div key={row.typeName} className="grid gap-1.5">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium text-slate-700">{row.typeName}</span>
                    <span className="text-slate-600">{row.count}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-amber-700"
                      style={{ width: `${Math.max(8, (row.count / maxMaintenanceTypeCount) * 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {isSuperadmin ? (
          <div className="mt-6">
            <h3 className="text-base font-semibold">
              Maintenance contribution by user ({scope === "currentYear" ? String(currentYear) : "all time"})
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              For each maintenance type, the pie chart shows each user&apos;s percentage of completions. Hover slices to see exact counts.
            </p>

            {maintenanceShareByType.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500">No maintenance contribution data found for this period.</p>
            ) : (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {maintenanceShareByType.map((typeRow) => (
                  <div key={typeRow.typeName} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-sm font-semibold text-slate-800">{typeRow.typeName}</h4>
                      <span className="text-xs text-slate-500">Total: {typeRow.total}</span>
                    </div>

                    <div className="mt-3 h-64">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={typeRow.slices} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={92} innerRadius={46}>
                            {typeRow.slices.map((slice) => (
                              <Cell key={`${typeRow.typeName}-${slice.userId}`} fill={slice.color} />
                            ))}
                          </Pie>
                          <Tooltip content={<MaintenancePieTooltip />} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="mt-2 grid gap-1.5">
                      {typeRow.slices.map((slice) => (
                        <div key={`${typeRow.typeName}-legend-${slice.userId}`} className="flex items-center justify-between gap-3 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: slice.color }} />
                            <span className="text-slate-700">{slice.name}</span>
                          </div>
                          <span className="text-slate-500">{slice.percentage}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : null}

        {adminLike ? (
          <div className="mt-6">
            <h3 className="mb-3 text-base font-semibold">
              Per-user volume ({scope === "currentYear" ? String(currentYear) : "all time"})
            </h3>
            {perUserRows.length === 0 ? (
              <p className="text-sm text-slate-500">No user activity found for this period.</p>
            ) : (
              <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                <table className="min-w-[42rem] text-left text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-[0.08em] text-slate-500">
                    <tr>
                      <th className="px-3 py-2.5">User</th>
                      <th className="px-3 py-2.5">Total volume</th>
                      <th className="px-3 py-2.5">Reservations</th>
                      <th className="px-3 py-2.5">Feature requests</th>
                      <th className="px-3 py-2.5">Bug reports</th>
                      <th className="px-3 py-2.5">Visual</th>
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
                        <td className="px-3 py-2.5">
                          <div className="h-2 w-40 overflow-hidden rounded-full bg-slate-100">
                            {row.totalVolume > 0 ? (
                              <div className="flex h-2 w-full">
                                <div
                                  className="bg-slate-600"
                                  style={{ width: `${(row.reservations / row.totalVolume) * 100}%` }}
                                  title={`Reservations: ${row.reservations}`}
                                />
                                <div
                                  className="bg-cyan-600"
                                  style={{ width: `${(row.featureRequests / row.totalVolume) * 100}%` }}
                                  title={`Feature requests: ${row.featureRequests}`}
                                />
                                <div
                                  className="bg-rose-600"
                                  style={{ width: `${(row.bugReports / row.totalVolume) * 100}%` }}
                                  title={`Bug reports: ${row.bugReports}`}
                                />
                              </div>
                            ) : null}
                          </div>
                        </td>
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
                <div key={reservation.id} className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-3 sm:px-4">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {adminLike ? `${reservation.userName}: ` : ""}
                      {format(parseISO(reservation.startDate), "MMM d")} - {format(parseISO(reservation.endDate), "MMM d, yyyy")}
                    </p>
                    {reservation.notes ? <p className="mt-0.5 text-xs text-slate-500">{reservation.notes}</p> : null}
                    {reservation.status === "declined" && reservation.declineReason ? (
                      <p className="mt-1 text-xs text-rose-600">
                        <span className="font-semibold">Canceled: </span>
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

function MaintenancePieTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: { name: string; count: number; percentage: number } }> }) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }

  const current = payload[0]?.payload;
  if (!current) {
    return null;
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs shadow-sm">
      <p className="font-semibold text-slate-800">{current.name}</p>
      <p className="mt-1 text-slate-600">{current.percentage}%</p>
      <p className="text-slate-600">{current.count} time{current.count === 1 ? "" : "s"}</p>
    </div>
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
    copper: "border-amber-200 bg-amber-50",
    rose: "border-slate-200 bg-slate-50"
  }[accent];

  const text = {
    slate: "text-slate-800",
    copper: "text-amber-700",
    rose: "text-slate-700"
  }[accent];

  return (
    <div className={`rounded-xl border p-3 text-center sm:p-4 ${ring}`}>
      <p className={`text-xl font-bold sm:text-3xl ${text}`}>{value}</p>
      <p className="mt-1 text-[11px] text-slate-500 sm:text-xs">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "approved") {
    return <span className="inline-flex min-h-7 items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-700">Approved</span>;
  }

  if (status === "declined") {
    return <span className="inline-flex min-h-7 items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-700">Canceled</span>;
  }

  return <span className="inline-flex min-h-7 items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs text-slate-700">Pending</span>;
}

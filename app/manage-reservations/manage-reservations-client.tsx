"use client";

import { format, parseISO } from "date-fns";
import { useState } from "react";
import { ToggleSwitch } from "@/components/toggle-switch";
import type { Reservation } from "@/lib/types";

type ReservationRow = Reservation;

type ApiResult = {
  message?: string;
  error?: string;
  reservation?: {
    id: string;
    userId: string;
    startDate: string;
    endDate: string;
    notes?: string;
    sharedWithUserIds?: string[];
    sharedRangeStartDate?: string;
    sharedRangeEndDate?: string;
    status: Reservation["status"];
    declineReason?: string;
    createdAt: string;
  };
  reservationId?: string;
};

type ManageReservationsClientProps = {
  initialReservations: Reservation[];
  userNameById: Record<string, string>;
  userOptions: Array<{ id: string; fullName: string }>;
};

export function ManageReservationsClient({ initialReservations, userNameById, userOptions }: ManageReservationsClientProps) {
  const [reservations, setReservations] = useState<ReservationRow[]>(initialReservations);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [isOverlapUsersSubmenuOpen, setIsOverlapUsersSubmenuOpen] = useState(true);
  const [draft, setDraft] = useState({
    startDate: "",
    endDate: "",
    notes: "",
    allowDoubleBooking: false,
    sharedWithUserIds: [] as string[],
    shareScope: "whole" as "whole" | "range",
    sharedRangeStartDate: "",
    sharedRangeEndDate: ""
  });

  const sorted = [...reservations].sort((a, b) => b.startDate.localeCompare(a.startDate));

  function getStatusLabel(reservation: ReservationRow) {
    if (reservation.status === "declined" && reservation.declineReason === "Canceled by user") {
      return "Canceled";
    }

    return formatStatusLabel(reservation.status);
  }

  function startEditing(reservation: ReservationRow) {
    const hasOverlapUsers = Boolean(reservation.sharedWithUserIds?.length);
    const hasSharedRange = Boolean(reservation.sharedRangeStartDate && reservation.sharedRangeEndDate);

    setEditingId(reservation.id);
    setIsOverlapUsersSubmenuOpen(true);
    setStatus("");
    setDraft({
      startDate: reservation.startDate,
      endDate: reservation.endDate,
      notes: reservation.notes ?? "",
      allowDoubleBooking: hasOverlapUsers,
      sharedWithUserIds: reservation.sharedWithUserIds ?? [],
      shareScope: hasSharedRange ? "range" : "whole",
      sharedRangeStartDate: reservation.sharedRangeStartDate ?? reservation.startDate,
      sharedRangeEndDate: reservation.sharedRangeEndDate ?? reservation.endDate
    });
  }

  async function saveReservation(reservationId: string) {
    if (!draft.startDate || !draft.endDate) {
      setStatus("Start date and end date are required.");
      return;
    }

    if (draft.endDate < draft.startDate) {
      setStatus("End date must be on or after start date.");
      return;
    }

    if (draft.allowDoubleBooking && draft.sharedWithUserIds.length === 0) {
      setStatus("Select at least one overlap user or turn off double booking.");
      return;
    }

    if (draft.allowDoubleBooking && draft.shareScope === "range") {
      if (!draft.sharedRangeStartDate || !draft.sharedRangeEndDate) {
        setStatus("Select both sharable range dates.");
        return;
      }

      if (draft.sharedRangeEndDate < draft.sharedRangeStartDate) {
        setStatus("Sharable range end date must be on or after the start date.");
        return;
      }

      if (draft.sharedRangeStartDate < draft.startDate || draft.sharedRangeEndDate > draft.endDate) {
        setStatus("Sharable range must stay within the reservation dates.");
        return;
      }
    }

    setBusy(true);
    setStatus("");

    const response = await fetch("/api/reservations/my", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        reservationId,
        startDate: draft.startDate,
        endDate: draft.endDate,
        notes: draft.notes,
        allowDoubleBooking: draft.allowDoubleBooking,
        sharedWithUserIds: draft.allowDoubleBooking ? draft.sharedWithUserIds : [],
        sharedRangeStartDate: draft.allowDoubleBooking && draft.shareScope === "range" ? draft.sharedRangeStartDate : undefined,
        sharedRangeEndDate: draft.allowDoubleBooking && draft.shareScope === "range" ? draft.sharedRangeEndDate : undefined
      })
    });

    const payload = (await response.json()) as ApiResult;
    setBusy(false);

    if (!response.ok || !payload.reservation) {
      setStatus(payload.error ?? "Unable to save reservation.");
      return;
    }

    setReservations((current) =>
      current.map((reservation) =>
        reservation.id === reservationId
          ? {
              ...reservation,
              startDate: payload.reservation?.startDate ?? reservation.startDate,
              endDate: payload.reservation?.endDate ?? reservation.endDate,
              notes: payload.reservation?.notes,
              sharedWithUserIds: payload.reservation?.sharedWithUserIds ?? reservation.sharedWithUserIds,
              sharedRangeStartDate: payload.reservation?.sharedRangeStartDate,
              sharedRangeEndDate: payload.reservation?.sharedRangeEndDate,
              status: payload.reservation?.status ?? reservation.status,
              declineReason: payload.reservation?.declineReason ?? reservation.declineReason
            }
          : reservation
      )
    );

    setEditingId(null);
    setStatus(payload.message ?? "Reservation updated.");
  }

  async function cancelReservation(reservationId: string) {
    const confirmed = window.confirm("Cancel this reservation?");
    if (!confirmed) {
      return;
    }

    setBusy(true);
    setStatus("");

    const response = await fetch("/api/reservations/my", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reservationId })
    });

    const payload = (await response.json()) as ApiResult;
    setBusy(false);

    if (!response.ok) {
      setStatus(payload.error ?? "Unable to cancel reservation.");
      return;
    }

    if (payload.reservation) {
      setReservations((current) =>
        current.map((reservation) =>
          reservation.id === reservationId
            ? {
                ...reservation,
                status: payload.reservation?.status ?? reservation.status,
                declineReason: payload.reservation?.declineReason ?? reservation.declineReason
              }
            : reservation
        )
      );
    }

    setStatus(payload.message ?? "Reservation canceled.");
  }

  return (
    <section className="card p-5 sm:p-6">
      <h2 className="text-xl sm:text-2xl">Manage Reservations</h2>
      <p className="mt-2 text-sm text-slate-600">Review your reservations and edit or cancel them from this page.</p>

      {status ? <p className="mt-3 text-sm text-slate-700">{status}</p> : null}

      <div className="mt-5 grid gap-3">
        {sorted.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-sm text-slate-500">
            You do not have any reservations yet.
          </div>
        ) : (
          sorted.map((reservation) => {
            const availableShareUsers = userOptions.filter((user) => user.id !== reservation.userId);
            const sharedWithNames = (reservation.sharedWithUserIds ?? [])
              .map((userId) => userNameById[userId])
              .filter((name): name is string => Boolean(name));
            const isSharedReservation = sharedWithNames.length > 0;
            const hasSharedRange = Boolean(reservation.sharedRangeStartDate && reservation.sharedRangeEndDate);
            const sharedRangeLabel = hasSharedRange
              ? `${format(parseISO(reservation.sharedRangeStartDate ?? ""), "MMM d, yyyy")} to ${format(parseISO(reservation.sharedRangeEndDate ?? ""), "MMM d, yyyy")}`
              : "Whole reservation";

            return (
              <article key={reservation.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      {format(parseISO(reservation.startDate), "MMM d, yyyy")} to {format(parseISO(reservation.endDate), "MMM d, yyyy")}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">Created {format(parseISO(reservation.createdAt), "MMM d, yyyy")}</p>
                  </div>
                  <span className={statusBadgeClass(reservation.status)}>{getStatusLabel(reservation)}</span>
                </div>

                {editingId === reservation.id ? (
                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <label className="grid gap-1 text-sm">
                      <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Start date</span>
                      <input
                        type="date"
                        value={draft.startDate}
                        onChange={(event) => setDraft((current) => ({ ...current, startDate: event.target.value }))}
                        className="rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </label>
                    <label className="grid gap-1 text-sm">
                      <span className="text-xs uppercase tracking-[0.12em] text-slate-500">End date</span>
                      <input
                        type="date"
                        value={draft.endDate}
                        onChange={(event) => setDraft((current) => ({ ...current, endDate: event.target.value }))}
                        className="rounded-lg border border-slate-300 px-3 py-2"
                      />
                    </label>
                    <label className="grid gap-1 text-sm sm:col-span-3">
                      <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Notes</span>
                      <textarea
                        value={draft.notes}
                        onChange={(event) => setDraft((current) => ({ ...current, notes: event.target.value }))}
                        className="min-h-20 rounded-lg border border-slate-300 px-3 py-2"
                        placeholder="Optional notes"
                      />
                    </label>

                    <div className="sm:col-span-3 rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-emerald-900">Double booking</p>
                          <p className="text-xs text-emerald-700">Use the same submenu controls to add or revoke sharing.</p>
                        </div>
                        <ToggleSwitch
                          srLabel="Allow double booking"
                          checked={draft.allowDoubleBooking}
                          onCheckedChange={(checked) => {
                            setDraft((current) => ({ ...current, allowDoubleBooking: checked }));
                          }}
                        />
                      </div>

                      {draft.allowDoubleBooking ? (
                        <div className="mt-3 rounded-lg border border-emerald-200 bg-white/80 p-3">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-slate-900">Allowed overlap users</p>
                            <button
                              type="button"
                              onClick={() => setIsOverlapUsersSubmenuOpen((current) => !current)}
                              className="text-xs font-semibold uppercase tracking-[0.12em] text-emerald-700"
                            >
                              {isOverlapUsersSubmenuOpen ? "Collapse" : "Expand"}
                            </button>
                          </div>

                          {isOverlapUsersSubmenuOpen ? (
                            <div className="mt-2 space-y-2 border-l-2 border-emerald-200 pl-3">
                              {availableShareUsers.length === 0 ? (
                                <p className="text-xs text-slate-500">No users available to share with.</p>
                              ) : (
                                availableShareUsers.map((user) => {
                                  const isChecked = draft.sharedWithUserIds.includes(user.id);

                                  return (
                                    <label key={user.id} className="flex items-center gap-2 text-sm text-slate-700">
                                      <input
                                        type="checkbox"
                                        checked={isChecked}
                                        onChange={(event) => {
                                          const checked = event.target.checked;
                                          setDraft((current) => ({
                                            ...current,
                                            sharedWithUserIds: checked
                                              ? [...current.sharedWithUserIds, user.id]
                                              : current.sharedWithUserIds.filter((entry) => entry !== user.id)
                                          }));
                                        }}
                                        className="h-4 w-4 rounded border-slate-300"
                                      />
                                      <span>{user.fullName}</span>
                                    </label>
                                  );
                                })
                              )}
                            </div>
                          ) : null}

                          <div className="mt-3 border-l-2 border-emerald-200 pl-3">
                            <label className="grid gap-1 text-sm">
                              <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Sharable range</span>
                              <select
                                value={draft.shareScope}
                                onChange={(event) => {
                                  const nextScope = event.target.value as "whole" | "range";
                                  setDraft((current) => ({
                                    ...current,
                                    shareScope: nextScope,
                                    sharedRangeStartDate: nextScope === "range" ? (current.sharedRangeStartDate || current.startDate) : current.startDate,
                                    sharedRangeEndDate: nextScope === "range" ? (current.sharedRangeEndDate || current.endDate) : current.endDate
                                  }));
                                }}
                                className="rounded-lg border border-slate-300 px-3 py-2"
                              >
                                <option value="whole">Whole reservation</option>
                                <option value="range">Date range only</option>
                              </select>
                            </label>

                            {draft.shareScope === "range" ? (
                              <div className="mt-2 grid gap-2 border-l-2 border-emerald-100 pl-3 sm:grid-cols-2">
                                <label className="grid gap-1 text-sm">
                                  <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Sharable start date</span>
                                  <input
                                    type="date"
                                    value={draft.sharedRangeStartDate}
                                    min={draft.startDate}
                                    max={draft.endDate}
                                    onChange={(event) => {
                                      setDraft((current) => ({ ...current, sharedRangeStartDate: event.target.value }));
                                    }}
                                    className="rounded-lg border border-slate-300 px-3 py-2"
                                  />
                                </label>
                                <label className="grid gap-1 text-sm">
                                  <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Sharable end date</span>
                                  <input
                                    type="date"
                                    value={draft.sharedRangeEndDate}
                                    min={draft.startDate}
                                    max={draft.endDate}
                                    onChange={(event) => {
                                      setDraft((current) => ({ ...current, sharedRangeEndDate: event.target.value }));
                                    }}
                                    className="rounded-lg border border-slate-300 px-3 py-2"
                                  />
                                </label>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-2 sm:col-span-3">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          void saveReservation(reservation.id);
                        }}
                        className="rounded-lg bg-amber-700 px-4 py-2 text-white disabled:opacity-60"
                      >
                        Save changes
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setEditingId(null);
                          setStatus("");
                        }}
                        className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className={`mt-3 text-sm ${isSharedReservation ? "text-emerald-700" : "text-slate-500"}`}>
                      {isSharedReservation ? `Shared with: ${sharedWithNames.join(", ")}` : "Shared: No"}
                    </p>
                    {isSharedReservation ? <p className="mt-1 text-xs text-emerald-700">Shared range: {sharedRangeLabel}</p> : null}
                    {reservation.notes ? <p className="mt-2 text-sm text-slate-600">{reservation.notes}</p> : null}
                    {reservation.declineReason ? (
                      <p className={`mt-2 text-sm ${reservation.declineReason === "Canceled by user" ? "text-amber-700" : "text-rose-700"}`}>
                        {reservation.declineReason === "Canceled by user" ? "Cancellation note: Canceled by you" : `Cancellation reason: ${reservation.declineReason}`}
                      </p>
                    ) : null}

                    <div className="mt-4 flex flex-wrap gap-2">
                      {reservation.status !== "declined" ? (
                        <>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => startEditing(reservation)}
                            className="rounded-lg border border-slate-300 px-4 py-2 text-slate-700 disabled:opacity-60"
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => {
                              void cancelReservation(reservation.id);
                            }}
                            className="rounded-lg border border-rose-300 px-4 py-2 text-rose-700 disabled:opacity-60"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <span className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-xs font-medium text-amber-800">Canceled</span>
                      )}
                    </div>
                  </>
                )}
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}

function formatStatusLabel(status: Reservation["status"]): string {
  switch (status) {
    case "approved":
      return "Approved";
    case "declined":
      return "Canceled";
    default:
      return "Pending";
  }
}


function statusBadgeClass(status: Reservation["status"]): string {
  if (status === "approved") {
    return "rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700";
  }

  if (status === "declined") {
    return "rounded-full border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700";
  }

  return "rounded-full border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700";
}

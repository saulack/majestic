"use client";

import { useMemo, useState, useTransition } from "react";
import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths
} from "date-fns";
import { CheckCircle2, XCircle, Clock } from "lucide-react";
import { currentUser, mockUsers } from "@/lib/mock-data";
import { canModerateReservation } from "@/lib/rbac";
import { hasDateConflict, totalDaysInReservation } from "@/lib/reservation-utils";
import { createReservation, moderateReservation } from "@/app/reservations/actions";
import { ActivityLog } from "@/components/activity-log";
import type { HolidayMap } from "@/lib/holidays";
import type { Reservation, UserProfile } from "@/lib/types";

type Props = {
  reservations: Reservation[];
  holidayMap: HolidayMap;
  users?: UserProfile[];
};

const weekdayHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const statusConfig = {
  approved: { label: "Approved", cls: "bg-emerald-100/70 text-emerald-800", icon: <CheckCircle2 className="inline h-3 w-3" /> },
  declined: { label: "Declined", cls: "bg-rose-100/70 text-rose-800", icon: <XCircle className="inline h-3 w-3" /> },
  pending: { label: "Pending", cls: "bg-amber-100 text-amber-800", icon: <Clock className="inline h-3 w-3" /> }
};

export function MonthlyReservationsCalendar({ reservations, holidayMap, users = mockUsers }: Props) {
  const [monthCursor, setMonthCursor] = useState(startOfMonth(new Date()));
  const [selectionMode, setSelectionMode] = useState<"range" | "individual">("range");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [individualSelection, setIndividualSelection] = useState<string[]>([]);
  const [notes, setNotes] = useState("");
  const [selectionStatus, setSelectionStatus] = useState("");
  const [formMessage, setFormMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  // Inline decline form state
  const [declineTargetId, setDeclineTargetId] = useState<string | null>(null);
  const [declineReasonText, setDeclineReasonText] = useState("");
  const [moderationMessage, setModerationMessage] = useState<Record<string, { type: "success" | "error"; text: string }>>({});

  const monthStart = startOfMonth(monthCursor);
  const calendarStart = startOfWeek(monthStart);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: addDays(calendarStart, 41) });

  const activeStart = selectionMode === "range" ? startDate : individualSelection[0] ?? "";
  const activeEnd =
    selectionMode === "range" ? endDate : individualSelection[individualSelection.length - 1] ?? "";

  const selectionHasConflict =
    activeStart && activeEnd ? hasDateConflict(reservations, activeStart, activeEnd) : false;

  const sortedIndividual = useMemo(
    () => [...individualSelection].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0)),
    [individualSelection]
  );

  function onSelectDay(dateKey: string) {
    if (selectionMode !== "individual") return;

    if (individualSelection.length === 0) {
      setIndividualSelection([dateKey]);
      setSelectionStatus("Selected first day.");
      return;
    }

    if (individualSelection.includes(dateKey)) {
      setSelectionStatus("Date already selected. Use Clear to restart individual selection.");
      return;
    }

    const min = sortedIndividual[0];
    const max = sortedIndividual[sortedIndividual.length - 1];
    const isContiguousBefore = differenceInCalendarDays(parseISO(min), parseISO(dateKey)) === 1;
    const isContiguousAfter = differenceInCalendarDays(parseISO(dateKey), parseISO(max)) === 1;

    if (!isContiguousBefore && !isContiguousAfter) {
      setSelectionStatus("No skipped days allowed in a single reservation. Add adjacent dates only.");
      return;
    }

    const next = [...individualSelection, dateKey].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
    setIndividualSelection(next);
    setSelectionStatus("Date added.");
  }

  function clearSelection() {
    setStartDate("");
    setEndDate("");
    setIndividualSelection([]);
    setNotes("");
    setSelectionStatus("");
    setFormMessage(null);
  }

  function handleSave() {
    const s = activeStart;
    const e = activeEnd;
    if (!s || !e) {
      setFormMessage({ type: "error", text: "Please select a start and end date." });
      return;
    }
    if (e < s) {
      setFormMessage({ type: "error", text: "End date must be on or after start date." });
      return;
    }
    if (selectionHasConflict) {
      setFormMessage({ type: "error", text: "This date range conflicts with an existing reservation." });
      return;
    }
    setFormMessage(null);
    startTransition(async () => {
      const result = await createReservation({ startDate: s, endDate: e, notes });
      if (result.error) {
        setFormMessage({ type: "error", text: result.error });
      } else {
        setFormMessage({ type: "success", text: "Reservation submitted for approval." });
        clearSelection();
      }
    });
  }

  function handleApprove(reservationId: string) {
    setModerationMessage((prev) => ({ ...prev, [reservationId]: { type: "success", text: "Approving…" } }));
    startTransition(async () => {
      const result = await moderateReservation(reservationId, "approved");
      setModerationMessage((prev) => ({
        ...prev,
        [reservationId]: result.error
          ? { type: "error", text: result.error }
          : { type: "success", text: "Reservation approved." }
      }));
    });
  }

  function handleDeclineSubmit(reservationId: string) {
    if (!declineReasonText.trim()) return;
    setModerationMessage((prev) => ({ ...prev, [reservationId]: { type: "success", text: "Declining…" } }));
    startTransition(async () => {
      const result = await moderateReservation(reservationId, "declined", declineReasonText.trim());
      if (result.error) {
        setModerationMessage((prev) => ({ ...prev, [reservationId]: { type: "error", text: result.error! } }));
      } else {
        setModerationMessage((prev) => ({ ...prev, [reservationId]: { type: "success", text: "Reservation declined." } }));
        setDeclineTargetId(null);
        setDeclineReasonText("");
      }
    });
  }

  return (
    <div className="grid gap-5 sm:gap-6">
      <section className="grid gap-5 sm:gap-6 lg:grid-cols-[1.5fr_1fr]">
        {/* ── Calendar grid ─────────────────────────────── */}
        <div className="card p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl sm:text-2xl">Monthly Reservation Calendar</h2>
            <div className="flex gap-2">
              <button type="button" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" onClick={() => setMonthCursor(subMonths(monthCursor, 1))}>
                Prev
              </button>
              <button type="button" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" onClick={() => setMonthCursor(addMonths(monthCursor, 1))}>
                Next
              </button>
            </div>
          </div>

          <p className="mt-2 text-sm text-slate-600">
            {format(monthCursor, "MMMM yyyy")} with US and Jewish holidays.
          </p>

          <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-500 sm:text-xs">
            {weekdayHeaders.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          <div className="mt-2 grid grid-cols-7 gap-1">
            {calendarDays.map((day) => {
              const dayKey = format(day, "yyyy-MM-dd");
              const reservationsOnDay = reservations.filter(
                (r) => dayKey >= r.startDate && dayKey <= r.endDate
              );
              const holidays = holidayMap[dayKey] ?? [];
              const isSelected = activeStart && activeEnd ? dayKey >= activeStart && dayKey <= activeEnd : false;

              return (
                <button
                  key={dayKey}
                  type="button"
                  onClick={() => onSelectDay(dayKey)}
                  className={[
                    "min-h-16 rounded-lg border p-1 text-left text-xs transition sm:min-h-20",
                    isSameMonth(day, monthCursor) ? "border-slate-200 bg-white" : "border-slate-100 bg-slate-50 text-slate-500",
                    isSelected ? "ring-2 ring-amber-500" : "",
                    selectionMode === "individual" ? "cursor-pointer" : "cursor-default"
                  ].join(" ")}
                >
                  <div className="font-semibold">{format(day, "d")}</div>

                  {holidays.slice(0, 2).map((holiday) => (
                    <div key={holiday} className="mt-1 truncate rounded bg-amber-100/80 px-1 text-[10px] text-amber-800">
                      {holiday}
                    </div>
                  ))}

                  {reservationsOnDay.slice(0, 2).map((r) => (
                    <div key={r.id} className={`mt-1 truncate rounded px-1 text-[10px] ${r.status === "approved" ? "bg-emerald-100/70 text-emerald-800" : r.status === "declined" ? "bg-rose-100/70 text-rose-800" : "bg-amber-100 text-amber-800"}`}>
                      {r.userName}
                    </div>
                  ))}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Create reservation form ────────────────────── */}
        <aside className="card card-strong p-5 sm:p-6">
          <h3 className="text-lg sm:text-xl">Create Reservation</h3>
          <p className="mt-2 text-sm text-slate-600">One reservation must be a continuous date block with no skipped days.</p>

          <div className="mt-4 grid gap-2 text-sm">
            <label className="flex items-center gap-2">
              <input type="radio" checked={selectionMode === "range"} onChange={() => setSelectionMode("range")} />
              Start and end date
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" checked={selectionMode === "individual"} onChange={() => setSelectionMode("individual")} />
              Select individual days (must stay contiguous)
            </label>
          </div>

          {selectionMode === "range" ? (
            <div className="mt-4 grid gap-4 text-sm">
              <label className="grid gap-1.5 font-medium">
                <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Start date</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
              <label className="grid gap-1.5 font-medium">
                <span className="text-xs uppercase tracking-[0.12em] text-slate-500">End date</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="rounded-lg border border-slate-300 px-3 py-2"
                />
              </label>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-slate-300 bg-white p-3 text-sm">
              <p>Selected start: {activeStart || "–"}</p>
              <p>Selected end: {activeEnd || "–"}</p>
              <p className="mt-2 text-xs text-slate-500">Tip: click adjacent days only. If you need a gap, create a second reservation.</p>
            </div>
          )}

          <label className="mt-4 grid gap-1.5 text-sm font-medium">
            <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Notes (optional)</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Reason for stay, any requests…"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none"
            />
          </label>

          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={isPending}
              onClick={handleSave}
              className="rounded-lg bg-amber-700 px-4 py-2 text-white disabled:opacity-50"
            >
              {isPending ? "Saving…" : "Save reservation"}
            </button>
            <button type="button" onClick={clearSelection} className="rounded-lg border border-slate-300 px-4 py-2">
              Clear
            </button>
          </div>

          {selectionStatus ? <p className="mt-3 text-xs text-slate-700">{selectionStatus}</p> : null}

          {formMessage ? (
            <p className={`mt-3 rounded-lg px-3 py-2 text-xs ${formMessage.type === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
              {formMessage.text}
            </p>
          ) : (
            <p className="mt-3 text-xs text-slate-700">
              {selectionHasConflict
                ? "⚠️ This date range conflicts with an existing reservation."
                : activeStart && activeEnd
                ? `${differenceInCalendarDays(parseISO(activeEnd), parseISO(activeStart)) + 1} nights selected — no conflict detected.`
                : "Select dates above to check availability."}
            </p>
          )}
        </aside>
      </section>

      {/* ── Reservation requests list ─────────────────── */}
      <div className="card p-5 sm:p-6">
        <h3 className="text-lg sm:text-xl">Reservation Requests</h3>
        <p className="mt-2 text-sm text-slate-600">
          Any admin can approve or deny requests. A reason is required for denials.
        </p>

        <div className="mt-5 grid gap-4">
          {reservations.map((reservation) => {
            const owner = users.find((u) => u.id === reservation.userId) ?? currentUser;
            const canModerate = canModerateReservation(currentUser, owner, reservation);
            const isDeclining = declineTargetId === reservation.id;
            const msg = moderationMessage[reservation.id];
            const sc = statusConfig[reservation.status];

            return (
              <article key={reservation.id} className="rounded-xl border border-slate-200 bg-white p-3.5 sm:p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold sm:text-base">{reservation.userName}</h4>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {reservation.startDate} to {reservation.endDate}
                      <span className="ml-2 text-slate-400">· {totalDaysInReservation(reservation)} nights</span>
                    </p>
                    {reservation.notes ? <p className="mt-1 text-sm text-slate-500">{reservation.notes}</p> : null}
                  </div>

                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${sc.cls}`}>
                    {sc.icon}
                    {sc.label}
                  </span>
                </div>

                {reservation.status === "declined" && reservation.declineReason ? (
                  <div className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-700">
                    <span className="font-semibold">Reason for denial: </span>
                    {reservation.declineReason}
                  </div>
                ) : null}

                {reservation.status === "approved" && reservation.reviewedByName ? (
                  <p className="mt-2 text-xs text-emerald-700">Approved by {reservation.reviewedByName}</p>
                ) : null}

                {msg ? (
                  <p className={`mt-3 rounded-lg px-3 py-2 text-xs ${msg.type === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
                    {msg.text}
                  </p>
                ) : null}

                {canModerate && reservation.status === "pending" && !isDeclining ? (
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleApprove(reservation.id)}
                      className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs text-white disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => { setDeclineTargetId(reservation.id); setDeclineReasonText(""); }}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700"
                    >
                      Deny
                    </button>
                  </div>
                ) : null}

                {canModerate && reservation.status === "pending" && isDeclining ? (
                  <div className="mt-3 grid gap-2">
                    <label className="text-xs font-medium text-slate-700">
                      Reason for denial <span className="text-rose-600">*</span>
                    </label>
                    <textarea
                      value={declineReasonText}
                      onChange={(e) => setDeclineReasonText(e.target.value)}
                      rows={2}
                      placeholder="Briefly explain why this request is being denied…"
                      className="rounded-lg border border-slate-300 px-3 py-2 text-xs resize-none"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={!declineReasonText.trim() || isPending}
                        onClick={() => handleDeclineSubmit(reservation.id)}
                        className="rounded-lg bg-[#6a3d33] px-3 py-1.5 text-xs text-white disabled:opacity-50"
                      >
                        Submit Denial
                      </button>
                      <button
                        type="button"
                        onClick={() => { setDeclineTargetId(null); setDeclineReasonText(""); }}
                        className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}

                {reservation.userId === currentUser.id && reservation.status === "pending" ? (
                  <p className="mt-3 text-xs uppercase tracking-wide text-slate-500">Awaiting review</p>
                ) : null}
              </article>
            );
          })}

          {reservations.length === 0 ? (
            <p className="text-sm text-slate-500">No reservations yet.</p>
          ) : null}
        </div>
      </div>

      {/* ── Activity log ──────────────────────────────── */}
      <ActivityLog reservations={reservations} />
    </div>
  );
}

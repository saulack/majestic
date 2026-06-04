"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  addDays,
  addMonths,
  compareAsc,
  eachDayOfInterval,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths
} from "date-fns";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { currentUser, mockUsers } from "@/lib/mock-data";
import { canModerateReservation } from "@/lib/rbac";
import { hasDateConflict, totalDaysInReservation } from "@/lib/reservation-utils";
import { createReservation, moderateReservation } from "@/app/reservations/actions";
import { ActivityLog } from "@/components/activity-log";
import { parseHolidayLabel, summarizeHolidayLabels } from "@/lib/reservation-holiday-utils";
import type { HolidayMap } from "@/lib/holidays";
import type { Reservation, UserProfile } from "@/lib/types";

type Props = {
  reservations: Reservation[];
  holidayMap: HolidayMap;
  users?: UserProfile[];
  approvalsEnabled: boolean;
};

const weekdayHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const statusConfig = {
  approved: { label: "Booked", cls: "bg-emerald-100/70 text-emerald-800", icon: <CheckCircle2 className="inline h-3 w-3" /> },
  declined: { label: "Declined", cls: "bg-rose-100/70 text-rose-800", icon: <XCircle className="inline h-3 w-3" /> },
  pending: { label: "Pending", cls: "bg-amber-100 text-amber-800", icon: <Clock className="inline h-3 w-3" /> }
} as const;

function holidayChipClass(kind: "us" | "jewish", inBookedCell: boolean) {
  if (inBookedCell) {
    return "border-white/35 bg-white/20 text-white";
  }

  return kind === "us"
    ? "border-[#b07a7a]/50 bg-[#f4e6e6] text-[#8a4f4f]"
    : "border-[#7a92ba]/50 bg-[#e7eef8] text-[#4d678c]";
}

function normalizeRange(first: string, second: string) {
  return compareAsc(parseISO(first), parseISO(second)) <= 0 ? [first, second] : [second, first];
}

export function MonthlyReservationsCalendar({ reservations, holidayMap, users = mockUsers, approvalsEnabled }: Props) {
  const [monthCursor, setMonthCursor] = useState(startOfMonth(new Date()));
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [selectionStatus, setSelectionStatus] = useState("");
  const [formMessage, setFormMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [hoveredDay, setHoveredDay] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [declineTargetId, setDeclineTargetId] = useState<string | null>(null);
  const [declineReasonText, setDeclineReasonText] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const dragAnchorRef = useRef<string | null>(null);
  const touchHoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const monthStart = startOfMonth(monthCursor);
  const calendarStart = startOfWeek(monthStart);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: addDays(calendarStart, 41) });

  const activeStart = startDate;
  const activeEnd = endDate;
  const selectionHasConflict = activeStart && activeEnd ? hasDateConflict(reservations, activeStart, activeEnd) : false;

  const activeDay = hoveredDay ?? selectedDay;
  const activeDayReservations = activeDay
    ? reservations.filter((reservation) => activeDay >= reservation.startDate && activeDay <= reservation.endDate)
    : [];
  const activeDayHolidayLabels = activeDay ? holidayMap[activeDay] ?? [] : [];
  const activeDayHolidayMeta = activeDayHolidayLabels.map(parseHolidayLabel);

  useEffect(() => {
    function onWindowMouseUp() {
      setIsDragging(false);
      dragAnchorRef.current = null;
    }

    window.addEventListener("mouseup", onWindowMouseUp);
    return () => {
      window.removeEventListener("mouseup", onWindowMouseUp);
    };
  }, []);

  function applyRange(first: string, second: string, source: "calendar" | "input") {
    const [nextStart, nextEnd] = normalizeRange(first, second);
    setStartDate(nextStart);
    setEndDate(nextEnd);
    setSelectionStatus(source === "calendar" ? "Selection updated from calendar." : "Selection updated from date fields.");
  }

  function handleCalendarClick(dayKey: string) {
    setSelectedDay(dayKey);

    if (isDragging) {
      return;
    }

    if (!startDate || !endDate) {
      setStartDate(dayKey);
      setEndDate(dayKey);
      setSelectionStatus("Selected first day. Click another day or drag to extend.");
      return;
    }

    if (startDate === endDate) {
      applyRange(startDate, dayKey, "calendar");
      return;
    }

    setStartDate(dayKey);
    setEndDate(dayKey);
    setSelectionStatus("Selection reset to one day. Click another day or drag to extend.");
  }

  function handleCalendarMouseDown(dayKey: string) {
    setSelectedDay(dayKey);
    setIsDragging(true);
    dragAnchorRef.current = dayKey;
    setStartDate(dayKey);
    setEndDate(dayKey);
    setSelectionStatus("Drag across days to select a range.");
  }

  function handleCalendarMouseEnter(dayKey: string) {
    setHoveredDay(dayKey);

    if (!isDragging || !dragAnchorRef.current) {
      return;
    }

    applyRange(dragAnchorRef.current, dayKey, "calendar");
  }

  function handleCalendarMouseUp(dayKey: string) {
    if (isDragging && dragAnchorRef.current) {
      applyRange(dragAnchorRef.current, dayKey, "calendar");
    }

    setIsDragging(false);
    dragAnchorRef.current = null;
  }

  function handleTouchStart(dayKey: string) {
    if (touchHoldTimerRef.current) {
      clearTimeout(touchHoldTimerRef.current);
    }

    touchHoldTimerRef.current = setTimeout(() => {
      setSelectedDay(dayKey);
      setHoveredDay(dayKey);
    }, 450);
  }

  function handleTouchEnd() {
    if (touchHoldTimerRef.current) {
      clearTimeout(touchHoldTimerRef.current);
      touchHoldTimerRef.current = null;
    }
  }

  function clearSelection() {
    setStartDate("");
    setEndDate("");
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
      const result = await createReservation({
        startDate: s,
        endDate: e,
        notes,
        approvalEnabled: approvalsEnabled
      });

      if (result.error) {
        setFormMessage({ type: "error", text: result.error });
      } else {
        setFormMessage({
          type: "success",
          text: approvalsEnabled ? "Reservation submitted for approval." : "Reservation booked."
        });
        clearSelection();
      }
    });
  }

  function handleApprove(reservationId: string) {
    setFormMessage(null);
    startTransition(async () => {
      const result = await moderateReservation(reservationId, "approved");
      if (result.error) {
        setFormMessage({ type: "error", text: result.error });
      } else {
        setFormMessage({ type: "success", text: "Reservation approved." });
      }
    });
  }

  function handleDeclineSubmit(reservationId: string) {
    if (!declineReasonText.trim()) return;
    setFormMessage(null);
    startTransition(async () => {
      const result = await moderateReservation(reservationId, "declined", declineReasonText.trim());
      if (result.error) {
        setFormMessage({ type: "error", text: result.error });
      } else {
        setFormMessage({ type: "success", text: "Reservation declined." });
        setDeclineTargetId(null);
        setDeclineReasonText("");
      }
    });
  }

  return (
    <div className="grid gap-6">
      <aside className="card card-strong p-5 sm:p-6">
        <h3 className="text-lg sm:text-xl">Create Reservation</h3>
        <p className="mt-2 text-sm text-slate-600">
          Use the date fields, click dates, or drag across the calendar. The latest action always sets the active reservation range.
        </p>

        <div className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <label className="grid gap-1.5 font-medium">
            <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Start date</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                const nextStart = e.target.value;
                setStartDate(nextStart);

                if (!endDate) {
                  setEndDate(nextStart);
                } else if (nextStart && endDate) {
                  applyRange(nextStart, endDate, "input");
                }
              }}
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="grid gap-1.5 font-medium">
            <span className="text-xs uppercase tracking-[0.12em] text-slate-500">End date</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                const nextEnd = e.target.value;
                setEndDate(nextEnd);

                if (!startDate) {
                  setStartDate(nextEnd);
                } else if (startDate && nextEnd) {
                  applyRange(startDate, nextEnd, "input");
                }
              }}
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
        </div>

        <label className="mt-4 grid gap-1.5 text-sm font-medium">
          <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Notes (optional)</span>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Reason for stay, any requests..."
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm resize-none"
          />
        </label>

        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" onClick={clearSelection} className="rounded-lg border border-slate-300 px-4 py-2">
            Clear
          </button>
        </div>

        {selectionStatus ? <p className="mt-3 text-xs text-slate-700">{selectionStatus}</p> : null}

        {formMessage ? (
          <p className={`mt-3 rounded-lg px-3 py-2 text-xs ${formMessage.type === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
            {formMessage.text}
          </p>
        ) : null}
      </aside>

      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl">Monthly Reservation Calendar</h2>
            <p className="mt-2 text-sm text-slate-600">Hover a day on desktop, or long-press on mobile, to inspect holidays and reservations.</p>
          </div>
          <div className="flex gap-2">
            <button type="button" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" onClick={() => setMonthCursor(subMonths(monthCursor, 1))}>
              Prev
            </button>
            <button type="button" className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm" onClick={() => setMonthCursor(addMonths(monthCursor, 1))}>
              Next
            </button>
          </div>
        </div>

        <p className="mt-3 text-sm text-slate-600">{format(monthCursor, "MMMM yyyy")}</p>

        <div className="mt-4 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-500 sm:text-xs">
          {weekdayHeaders.map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>

        <div className="mt-2 grid grid-cols-7 gap-1">
          {calendarDays.map((day) => {
            const dayKey = format(day, "yyyy-MM-dd");
            const reservationsOnDay = reservations.filter((reservation) => dayKey >= reservation.startDate && dayKey <= reservation.endDate);
            const holidays = holidayMap[dayKey] ?? [];
            const isSelected = activeStart && activeEnd ? dayKey >= activeStart && dayKey <= activeEnd : false;
            const isFocused = activeDay === dayKey;
            const primaryReservation =
              reservationsOnDay.find((reservation) => reservation.status === "approved") ??
              reservationsOnDay.find((reservation) => reservation.status === "pending") ??
              reservationsOnDay[0];
            const isBookedCell = Boolean(primaryReservation);
            const isOwnReservation = primaryReservation?.userId === currentUser.id;

            const bookedCellCls =
              primaryReservation?.status === "declined"
                ? "bg-rose-300 text-rose-900 border-rose-400"
                : !isOwnReservation
                  ? "bg-slate-300 text-slate-900 border-slate-400"
                  : primaryReservation?.status === "pending"
                  ? "bg-amber-400 text-amber-950 border-amber-500"
                  : "bg-emerald-600 text-white border-emerald-700";

            return (
              <button
                key={dayKey}
                type="button"
                onClick={() => handleCalendarClick(dayKey)}
                onMouseDown={() => handleCalendarMouseDown(dayKey)}
                onMouseEnter={() => handleCalendarMouseEnter(dayKey)}
                onMouseUp={() => handleCalendarMouseUp(dayKey)}
                onMouseLeave={() => setHoveredDay(null)}
                onFocus={() => setHoveredDay(dayKey)}
                onBlur={() => setHoveredDay(null)}
                onTouchStart={() => handleTouchStart(dayKey)}
                onTouchEnd={handleTouchEnd}
                className={[
                  "min-h-24 rounded-lg border p-2 text-left text-xs transition sm:min-h-28",
                  isSameMonth(day, monthCursor) ? "" : "opacity-65",
                  isBookedCell ? bookedCellCls : "border-slate-200 bg-white",
                  isSelected ? "ring-2 ring-amber-500 ring-offset-1" : "",
                  isFocused ? "shadow-[0_0_0_1px_rgba(153,122,32,0.3)]" : ""
                ].join(" ")}
              >
                <div className={`text-xs font-semibold ${isBookedCell ? "text-inherit" : "text-slate-800"}`}>{format(day, "d")}</div>

                {primaryReservation ? (
                  <div className="mt-2">
                    <p className="truncate text-[11px] font-semibold leading-tight">{primaryReservation.userName}</p>
                    {reservationsOnDay.length > 1 ? <p className="mt-0.5 text-[10px]">+{reservationsOnDay.length - 1} more</p> : null}
                  </div>
                ) : holidays.length > 0 ? (
                  holidays.slice(0, 2).map((holiday) => {
                    const parsed = parseHolidayLabel(holiday);
                    return (
                      <div key={holiday} className={`mt-1 truncate rounded border px-1 text-[10px] ${holidayChipClass(parsed.kind, false)}`}>
                        {parsed.name}
                      </div>
                    );
                  })
                ) : (
                  <div className="mt-2 text-[10px] text-slate-400">Available</div>
                )}

                {isBookedCell && holidays.length > 0 ? (
                  <div className="mt-1 grid gap-1">
                    {holidays.slice(0, 1).map((holiday) => {
                      const parsed = parseHolidayLabel(holiday);
                      return (
                        <div key={holiday} className={`truncate rounded border px-1 text-[10px] ${holidayChipClass(parsed.kind, true)}`}>
                          {parsed.name}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-600">
            Active range: {activeStart || "-"} to {activeEnd || "-"}
          </p>
          <button
            type="button"
            disabled={isPending}
            onClick={handleSave}
            className="rounded-lg bg-amber-700 px-4 py-2 text-white disabled:opacity-50"
          >
            {isPending ? "Reserving..." : approvalsEnabled ? "Reserve dates (submit for approval)" : "Reserve dates"}
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-[#fbf8f2] p-4">
          {activeDay ? (
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800">{format(parseISO(activeDay), "EEEE, MMMM d, yyyy")}</p>
                  <p className="text-xs text-slate-500">Hover a day or long-press on mobile to pin it here.</p>
                </div>
                <button type="button" className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs" onClick={() => setSelectedDay(null)}>
                  Clear pin
                </button>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Holiday info</p>
                  {activeDayHolidayMeta.length > 0 ? (
                    <div className="mt-2 grid gap-2">
                      {activeDayHolidayMeta.map((holiday) => (
                        <div key={holiday.raw} className={`rounded-lg border px-3 py-2 text-sm ${holidayChipClass(holiday.kind, false)}`}>
                          {holiday.name}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">No holiday on this date.</p>
                  )}
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <p className="text-xs uppercase tracking-[0.12em] text-slate-500">Reservations on this day</p>
                  {activeDayReservations.length > 0 ? (
                    <div className="mt-2 grid gap-2">
                      {activeDayReservations.map((reservation) => (
                        <div key={reservation.id} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                          <p className="font-medium text-slate-800">{reservation.userName}</p>
                          <p className="text-xs text-slate-500">
                            {totalDaysInReservation(reservation)} {totalDaysInReservation(reservation) === 1 ? "night" : "nights"} • {reservation.status === "declined" ? "declined" : reservation.status === "pending" ? "pending" : "booked"}
                          </p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-slate-500">No reservation on this date.</p>
                  )}
                </div>
              </div>

              {activeDayHolidayMeta.length > 0 ? (
                <p className="text-xs text-slate-500">
                  Holiday focus: {summarizeHolidayLabels(activeDayHolidayMeta)}
                </p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Hover over a day or long-press a day on mobile to preview details here.</p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-[#8a4f4f]" /> US holiday
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-[#4d678c]" /> Jewish holiday
          </span>
        </div>

        {approvalsEnabled ? (
          <div className="mt-6 grid gap-4">
            <h3 className="text-lg sm:text-xl">Reservation Requests</h3>
            <p className="text-sm text-slate-600">Approvals are active from the admin portal.</p>

            <div className="grid gap-4">
              {reservations.map((reservation) => {
                const owner = users.find((u) => u.id === reservation.userId) ?? currentUser;
                const canModerate = canModerateReservation(currentUser, owner, reservation);
                const msg = reservation.status === "approved" ? "Booked" : reservation.status === "declined" ? "Declined" : "Pending";

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

                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${reservation.status === "approved" ? statusConfig.approved.cls : reservation.status === "declined" ? statusConfig.declined.cls : statusConfig.pending.cls}`}>
                        {reservation.status === "approved" ? statusConfig.approved.icon : reservation.status === "declined" ? statusConfig.declined.icon : statusConfig.pending.icon}
                        {msg}
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

                    {canModerate && reservation.status === "pending" && declineTargetId !== reservation.id ? (
                      <div className="mt-3 flex flex-wrap gap-2">
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
                          onClick={() => {
                            setDeclineTargetId(reservation.id);
                            setDeclineReasonText("");
                          }}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700"
                        >
                          Deny
                        </button>
                      </div>
                    ) : null}

                    {canModerate && reservation.status === "pending" && declineTargetId === reservation.id ? (
                      <div className="mt-3 grid gap-2">
                        <label className="text-xs font-medium text-slate-700">
                          Reason for denial <span className="text-rose-600">*</span>
                        </label>
                        <textarea
                          value={declineReasonText}
                          onChange={(event) => setDeclineReasonText(event.target.value)}
                          rows={2}
                          placeholder="Briefly explain why this request is being denied..."
                          className="rounded-lg border border-slate-300 px-3 py-2 text-xs resize-none"
                        />
                        <div className="flex flex-wrap gap-2">
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
                            onClick={() => {
                              setDeclineTargetId(null);
                              setDeclineReasonText("");
                            }}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs text-slate-700"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </article>
                );
              })}
            </div>
          </div>
        ) : (
          <p className="mt-6 text-sm text-slate-500">
            Approval workflow is currently paused in the admin portal. Reservations are booked directly.
          </p>
        )}
      </section>

      <ActivityLog reservations={reservations} holidayMap={holidayMap} approvalsEnabled={approvalsEnabled} />
    </div>
  );
}

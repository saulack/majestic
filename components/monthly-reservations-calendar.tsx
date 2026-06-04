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
import { CheckCircle2, ChevronLeft, ChevronRight, Clock, XCircle } from "lucide-react";
import { currentUser, mockUsers } from "@/lib/mock-data";
import { canModerateReservation } from "@/lib/rbac";
import { hasDateConflict, totalDaysInReservation } from "@/lib/reservation-utils";
import { createReservation, moderateReservation } from "@/app/reservations/actions";
import { ActivityLog } from "@/components/activity-log";
import { ToggleSwitch } from "@/components/toggle-switch";
import { parseHolidayLabel } from "@/lib/reservation-holiday-utils";
import type { HolidayMap } from "@/lib/holidays";
import type { Reservation, UserProfile } from "@/lib/types";

type Props = {
  reservations: Reservation[];
  holidayMap: HolidayMap;
  users?: UserProfile[];
  actingUser?: UserProfile;
  approvalsEnabled: boolean;
};

const weekdayHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const statusConfig = {
  approved: { label: "Booked", cls: "bg-[#d7f2ea] text-[#1f7d6e]", icon: <CheckCircle2 className="inline h-3 w-3" /> },
  declined: { label: "Declined", cls: "bg-[#ffe4dc] text-[#c56758]", icon: <XCircle className="inline h-3 w-3" /> },
  pending: { label: "Pending", cls: "bg-[#d9f1f5] text-[#317f8c]", icon: <Clock className="inline h-3 w-3" /> }
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

export function MonthlyReservationsCalendar({ reservations, holidayMap, users = mockUsers, actingUser = currentUser, approvalsEnabled }: Props) {
  const [monthCursor, setMonthCursor] = useState(startOfMonth(new Date()));
  const [reservationMode, setReservationMode] = useState<"self" | "other">("self");
  const [selectedUserId, setSelectedUserId] = useState(actingUser.id);
  const [allowDoubleBooking, setAllowDoubleBooking] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [selectionStatus, setSelectionStatus] = useState("");
  const [formMessage, setFormMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();
  const [declineTargetId, setDeclineTargetId] = useState<string | null>(null);
  const [declineReasonText, setDeclineReasonText] = useState("");
  const [isDragging, setIsDragging] = useState(false);

  const dragAnchorRef = useRef<string | null>(null);

  const monthStart = startOfMonth(monthCursor);
  const calendarStart = startOfWeek(monthStart);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: addDays(calendarStart, 41) });

  const activeStart = startDate;
  const activeEnd = endDate;
  const otherUsers = users.filter((user) => user.id !== actingUser.id);
  const bookingTargetId = reservationMode === "self" ? actingUser.id : selectedUserId;
  const selectionHasConflict = activeStart && activeEnd ? hasDateConflict(reservations, activeStart, activeEnd) : false;

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

    const previousEdgeDay = format(addDays(parseISO(startDate), -1), "yyyy-MM-dd");
    const nextEdgeDay = format(addDays(parseISO(endDate), 1), "yyyy-MM-dd");

    if (dayKey === previousEdgeDay) {
      setStartDate(dayKey);
      setSelectionStatus("Added one day to the start of the range.");
      return;
    }

    if (dayKey === nextEdgeDay) {
      setEndDate(dayKey);
      setSelectionStatus("Added one day to the end of the range.");
      return;
    }

    if (dayKey >= startDate && dayKey <= endDate) {
      setSelectionStatus("That day is already in the selected range.");
      return;
    }

    applyRange(startDate, dayKey, "calendar");
    setSelectionStatus("Expanded range to include selected day.");
  }

  function handleCalendarMouseDown(dayKey: string) {
    setIsDragging(true);
    dragAnchorRef.current = dayKey;
    setStartDate(dayKey);
    setEndDate(dayKey);
    setSelectionStatus("Drag across days to select a range.");
  }

  function handleCalendarMouseEnter(dayKey: string) {
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

  function clearSelection() {
    setStartDate("");
    setEndDate("");
    setNotes("");
    setSelectionStatus("");
    setFormMessage(null);
    setReservationMode("self");
    setSelectedUserId(actingUser.id);
    setAllowDoubleBooking(false);
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

    if (selectionHasConflict && !allowDoubleBooking) {
      setFormMessage({ type: "error", text: "This date range conflicts with an existing reservation." });
      return;
    }

    setFormMessage(null);
    startTransition(async () => {
      const result = await createReservation({
        startDate: s,
        endDate: e,
        notes,
        bookedForUserId: bookingTargetId,
        allowDoubleBooking,
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
        <h3 className="text-lg sm:text-xl">Reservation Settings</h3>
        <p className="mt-2 text-sm text-slate-600">
          Configure how this reservation should be created, then choose dates directly in the calendar area.
        </p>

        <div className="mt-4 grid gap-4 text-sm">
          <div className="grid gap-1.5 sm:col-span-2">
            <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Reservation for</span>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div>
                <p className="text-sm font-medium text-slate-800">{reservationMode === "self" ? "Reserve for me" : "Reserve for someone else"}</p>
                <p className="text-sm text-slate-500">Switch on when you are booking on behalf of another user.</p>
              </div>
              <ToggleSwitch
                checked={reservationMode === "other"}
                onCheckedChange={(checked) => {
                  if (checked) {
                    setReservationMode("other");
                    setSelectedUserId(otherUsers[0]?.id ?? "");
                    return;
                  }

                  setReservationMode("self");
                  setSelectedUserId(actingUser.id);
                }}
                srLabel="Toggle reservation target"
                offLabel="Me"
                onLabel="Someone else"
              />
            </div>
          </div>

          {reservationMode === "other" ? (
            <label className="grid gap-1.5 font-medium sm:col-span-2">
              <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Choose user</span>
              <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} className="rounded-lg border border-slate-300 px-3 py-2">
                {otherUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.fullName}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <div className="grid gap-1.5 sm:col-span-2">
            <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Double booking</span>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div>
                <p className="text-sm font-medium text-slate-800">{allowDoubleBooking ? "Double booking allowed" : "Double booking off"}</p>
                <p className="text-sm text-slate-500">Turn this on only when two people are intentionally sharing the same stay dates.</p>
              </div>
              <ToggleSwitch
                checked={allowDoubleBooking}
                onCheckedChange={setAllowDoubleBooking}
                srLabel="Allow double booking"
                offLabel="Off"
                onLabel="On"
              />
            </div>
          </div>
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
        <h2 className="text-xl sm:text-2xl">Monthly Reservation Calendar</h2>

        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
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
              className="rounded-lg border border-slate-300 bg-white px-3 py-2"
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
              className="rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
          </label>
        </div>

        <p className="mt-4 text-2xl font-bold text-slate-900 sm:text-3xl">{format(monthCursor, "MMMM yyyy")}</p>

        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50"
            onClick={() => setMonthCursor(subMonths(monthCursor, 1))}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50"
            onClick={() => setMonthCursor(addMonths(monthCursor, 1))}
            aria-label="Next month"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold text-slate-500 sm:text-xs">
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
            const primaryReservation =
              reservationsOnDay.find((reservation) => reservation.status === "approved") ??
              reservationsOnDay.find((reservation) => reservation.status === "pending") ??
              reservationsOnDay[0];
            const hasSharedStay = reservationsOnDay.length > 1;
            const isBookedCell = Boolean(primaryReservation);
            const isOwnReservation = primaryReservation?.userId === actingUser.id;
            const sharedStayGuests = reservationsOnDay.slice(0, 2);
            const extraSharedStayCount = Math.max(reservationsOnDay.length - sharedStayGuests.length, 0);

            const bookedCellCls =
              hasSharedStay
                ? "border-[#6bbfc7] bg-[linear-gradient(135deg,#e6fbf6_0%,#b8ecdf_38%,#9fd8eb_100%)] text-[#103b44] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
                : primaryReservation?.status === "declined"
                ? "bg-rose-300 text-rose-900 border-rose-400"
                : !isOwnReservation
                  ? "bg-slate-300 text-slate-900 border-slate-400"
                  : primaryReservation?.status === "pending"
                  ? "bg-[#9fd9e2] text-[#184f5a] border-[#7fc1cc]"
                  : "bg-[#62bea9] text-white border-[#49a38f]";

            return (
              <button
                key={dayKey}
                type="button"
                onClick={() => handleCalendarClick(dayKey)}
                onMouseDown={() => handleCalendarMouseDown(dayKey)}
                onMouseEnter={() => handleCalendarMouseEnter(dayKey)}
                onMouseUp={() => handleCalendarMouseUp(dayKey)}
                className={[
                  "min-h-24 rounded-lg border p-2 text-left text-xs transition sm:min-h-28",
                  isSameMonth(day, monthCursor) ? "" : "opacity-65",
                  isBookedCell ? bookedCellCls : "border-slate-200 bg-white",
                  isSelected ? "ring-2 ring-amber-500 ring-offset-1" : ""
                ].join(" ")}
              >
                <div className={`text-xs font-semibold ${isBookedCell ? "text-inherit" : "text-slate-800"}`}>{format(day, "d")}</div>

                {primaryReservation ? (
                  <div className="mt-2">
                    {hasSharedStay ? (
                      <div className="space-y-1">
                        {sharedStayGuests.map((reservation) => (
                          <p key={reservation.id} className="truncate rounded-md bg-white/55 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-[#103b44] backdrop-blur-[1px]">
                            {reservation.userName}
                          </p>
                        ))}
                        {extraSharedStayCount > 0 ? (
                          <p className="text-[10px] font-medium text-[#245f68]">+{extraSharedStayCount} more</p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="truncate text-[11px] font-semibold leading-tight">{primaryReservation.userName}</p>
                    )}
                    {hasSharedStay ? (
                      <div className="mt-1 inline-flex items-center rounded-full border border-white/50 bg-white/45 px-1.5 py-0.5 text-[10px] font-medium text-[#245f68]">
                        Shared stay
                      </div>
                    ) : null}
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
            {selectionHasConflict && allowDoubleBooking
              ? `Active range: ${activeStart || "-"} to ${activeEnd || "-"} · overlap allowed`
              : `Active range: ${activeStart || "-"} to ${activeEnd || "-"}`}
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
                const owner = users.find((u) => u.id === reservation.userId) ?? actingUser;
                const canModerate = canModerateReservation(actingUser, owner, reservation);
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
                            className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs text-white disabled:opacity-50"
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

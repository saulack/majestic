"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
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
import { canModerateReservation } from "@/lib/rbac";
import { hasDateConflict, totalDaysInReservation } from "@/lib/reservation-utils";
import { createReservation, deleteReservation, moderateReservation } from "@/app/reservations/actions";
import { ActivityLog } from "@/components/activity-log";
import { ToggleSwitch } from "@/components/toggle-switch";
import { parseHolidayLabel } from "@/lib/reservation-holiday-utils";
import type { HolidayMap } from "@/lib/holidays";
import type { MaintenanceNotification, MaintenanceRecord, Reservation, UserProfile } from "@/lib/types";

type Props = {
  reservations: Reservation[];
  maintenanceRecords: MaintenanceRecord[];
  maintenanceNotifications: MaintenanceNotification[];
  holidayMap: HolidayMap;
  users: UserProfile[];
  actingUser: UserProfile;
  approvalsEnabled: boolean;
};

const weekdayHeaders = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const statusConfig = {
  approved: { label: "Booked", cls: "bg-[#d7f2ea] text-[#1f7d6e]", icon: <CheckCircle2 className="inline h-3 w-3" /> },
  declined: { label: "Canceled", cls: "bg-[#ffe4dc] text-[#c56758]", icon: <XCircle className="inline h-3 w-3" /> },
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

export function MonthlyReservationsCalendar({
  reservations,
  maintenanceRecords,
  maintenanceNotifications,
  holidayMap,
  users,
  actingUser,
  approvalsEnabled
}: Props) {
  const [monthCursor, setMonthCursor] = useState(startOfMonth(new Date()));
  const [reservationMode, setReservationMode] = useState<"self" | "other">("self");
  const [selectedUserId, setSelectedUserId] = useState(actingUser.id);
  const [allowDoubleBooking, setAllowDoubleBooking] = useState(false);
  const [isOverlapUsersSubmenuOpen, setIsOverlapUsersSubmenuOpen] = useState(true);
  const [shareScope, setShareScope] = useState<"whole" | "range">("whole");
  const [sharedWithUserIds, setSharedWithUserIds] = useState<string[]>([]);
  const [sharedRangeStartDate, setSharedRangeStartDate] = useState("");
  const [sharedRangeEndDate, setSharedRangeEndDate] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [notes, setNotes] = useState("");
  const [selectionStatus, setSelectionStatus] = useState("");
  const [calendarSelectionError, setCalendarSelectionError] = useState("");
  const [formMessage, setFormMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [monthTransitionDirection, setMonthTransitionDirection] = useState<"left" | "right" | null>(null);
  const [isPending, startTransition] = useTransition();
  const searchParams = useSearchParams();
  const [declineTargetId, setDeclineTargetId] = useState<string | null>(null);
  const [declineReasonText, setDeclineReasonText] = useState("");
  const isDraggingRef = useRef(false);
  const hasAppliedQueryParamsRef = useRef(false);
  const dragMovedRef = useRef(false);
  const touchPointerActiveRef = useRef(false);
  const touchStartXRef = useRef(0);
  const touchStartYRef = useRef(0);
  const suppressNextTouchClickRef = useRef(false);
  const monthSwipeStartXRef = useRef(0);
  const monthSwipeStartYRef = useRef(0);
  const monthSwipeTrackingRef = useRef(false);
  const monthSwipeFromInteractiveRef = useRef(false);
  const monthSwipeDirectionRef = useRef<"left" | "right" | null>(null);
  const canDeleteAnyReservation = actingUser.role === "superadmin";
  const canBookForOthers = users.length > 1;

  const monthStart = startOfMonth(monthCursor);
  const calendarStart = startOfWeek(monthStart);
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: addDays(calendarStart, 41) });
  const todayKey = format(new Date(), "yyyy-MM-dd");

  const activeStart = startDate;
  const activeEnd = endDate;
  const otherUsers = users.filter((user) => user.id !== actingUser.id);
  const bookingTargetId = reservationMode === "self" ? actingUser.id : selectedUserId;
  const shareableUsers = users.filter((user) => user.id !== bookingTargetId);
  const requestedShareRangeStart = allowDoubleBooking && shareScope === "range" && sharedRangeStartDate && sharedRangeEndDate
    ? sharedRangeStartDate
    : undefined;
  const requestedShareRangeEnd = allowDoubleBooking && shareScope === "range" && sharedRangeStartDate && sharedRangeEndDate
    ? sharedRangeEndDate
    : undefined;
  const hasActiveSelection = Boolean(activeStart && activeEnd);
  const selectionHasConflict = activeStart && activeEnd
    ? hasDateConflict(
        reservations,
        activeStart,
        activeEnd,
        undefined,
        bookingTargetId,
        sharedWithUserIds,
        requestedShareRangeStart,
        requestedShareRangeEnd
      )
    : false;

  useEffect(() => {
    function stopDragging() {
      isDraggingRef.current = false;
    }

    window.addEventListener("pointerup", stopDragging);
    window.addEventListener("pointercancel", stopDragging);

    return () => {
      window.removeEventListener("pointerup", stopDragging);
      window.removeEventListener("pointercancel", stopDragging);
    };
  }, []);

  useEffect(() => {
    const start = searchParams.get("start");
    const end = searchParams.get("end");

    if (start && end && !hasAppliedQueryParamsRef.current) {
      hasAppliedQueryParamsRef.current = true;
      setStartDate(start);
      setEndDate(end);
      setMonthCursor(startOfMonth(parseISO(start)));
      setSelectionStatus("Dates pre-populated from reservation.");
    }
  }, [searchParams]);

  useEffect(() => {
    if (!monthTransitionDirection) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setMonthTransitionDirection(null);
    }, 220);

    return () => window.clearTimeout(timeoutId);
  }, [monthTransitionDirection, monthCursor]);

  function moveMonth(direction: "left" | "right") {
    setMonthTransitionDirection(direction);
    setMonthCursor((current) => (direction === "left" ? addMonths(current, 1) : subMonths(current, 1)));
  }

  function applyRange(first: string, second: string, source: "calendar" | "input") {
    const [nextStart, nextEnd] = normalizeRange(first, second);
    setStartDate(nextStart);
    setEndDate(nextEnd);
    if (source === "input") {
      setMonthCursor(startOfMonth(parseISO(nextStart)));
    }
    setSelectionStatus(source === "calendar" ? "Selection updated from calendar." : "Selection updated from date fields.");
  }

  function canSelectRange(first: string, second: string) {
    const [rangeStart, rangeEnd] = normalizeRange(first, second);
    return !hasDateConflict(
      reservations,
      rangeStart,
      rangeEnd,
      undefined,
      bookingTargetId,
      allowDoubleBooking ? sharedWithUserIds : [],
      allowDoubleBooking && shareScope === "range" && sharedRangeStartDate && sharedRangeEndDate ? sharedRangeStartDate : undefined,
      allowDoubleBooking && shareScope === "range" && sharedRangeStartDate && sharedRangeEndDate ? sharedRangeEndDate : undefined
    );
  }

  function handleCalendarClick(dayKey: string) {
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }

    if (calendarSelectionError) {
      setCalendarSelectionError("");
    }

    if (!startDate || !endDate) {
      if (!canSelectRange(dayKey, dayKey)) {
        setCalendarSelectionError("That date is unavailable for booking. Pick another day or enable overlap booking.");
        return;
      }

      setStartDate(dayKey);
      setEndDate(dayKey);
      setSelectionStatus("Selected first day. Click another day or drag to extend.");
      return;
    }

    if (dayKey >= startDate && dayKey <= endDate) {
      if (startDate === endDate) {
        clearSelection();
        setSelectionStatus("Selection cleared.");
        return;
      }

      if (dayKey === startDate) {
        const nextStart = format(addDays(parseISO(startDate), 1), "yyyy-MM-dd");
        setStartDate(nextStart);
        setSelectionStatus("Removed one day from the start of the range.");
        return;
      }

      if (dayKey === endDate) {
        const nextEnd = format(addDays(parseISO(endDate), -1), "yyyy-MM-dd");
        setEndDate(nextEnd);
        setSelectionStatus("Removed one day from the end of the range.");
        return;
      }

      const trimmedEnd = format(addDays(parseISO(dayKey), -1), "yyyy-MM-dd");
      setEndDate(trimmedEnd);
      setSelectionStatus("Range shortened to deselect that day.");
      return;
    }

    const nextStart = compareAsc(parseISO(dayKey), parseISO(startDate)) < 0 ? dayKey : startDate;
    const nextEnd = compareAsc(parseISO(dayKey), parseISO(endDate)) > 0 ? dayKey : endDate;

    if (!canSelectRange(nextStart, nextEnd)) {
      setCalendarSelectionError("Some selected dates are unavailable. Choose open dates or allow overlap booking.");
      return;
    }

    applyRange(nextStart, nextEnd, "calendar");
    setSelectionStatus("Expanded range to include selected day.");
  }

  function handleCalendarPointerDown(event: React.PointerEvent<HTMLButtonElement>, dayKey: string) {
    if (event.pointerType === "touch") {
      touchPointerActiveRef.current = true;
      touchStartXRef.current = event.clientX;
      touchStartYRef.current = event.clientY;
      suppressNextTouchClickRef.current = false;
      return;
    }

    isDraggingRef.current = true;
    dragMovedRef.current = false;

    if (calendarSelectionError) {
      setCalendarSelectionError("");
    }

    if (!startDate || !endDate) {
      if (!canSelectRange(dayKey, dayKey)) {
        isDraggingRef.current = false;
        setCalendarSelectionError("That date is unavailable for booking. Pick another day or enable overlap booking.");
        return;
      }

      setStartDate(dayKey);
      setEndDate(dayKey);
      setSelectionStatus("Selected first day. Drag right to add days.");
      return;
    }

    const clampedTarget = compareAsc(parseISO(dayKey), parseISO(startDate)) < 0 ? startDate : dayKey;

    if (compareAsc(parseISO(clampedTarget), parseISO(endDate)) > 0 && !canSelectRange(startDate, clampedTarget)) {
      isDraggingRef.current = false;
      setCalendarSelectionError("Some selected dates are unavailable. Choose open dates or allow overlap booking.");
      return;
    }

    setEndDate(clampedTarget);
    setSelectionStatus("Drag to later dates to add. Drag to earlier dates to remove.");
  }

  function handleCalendarTouchMove(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== "touch" || !touchPointerActiveRef.current) {
      return;
    }

    const deltaX = Math.abs(event.clientX - touchStartXRef.current);
    const deltaY = Math.abs(event.clientY - touchStartYRef.current);
    if (deltaY > 8 || deltaX > 8) {
      suppressNextTouchClickRef.current = true;
    }
  }

  function handleCalendarTouchEnd(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== "touch") {
      return;
    }

    touchPointerActiveRef.current = false;
  }

  function handleMonthSwipeStart(event: React.TouchEvent<HTMLElement>) {
    const target = event.target as HTMLElement | null;
    const startedOnCalendarDay = Boolean(target?.closest('[data-calendar-day="true"]'));
    monthSwipeFromInteractiveRef.current = Boolean(target?.closest("button, input, select, textarea, a")) && !startedOnCalendarDay;

    if (monthSwipeFromInteractiveRef.current) {
      monthSwipeTrackingRef.current = false;
      monthSwipeDirectionRef.current = null;
      return;
    }

    const touch = event.touches[0];
    monthSwipeStartXRef.current = touch.clientX;
    monthSwipeStartYRef.current = touch.clientY;
    monthSwipeTrackingRef.current = true;
    monthSwipeDirectionRef.current = null;
  }

  function handleMonthSwipeMove(event: React.TouchEvent<HTMLElement>) {
    if (!monthSwipeTrackingRef.current || monthSwipeFromInteractiveRef.current) {
      return;
    }

    const touch = event.touches[0];
    const deltaX = touch.clientX - monthSwipeStartXRef.current;
    const deltaY = touch.clientY - monthSwipeStartYRef.current;

    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      monthSwipeTrackingRef.current = false;
      monthSwipeDirectionRef.current = null;
      return;
    }

    // Keep horizontal swipe responsive by preventing native scroll while tracking.
    event.preventDefault();

    if (Math.abs(deltaX) >= 42 && Math.abs(deltaX) >= Math.abs(deltaY) * 1.2) {
      monthSwipeDirectionRef.current = deltaX < 0 ? "left" : "right";
    }
  }

  function handleMonthSwipeEnd() {
    if (monthSwipeTrackingRef.current && !monthSwipeFromInteractiveRef.current) {
      if (monthSwipeDirectionRef.current === "left") {
        moveMonth("left");
      } else if (monthSwipeDirectionRef.current === "right") {
        moveMonth("right");
      }
    }

    monthSwipeTrackingRef.current = false;
    monthSwipeFromInteractiveRef.current = false;
    monthSwipeDirectionRef.current = null;
  }

  function handleCalendarPointerEnter(dayKey: string) {
    if (!isDraggingRef.current || !startDate) {
      return;
    }

    const clampedTarget = compareAsc(parseISO(dayKey), parseISO(startDate)) < 0 ? startDate : dayKey;
    const currentEnd = endDate || startDate;

    if (clampedTarget === currentEnd) {
      return;
    }

    const isExpanding = compareAsc(parseISO(clampedTarget), parseISO(currentEnd)) > 0;

    if (isExpanding && !canSelectRange(startDate, clampedTarget)) {
      setCalendarSelectionError("Some selected dates are unavailable. Choose open dates or allow overlap booking.");
      return;
    }

    dragMovedRef.current = true;
    setEndDate(clampedTarget);
    setSelectionStatus(isExpanding ? "Added days to selection." : "Removed days from selection.");
  }

  function clearSelection() {
    setStartDate("");
    setEndDate("");
    setNotes("");
    setSelectionStatus("");
    setFormMessage(null);
    setCalendarSelectionError("");
    setReservationMode("self");
    setSelectedUserId(actingUser.id);
    setAllowDoubleBooking(false);
    setShareScope("whole");
    setSharedWithUserIds([]);
    setSharedRangeStartDate("");
    setSharedRangeEndDate("");
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

    if (allowDoubleBooking && sharedWithUserIds.length === 0) {
      setFormMessage({ type: "error", text: "Choose at least one user to allow overlap for." });
      return;
    }

    if (allowDoubleBooking && shareScope === "range") {
      if (!sharedRangeStartDate || !sharedRangeEndDate) {
        setFormMessage({ type: "error", text: "Choose a sharable start and end date, or switch to whole reservation sharing." });
        return;
      }

      if (sharedRangeEndDate < sharedRangeStartDate) {
        setFormMessage({ type: "error", text: "Sharable end date must be on or after sharable start date." });
        return;
      }

      if (sharedRangeStartDate < s || sharedRangeEndDate > e) {
        setFormMessage({ type: "error", text: "Sharable range must stay inside your reservation dates." });
        return;
      }
    }

    setFormMessage(null);
    startTransition(async () => {
      const result = await createReservation({
        startDate: s,
        endDate: e,
        notes,
        bookedForUserId: bookingTargetId,
        allowDoubleBooking,
        sharedWithUserIds,
        sharedRangeStartDate: allowDoubleBooking && shareScope === "range" ? sharedRangeStartDate : undefined,
        sharedRangeEndDate: allowDoubleBooking && shareScope === "range" ? sharedRangeEndDate : undefined,
        approvalEnabled: approvalsEnabled
      });

      if (result.error) {
        setFormMessage({ type: "error", text: result.error });
      } else {
        setFormMessage({
          type: "success",
          text: [
            approvalsEnabled ? "Reservation submitted for approval." : "Reservation booked.",
            ...(result.maintenanceAlerts ?? [])
          ].join(" ")
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
        setFormMessage({ type: "success", text: "Reservation canceled." });
        setDeclineTargetId(null);
        setDeclineReasonText("");
      }
    });
  }

  function handleDeleteReservation(reservationId: string) {
    if (!canDeleteAnyReservation) {
      setFormMessage({ type: "error", text: "Only superadmin can delete reservations." });
      return;
    }

    const confirmed = window.confirm("Delete this reservation? This cannot be undone.");
    if (!confirmed) {
      return;
    }

    setFormMessage(null);
    startTransition(async () => {
      const result = await deleteReservation(reservationId);
      if (result.error) {
        setFormMessage({ type: "error", text: result.error });
      } else {
        setFormMessage({ type: "success", text: "Reservation deleted." });
      }
    });
  }

  return (
    <div className="grid max-w-full gap-6 overflow-x-hidden">
      <aside className="card card-strong p-5 sm:p-6">
        <h3 className="text-lg sm:text-xl">Reservation Settings</h3>
        <p className="mt-2 text-sm text-slate-600">
          Configure how this reservation should be created, then choose dates directly in the calendar area.
        </p>

        <div className="mt-4 grid gap-4 text-sm">
          {canBookForOthers ? (
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
                      setSharedWithUserIds([]);
                      return;
                    }

                    setReservationMode("self");
                    setSelectedUserId(actingUser.id);
                    setSharedWithUserIds([]);
                  }}
                  srLabel="Toggle reservation target"
                  offLabel="Me"
                  onLabel="Someone else"
                />
              </div>
            </div>
          ) : null}

          {reservationMode === "other" ? (
            <div className="ml-3 grid gap-2 border-l-2 border-slate-200 pl-3 sm:col-span-2 sm:ml-4 sm:pl-4">
              <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Booking target</span>
              <label className="grid gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 font-medium">
                <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Choose user</span>
                <select
                  value={selectedUserId}
                  onChange={(event) => {
                    const nextUserId = event.target.value;
                    setSelectedUserId(nextUserId);
                    setSharedWithUserIds((current) => current.filter((id) => id !== nextUserId));
                  }}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2"
                >
                  {otherUsers.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.fullName}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          ) : null}

          <div className="grid gap-1.5 sm:col-span-2">
            <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Double booking</span>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
              <div>
                <p className="text-sm font-medium text-slate-800">{allowDoubleBooking ? "Double booking allowed" : "Double booking off"}</p>
                <p className="text-sm text-slate-500">Turn this on only when specific users are intentionally sharing the same stay dates.</p>
              </div>
              <ToggleSwitch
                checked={allowDoubleBooking}
                onCheckedChange={(checked) => {
                  setAllowDoubleBooking(checked);
                  if (!checked) {
                    setIsOverlapUsersSubmenuOpen(true);
                    setShareScope("whole");
                    setSharedWithUserIds([]);
                    setSharedRangeStartDate("");
                    setSharedRangeEndDate("");
                  }
                }}
                srLabel="Allow double booking"
                offLabel="Off"
                onLabel="On"
              />
            </div>
          </div>

          {allowDoubleBooking ? (
            <div className="grid gap-2 sm:col-span-2">
              <div className="ml-3 grid gap-2 border-l-2 border-slate-200 pl-3 sm:ml-4 sm:pl-4">
                <div className="grid gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Allowed overlap users</span>
                    <button
                      type="button"
                      onClick={() => setIsOverlapUsersSubmenuOpen((current) => !current)}
                      className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                    >
                      {isOverlapUsersSubmenuOpen ? "Collapse" : "Expand"}
                    </button>
                  </div>
                  {isOverlapUsersSubmenuOpen ? (
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                      {shareableUsers.length === 0 ? (
                        <p className="text-sm text-slate-500">No other users available for shared overlap.</p>
                      ) : (
                        <div className="grid gap-2">
                          {shareableUsers.map((user) => (
                            <label key={user.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
                              <div>
                                <p className="text-sm font-medium text-slate-800">{user.fullName}</p>
                                <p className="text-xs text-slate-500">Allow this user to overlap with this reservation.</p>
                              </div>
                              <ToggleSwitch
                                checked={sharedWithUserIds.includes(user.id)}
                                onCheckedChange={(checked) => {
                                  setSharedWithUserIds((current) => {
                                    if (checked) {
                                      return current.includes(user.id) ? current : [...current, user.id];
                                    }

                                    return current.filter((entry) => entry !== user.id);
                                  });
                                }}
                                srLabel={`Allow overlap for ${user.fullName}`}
                                offLabel="No"
                                onLabel="Yes"
                              />
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-2">
                  <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Shareable scope</span>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2">
                    <div>
                      <p className="text-xs font-semibold text-slate-800 sm:text-sm">
                        {shareScope === "whole" ? "Whole reservation is sharable" : "Only selected date range is sharable"}
                      </p>
                      <p className="text-xs text-slate-500">Choose whether overlap works for all dates or a subset.</p>
                    </div>
                    <ToggleSwitch
                      checked={shareScope === "range"}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setShareScope("range");
                          setSharedRangeStartDate((current) => current || startDate);
                          setSharedRangeEndDate((current) => current || endDate);
                          return;
                        }

                        setShareScope("whole");
                        setSharedRangeStartDate("");
                        setSharedRangeEndDate("");
                      }}
                      srLabel="Toggle sharable scope"
                      offLabel="Whole"
                      onLabel="Range"
                    />
                  </div>

                  {shareScope === "range" ? (
                    <div className="ml-3 grid gap-2 border-l-2 border-slate-200 pl-3 sm:ml-4 sm:pl-4">
                      <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Sharable date range</span>
                      <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-2 sm:grid-cols-2">
                        <label className="grid gap-1 text-xs font-medium sm:text-sm">
                          <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Sharable start</span>
                          <input
                            type="date"
                            value={sharedRangeStartDate}
                            min={startDate || undefined}
                            max={endDate || undefined}
                            onChange={(event) => setSharedRangeStartDate(event.target.value)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2"
                          />
                        </label>
                        <label className="grid gap-1 text-xs font-medium sm:text-sm">
                          <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Sharable end</span>
                          <input
                            type="date"
                            value={sharedRangeEndDate}
                            min={startDate || undefined}
                            max={endDate || undefined}
                            onChange={(event) => setSharedRangeEndDate(event.target.value)}
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2"
                          />
                        </label>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}
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

        {selectionStatus ? <p className="mt-3 text-xs text-slate-700">{selectionStatus}</p> : null}

        {formMessage ? (
          <p className={`mt-3 rounded-lg px-3 py-2 text-xs ${formMessage.type === "error" ? "bg-rose-50 text-rose-700" : "bg-emerald-50 text-emerald-700"}`}>
            {formMessage.text}
          </p>
        ) : null}
      </aside>

      <section
        className={["card max-w-full overflow-x-hidden p-5 sm:p-6 touch-pan-y", hasActiveSelection ? "pb-24 sm:pb-6" : "pb-5 sm:pb-6"].join(" ")}
        onTouchStart={handleMonthSwipeStart}
        onTouchMove={handleMonthSwipeMove}
        onTouchEnd={handleMonthSwipeEnd}
        onTouchCancel={handleMonthSwipeEnd}
      >
        <h2 className="text-xl sm:text-2xl">Monthly Reservation Calendar</h2>
        <p className="mt-2 text-sm text-slate-600">Tap once to start, tap again to finish, then reserve from the action bar.</p>

        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <label className="grid gap-1.5 font-medium">
            <span className="text-xs uppercase tracking-[0.12em] text-slate-500">Start date</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                const nextStart = e.target.value;
                if (nextStart) {
                  setMonthCursor(startOfMonth(parseISO(nextStart)));
                }
                if (nextStart && endDate) {
                  applyRange(nextStart, endDate, "input");
                  return;
                }

                setStartDate(nextStart);
                setSelectionStatus(nextStart ? "Start date updated." : "Start date cleared.");
              }}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
          </label>
          <label className="grid gap-1.5 font-medium">
            <span className="text-xs uppercase tracking-[0.12em] text-slate-500">End date</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                const nextEnd = e.target.value;
                if (nextEnd) {
                  setMonthCursor(startOfMonth(parseISO(nextEnd)));
                }
                if (startDate && nextEnd) {
                  applyRange(startDate, nextEnd, "input");
                  return;
                }

                setEndDate(nextEnd);
                setSelectionStatus(nextEnd ? "End date updated." : "End date cleared.");
              }}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2"
            />
          </label>
        </div>

        <p className="mt-4 text-xl font-bold text-slate-900 sm:text-3xl">{format(monthCursor, "MMMM yyyy")}</p>

        {calendarSelectionError ? <p className="mt-2 text-sm text-rose-700">{calendarSelectionError}</p> : null}

        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            className="min-h-11 rounded-full border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            onClick={() => {
              setMonthCursor(startOfMonth(new Date()));
              setSelectionStatus("Showing current month.");
            }}
          >
            Today
          </button>
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50"
            onClick={() => moveMonth("right")}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 transition hover:bg-slate-50"
            onClick={() => moveMonth("left")}
            aria-label="Next month"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 overflow-x-hidden pb-1 sm:overflow-x-auto">
          <div className={[
            "min-w-0 sm:min-w-[34rem]",
            monthTransitionDirection === "left" ? "calendar-month-slide-left" : "",
            monthTransitionDirection === "right" ? "calendar-month-slide-right" : ""
          ].join(" ")}>
            <div className="grid grid-cols-7 gap-0.5 text-center text-[10px] font-semibold text-slate-500 sm:gap-1 sm:text-xs">
              {weekdayHeaders.map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>

            <div className="mt-2 grid grid-cols-7 gap-0.5 sm:gap-1">
              {calendarDays.map((day) => {
            const dayKey = format(day, "yyyy-MM-dd");
            const reservationsOnDay = reservations.filter((reservation) => dayKey >= reservation.startDate && dayKey <= reservation.endDate);
            const activeReservationsOnDay = reservationsOnDay.filter(
              (reservation) => reservation.status === "approved" || reservation.status === "pending"
            );
            const holidays = holidayMap[dayKey] ?? [];
            const isSelected = activeStart && activeEnd ? dayKey >= activeStart && dayKey <= activeEnd : false;
            const primaryReservation =
              activeReservationsOnDay.find((reservation) => reservation.status === "approved") ??
              activeReservationsOnDay.find((reservation) => reservation.status === "pending") ??
              activeReservationsOnDay[0];
            const hasSharedStay = activeReservationsOnDay.length > 1;
            const isBookedCell = Boolean(primaryReservation);
            const isOwnReservation = primaryReservation?.userId === actingUser.id;
            const isToday = dayKey === todayKey;
            const isWithinExistingShareRange = !primaryReservation?.sharedRangeStartDate || !primaryReservation?.sharedRangeEndDate
              ? true
              : dayKey >= primaryReservation.sharedRangeStartDate && dayKey <= primaryReservation.sharedRangeEndDate;
            const canOverlapThisReservation = Boolean(primaryReservation?.sharedWithUserIds?.includes(actingUser.id)) && isWithinExistingShareRange;
            const isDoubleBookableDay =
              Boolean(primaryReservation?.sharedWithUserIds?.length) &&
              isWithinExistingShareRange &&
              (Boolean(isOwnReservation) || canOverlapThisReservation);
            const sharedStayGuests = activeReservationsOnDay.slice(0, 2);
            const extraSharedStayCount = Math.max(activeReservationsOnDay.length - sharedStayGuests.length, 0);

            const bookedCellCls =
              isDoubleBookableDay
                ? isOwnReservation
                  ? "border-[#49a38f] bg-[linear-gradient(135deg,#62bea9_0%,#62bea9_49%,#ffffff_50%,#ffffff_100%)] text-slate-700 dark:border-emerald-300 dark:bg-[linear-gradient(135deg,#10b981_0%,#10b981_49%,#334155_50%,#334155_100%)] dark:text-slate-400"
                  : "border-[#c9d1d8] bg-[linear-gradient(135deg,rgba(190,190,190,1)_0%,rgba(190,190,190,1)_49%,#ffffff_50%,#ffffff_100%)] text-slate-700 dark:border-emerald-300 dark:bg-[linear-gradient(135deg,#10b981_0%,#10b981_49%,#334155_50%,#334155_100%)] dark:text-slate-400"
              : hasSharedStay
                ? "border-[#6bbfc7] bg-[linear-gradient(135deg,#e6fbf6_0%,#b8ecdf_38%,#9fd8eb_100%)] text-[#103b44] shadow-[inset_0_1px_0_rgba(255,255,255,0.7)] dark:border-[#4ca8b2] dark:bg-[linear-gradient(135deg,#0f3a42_0%,#146172_38%,#1f4d60_100%)] dark:text-slate-100 dark:shadow-none"
                : primaryReservation?.status === "declined"
                ? "bg-rose-300 text-rose-900 border-rose-400 dark:bg-rose-900/70 dark:text-rose-100 dark:border-rose-700"
                : canOverlapThisReservation
                  ? "border-[#49a38f] bg-[linear-gradient(135deg,#62bea9_0%,#62bea9_49%,#ffffff_50%,#ffffff_100%)] text-slate-900 dark:border-[#27566a] dark:bg-[linear-gradient(135deg,#1f4d60_0%,#1f4d60_49%,#0f172a_50%,#0f172a_100%)] dark:text-slate-100"
                : !isOwnReservation
                  ? "bg-[#eef1f4] text-slate-700 border-[#d5dce3] dark:bg-slate-600 dark:text-slate-100 dark:border-slate-500"
                  : primaryReservation?.status === "pending"
                  ? "bg-[#9fd9e2] text-[#184f5a] border-[#7fc1cc] dark:bg-cyan-800/75 dark:text-cyan-100 dark:border-cyan-700"
                  : "bg-[#62bea9] text-white border-[#49a38f] dark:bg-emerald-500 dark:text-slate-950 dark:border-emerald-300";

                return (
                  <button
                    key={dayKey}
                    type="button"
                    data-calendar-day="true"
                    onPointerDown={(event) => handleCalendarPointerDown(event, dayKey)}
                    onPointerMove={handleCalendarTouchMove}
                    onPointerUp={handleCalendarTouchEnd}
                    onPointerCancel={handleCalendarTouchEnd}
                    onPointerEnter={() => handleCalendarPointerEnter(dayKey)}
                    onClick={() => {
                      if (suppressNextTouchClickRef.current) {
                        suppressNextTouchClickRef.current = false;
                        return;
                      }

                      handleCalendarClick(dayKey);
                    }}
                    className={[
                      "min-h-16 rounded-md border p-1 text-left text-[10px] transition sm:min-h-28 sm:rounded-lg sm:p-2 sm:text-xs",
                      isSameMonth(day, monthCursor) ? "" : "opacity-65",
                      isBookedCell ? bookedCellCls : "border-slate-200 bg-white",
                      isSelected ? "ring-2 ring-amber-500 ring-offset-1" : ""
                    ].join(" ")}
                  >
                    <div
                      className={[
                        "inline-flex min-h-6 min-w-6 items-center justify-center rounded-full px-1 text-xs font-semibold",
                        isToday
                          ? "bg-sky-600 text-white dark:bg-sky-300 dark:text-slate-950"
                          : isBookedCell
                            ? "text-inherit"
                            : "text-slate-800"
                      ].join(" ")}
                    >
                      {format(day, "d")}
                    </div>

                    {primaryReservation ? (
                      <div className="mt-1.5 sm:mt-2">
                        {hasSharedStay ? (
                          <div className="space-y-1">
                            {sharedStayGuests.map((reservation) => (
                              <p
                                key={reservation.id}
                                className="truncate rounded-md bg-white/55 px-1.5 py-0.5 text-[10px] font-semibold leading-tight text-[#103b44] backdrop-blur-[1px]"
                              >
                                {reservation.userName}
                              </p>
                            ))}
                            {extraSharedStayCount > 0 ? (
                              <p className="text-[10px] font-medium text-[#245f68]">+{extraSharedStayCount} more</p>
                            ) : null}
                          </div>
                        ) : (
                          <p className={`truncate text-[10px] font-semibold leading-tight sm:text-[11px] ${isDoubleBookableDay ? "text-slate-900 dark:text-slate-100" : ""}`}>
                            {primaryReservation.userName}
                          </p>
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
                      <div className="mt-1.5 text-[10px] text-slate-400 sm:mt-2">Available</div>
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
          </div>
        </div>

        <div className="mt-4 hidden flex-wrap items-center justify-between gap-3 sm:flex">
          <p className="text-sm text-slate-600">
            {selectionHasConflict && allowDoubleBooking
              ? `Active range: ${activeStart || "-"} to ${activeEnd || "-"} · overlap allowed`
              : `Active range: ${activeStart || "-"} to ${activeEnd || "-"}`}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {activeStart && activeEnd ? (
              <button
                type="button"
                onClick={clearSelection}
                className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 py-2 text-slate-700"
              >
                Clear selection
              </button>
            ) : null}
            <button
              type="button"
              disabled={isPending}
              onClick={handleSave}
              className="min-h-11 rounded-lg bg-amber-700 px-4 py-2 text-white disabled:opacity-50"
            >
              {isPending ? "Reserving..." : approvalsEnabled ? "Reserve dates (submit for approval)" : "Reserve dates"}
            </button>
          </div>
        </div>

        {hasActiveSelection ? (
          <div className="fixed inset-x-3 bottom-3 z-40 rounded-xl border border-slate-200 bg-white/95 p-3 shadow-[0_16px_36px_rgba(62,116,121,0.2)] backdrop-blur sm:hidden">
            <p className="text-xs text-slate-600">
              {selectionHasConflict && allowDoubleBooking
                ? `Active range: ${activeStart || "-"} to ${activeEnd || "-"} · overlap allowed`
                : `Active range: ${activeStart || "-"} to ${activeEnd || "-"}`}
            </p>
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                onClick={clearSelection}
                className="min-h-11 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
              >
                Clear
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleSave}
                className="min-h-11 flex-[1.4] rounded-lg bg-amber-700 px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                {isPending ? "Reserving..." : "Reserve"}
              </button>
            </div>
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-[#8a4f4f]" /> US holiday
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1">
            <span className="h-2 w-2 rounded-full bg-[#4d678c]" /> Jewish holiday
          </span>
        </div>

        <div className="mt-6 grid gap-4">
          <h3 className="text-lg sm:text-xl">Reservations</h3>
          {approvalsEnabled ? <p className="text-sm text-slate-600">Approvals are active.</p> : null}

          <div className="grid gap-4">
            {reservations.map((reservation) => {
              const owner = users.find((u) => u.id === reservation.userId) ?? actingUser;
              const canModerate = canModerateReservation(actingUser, owner, reservation);
              const msg = reservation.status === "approved" ? "Booked" : reservation.status === "declined" ? "Canceled" : "Pending";

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
                        <span className="font-semibold">Reason for cancellation: </span>
                        {reservation.declineReason}
                      </div>
                    ) : null}

                    {reservation.status === "approved" && reservation.reviewedByName ? (
                      <p className="mt-2 text-xs text-emerald-700">Approved by {reservation.reviewedByName}</p>
                    ) : null}

                  {((canModerate && approvalsEnabled && reservation.status === "pending") || canDeleteAnyReservation) && declineTargetId !== reservation.id ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {canModerate && approvalsEnabled && reservation.status === "pending" ? (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleApprove(reservation.id)}
                          className="rounded-lg bg-amber-700 px-3 py-1.5 text-xs text-white disabled:opacity-50"
                        >
                          Approve
                        </button>
                      ) : null}
                      {canModerate && approvalsEnabled && reservation.status === "pending" ? (
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
                      ) : null}
                      {canDeleteAnyReservation ? (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleDeleteReservation(reservation.id)}
                          className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-1.5 text-xs text-rose-700 disabled:opacity-50"
                        >
                          Delete
                        </button>
                      ) : null}
                    </div>
                  ) : null}

                  {canModerate && approvalsEnabled && reservation.status === "pending" && declineTargetId === reservation.id ? (
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
      </section>

      <ActivityLog
        reservations={reservations}
        maintenanceRecords={maintenanceRecords}
        maintenanceNotifications={maintenanceNotifications}
        holidayMap={holidayMap}
        approvalsEnabled={approvalsEnabled}
      />
    </div>
  );
}

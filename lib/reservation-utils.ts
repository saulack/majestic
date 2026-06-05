import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Reservation } from "@/lib/types";

function overlapWithinShareRange(
  overlapStartDate: string,
  overlapEndDate: string,
  shareRangeStartDate?: string,
  shareRangeEndDate?: string
) {
  if (!shareRangeStartDate || !shareRangeEndDate) {
    return true;
  }

  return overlapStartDate >= shareRangeStartDate && overlapEndDate <= shareRangeEndDate;
}

function getOverlapBounds(startDate: string, endDate: string, reservation: Reservation) {
  return {
    overlapStartDate: startDate > reservation.startDate ? startDate : reservation.startDate,
    overlapEndDate: endDate < reservation.endDate ? endDate : reservation.endDate
  };
}

export function hasDateConflict(
  reservations: Reservation[],
  startDate: string,
  endDate: string,
  ignoreReservationId?: string,
  bookingUserId?: string,
  requestedSharedWithUserIds: string[] = [],
  requestedShareRangeStartDate?: string,
  requestedShareRangeEndDate?: string
): boolean {
  const start = parseISO(startDate);
  const end = parseISO(endDate);
  const requestedSet = new Set(requestedSharedWithUserIds);

  return reservations.some((reservation) => {
    if (ignoreReservationId && reservation.id === ignoreReservationId) {
      return false;
    }

    const bookedStart = parseISO(reservation.startDate);
    const bookedEnd = parseISO(reservation.endDate);

    const hasOverlap = start <= bookedEnd && end >= bookedStart;
    if (!hasOverlap) {
      return false;
    }

    if (bookingUserId) {
      const { overlapStartDate, overlapEndDate } = getOverlapBounds(startDate, endDate, reservation);
      const existingSet = new Set(reservation.sharedWithUserIds ?? []);

      const allowedByRequestedShare =
        requestedSet.has(reservation.userId) &&
        overlapWithinShareRange(overlapStartDate, overlapEndDate, requestedShareRangeStartDate, requestedShareRangeEndDate);

      const allowedByExistingShare =
        existingSet.has(bookingUserId) &&
        overlapWithinShareRange(overlapStartDate, overlapEndDate, reservation.sharedRangeStartDate, reservation.sharedRangeEndDate);

      if (allowedByRequestedShare || allowedByExistingShare) {
        return false;
      }
    }

    return true;
  });
}

export function totalDaysInReservation(reservation: Reservation): number {
  return differenceInCalendarDays(parseISO(reservation.endDate), parseISO(reservation.startDate)) + 1;
}

export function yearlyDaysByUser(reservations: Reservation[], year: number): Record<string, number> {
  const totals: Record<string, number> = {};

  for (const reservation of reservations) {
    const reservationYear = parseISO(reservation.startDate).getFullYear();
    if (reservationYear !== year) continue;

    totals[reservation.userName] = (totals[reservation.userName] ?? 0) + totalDaysInReservation(reservation);
  }

  return totals;
}

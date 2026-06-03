import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Reservation } from "@/lib/types";

export function hasDateConflict(
  reservations: Reservation[],
  startDate: string,
  endDate: string,
  ignoreReservationId?: string
): boolean {
  const start = parseISO(startDate);
  const end = parseISO(endDate);

  return reservations.some((reservation) => {
    if (ignoreReservationId && reservation.id === ignoreReservationId) {
      return false;
    }

    const bookedStart = parseISO(reservation.startDate);
    const bookedEnd = parseISO(reservation.endDate);

    return start <= bookedEnd && end >= bookedStart;
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

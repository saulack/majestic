import { eachDayOfInterval, format, parseISO } from "date-fns";
import type { HolidayMap } from "@/lib/holidays";
import type { Reservation } from "@/lib/types";

export type HolidayKind = "us" | "jewish";

export type HolidayLabel = {
  raw: string;
  name: string;
  kind: HolidayKind;
};

export function parseHolidayLabel(label: string): HolidayLabel {
  if (label.startsWith("Jewish: ")) {
    return { raw: label, name: label.slice(8), kind: "jewish" };
  }

  if (label.startsWith("US: ")) {
    return { raw: label, name: label.slice(4), kind: "us" };
  }

  return { raw: label, name: label, kind: "us" };
}

export function getHolidayLabelsInRange(reservation: Reservation, holidayMap: HolidayMap): HolidayLabel[] {
  const labels: HolidayLabel[] = [];
  const seen = new Set<string>();

  for (const day of eachDayOfInterval({ start: parseISO(reservation.startDate), end: parseISO(reservation.endDate) })) {
    const dayKey = format(day, "yyyy-MM-dd");
    const dayLabels = holidayMap[dayKey] ?? [];

    for (const label of dayLabels) {
      if (seen.has(label)) continue;
      seen.add(label);
      labels.push(parseHolidayLabel(label));
    }
  }

  return labels;
}

export function summarizeHolidayLabels(labels: HolidayLabel[]): string {
  const names = labels.map((label) => label.name);

  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;

  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

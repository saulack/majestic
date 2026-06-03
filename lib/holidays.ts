import { HebrewCalendar } from "@hebcal/core";
import Holidays from "date-holidays";

export type HolidayMap = Record<string, string[]>;

function toDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function buildHolidayMap(years: number[]): HolidayMap {
  const us = new Holidays("US");
  const holidayMap: HolidayMap = {};

  for (const year of years) {
    for (const holiday of us.getHolidays(year)) {
      const date = new Date(holiday.date);
      const key = toDateKey(date);
      holidayMap[key] = holidayMap[key] ?? [];
      if (!holidayMap[key].includes(`US: ${holiday.name}`)) {
        holidayMap[key].push(`US: ${holiday.name}`);
      }
    }

    const jewishEvents = HebrewCalendar.calendar({
      year,
      isHebrewYear: false,
      candlelighting: false,
      sedrot: false,
      noRoshChodesh: true,
      noMinorFast: false,
      noModern: false
    });

    for (const event of jewishEvents) {
      const eventName = event.render();
      if (eventName.startsWith("Parashat") || eventName.startsWith("Rosh Chodesh")) {
        continue;
      }

      const eventDate = event.getDate().greg();
      const key = toDateKey(eventDate);
      holidayMap[key] = holidayMap[key] ?? [];
      const label = `Jewish: ${eventName}`;
      if (!holidayMap[key].includes(label)) {
        holidayMap[key].push(label);
      }
    }
  }

  return holidayMap;
}

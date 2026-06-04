import { differenceInCalendarDays, parseISO, startOfDay } from "date-fns";
import type { MaintenanceNotification, MaintenanceRecord, MaintenanceSummary, MaintenanceType } from "@/lib/types";

export type MaintenanceContactInfo = {
  name: string;
  number?: string;
  email?: string;
  address?: string;
};

export function buildMaintenanceSummaries(
  maintenanceTypes: MaintenanceType[],
  maintenanceRecords: MaintenanceRecord[],
  referenceDate = new Date()
): MaintenanceSummary[] {
  const normalizedReferenceDate = startOfDay(referenceDate);

  return maintenanceTypes.map((maintenanceType) => {
    const lastRecord = maintenanceRecords
      .filter((record) => record.typeId === maintenanceType.id && parseISO(record.scheduledFor) <= normalizedReferenceDate)
      .sort((left, right) => (left.scheduledFor < right.scheduledFor ? 1 : -1))[0];

    const baselineDate = lastRecord ? parseISO(lastRecord.scheduledFor) : parseISO(maintenanceType.createdAt);
    const daysSinceLastMaintenance = Math.max(0, differenceInCalendarDays(normalizedReferenceDate, startOfDay(baselineDate)));
    const hasLoggedMaintenance = Boolean(lastRecord);

    return {
      typeId: maintenanceType.id,
      typeName: maintenanceType.name,
      thresholdDays: maintenanceType.thresholdDays,
      hasLoggedMaintenance,
      lastMaintenanceDate: lastRecord?.scheduledFor,
      daysSinceLastMaintenance,
      needsAttention: daysSinceLastMaintenance >= maintenanceType.thresholdDays
    };
  });
}

export function getDueMaintenanceTypes(
  maintenanceTypes: MaintenanceType[],
  maintenanceRecords: MaintenanceRecord[],
  reservationEndDate: string
): MaintenanceType[] {
  const reservationDate = parseISO(reservationEndDate);

  return maintenanceTypes.filter((maintenanceType) => {
    const lastRecord = maintenanceRecords
      .filter((record) => record.typeId === maintenanceType.id && parseISO(record.scheduledFor) <= reservationDate)
      .sort((left, right) => (left.scheduledFor < right.scheduledFor ? 1 : -1))[0];

    const baselineDate = lastRecord ? parseISO(lastRecord.scheduledFor) : parseISO(maintenanceType.createdAt);
    const daysSinceLastMaintenance = Math.max(0, differenceInCalendarDays(startOfDay(reservationDate), startOfDay(baselineDate)));
    return daysSinceLastMaintenance >= maintenanceType.thresholdDays;
  });
}

export function formatMaintenanceAlert(type: MaintenanceType, contacts: MaintenanceContactInfo[] = []): string {
  if (contacts.length === 0) {
    return `Maintenance reminder: please book ${type.name.toLowerCase()}.`;
  }

  const contactText = contacts
    .slice(0, 2)
    .map((contact) => {
      const details = [contact.number, contact.email, contact.address].filter(Boolean).join(" | ");
      return details ? `${contact.name} (${details})` : contact.name;
    })
    .join("; ");

  return `Maintenance reminder: please book ${type.name.toLowerCase()}. Contact: ${contactText}.`;
}

export function hasMatchingMaintenanceNotification(
  notifications: MaintenanceNotification[],
  maintenanceTypeId: string,
  reservationStartDate: string,
  reservationEndDate: string,
  notifiedUserId: string
): boolean {
  return notifications.some(
    (notification) =>
      notification.typeId === maintenanceTypeId &&
      notification.notifiedUserId === notifiedUserId &&
      notification.reservationStartDate === reservationStartDate &&
      notification.reservationEndDate === reservationEndDate
  );
}
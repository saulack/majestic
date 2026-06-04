import { differenceInCalendarDays, parseISO, startOfDay } from "date-fns";
import type { MaintenanceNotification, MaintenanceRecord, MaintenanceSummary, MaintenanceType } from "@/lib/types";

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

    const daysSinceLastMaintenance = lastRecord
      ? differenceInCalendarDays(normalizedReferenceDate, parseISO(lastRecord.scheduledFor))
      : null;

    return {
      typeId: maintenanceType.id,
      typeName: maintenanceType.name,
      thresholdDays: maintenanceType.thresholdDays,
      lastMaintenanceDate: lastRecord?.scheduledFor,
      daysSinceLastMaintenance,
      needsAttention: daysSinceLastMaintenance === null || daysSinceLastMaintenance >= maintenanceType.thresholdDays
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

    if (!lastRecord) {
      return true;
    }

    const daysSinceLastMaintenance = differenceInCalendarDays(reservationDate, parseISO(lastRecord.scheduledFor));
    return daysSinceLastMaintenance >= maintenanceType.thresholdDays;
  });
}

export function formatMaintenanceAlert(type: MaintenanceType): string {
  return `Maintenance reminder: please book ${type.name.toLowerCase()}.`;
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
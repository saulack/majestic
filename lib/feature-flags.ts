import { getBooleanAppSetting } from "@/lib/app-settings";

export const RESERVATION_APPROVALS_FLAG_KEY = "reservation_approvals_enabled";
export const HOMEPAGE_RESERVATIONS_COUNT_KEY = "homepage_reservations_count";

export async function getReservationApprovalsEnabled(): Promise<boolean> {
  return getBooleanAppSetting(RESERVATION_APPROVALS_FLAG_KEY, false);
}

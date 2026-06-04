export type ChannelPreference = "email" | "sms";

export type AppRole = "user" | "admin" | "superadmin";

export type ReservationStatus = "pending" | "approved" | "declined";

export type UserProfile = {
  id: string;
  fullName: string;
  email: string;
  role: AppRole;
  forcePasswordReset?: boolean;
};

export type Reservation = {
  id: string;
  userId: string;
  userName: string;
  createdByUserId?: string;
  createdByName?: string;
  startDate: string;
  endDate: string;
  status: ReservationStatus;
  reviewedByUserId?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  declineReason?: string;
  notes?: string;
  createdAt: string;
};

export type NotificationPreference = {
  userId: string;
  channels: ChannelPreference[];
};

export type MaintenanceType = {
  id: string;
  name: string;
  thresholdDays: number;
  createdByUserId?: string;
  createdAt: string;
};

export type MaintenanceRecord = {
  id: string;
  typeId: string;
  typeName: string;
  scheduledFor: string;
  createdByUserId: string;
  createdByName: string;
  createdAt: string;
};

export type MaintenanceNotification = {
  id: string;
  typeId: string;
  typeName: string;
  notifiedUserId: string;
  notifiedUserName: string;
  reservationId?: string;
  reservationStartDate: string;
  reservationEndDate: string;
  triggeredOn: string;
  createdAt: string;
};

export type MaintenanceSummary = {
  typeId: string;
  typeName: string;
  thresholdDays: number;
  lastMaintenanceDate?: string;
  daysSinceLastMaintenance: number | null;
  needsAttention: boolean;
};

export type AdminInvite = {
  token: string;
  email: string;
  role: Extract<AppRole, "admin">;
  createdByUserId: string;
  expiresAt: string;
};

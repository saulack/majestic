export type ChannelPreference = "email" | "sms";

export type AppRole = "user" | "admin" | "superadmin";

export type ReservationStatus = "pending" | "approved" | "declined";
export type FeatureRequestStatus = "pending" | "in_progress" | "declined" | "completed" | "rejected";
export type FeatureRequestType = "feature" | "bug";

export type InAppNotificationType = "feature_status" | "reservation_invite" | "request_boost";

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
  sharedWithUserIds?: string[];
  sharedRangeStartDate?: string;
  sharedRangeEndDate?: string;
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
  reservationConfirmationEmail: boolean;
  reservationBookedByOtherEmail: boolean;
  inAppInboxDigestEmail: boolean;
  inAppInboxDigestLastSentAt?: string;
};

export type FeatureRequest = {
  id: string;
  requestedByUserId: string;
  requestedByName: string;
  requestedByEmail: string;
  requestType: FeatureRequestType;
  title: string;
  description: string;
  status: FeatureRequestStatus;
  statusEmailOptIn: boolean;
  reviewedByUserId?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  createdAt: string;
  updatedAt: string;
  voteCount?: number;
  votedByCurrentUser?: boolean;
};

export type InAppNotification = {
  id: string;
  type: InAppNotificationType;
  title: string;
  body: string;
  createdAt: string;
  href?: string;
  isRead: boolean;
  readAt?: string;
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
  hasLoggedMaintenance: boolean;
  lastMaintenanceDate?: string;
  lastBookedByName?: string;
  nextMaintenanceDueDate: string;
  daysSinceLastMaintenance: number | null;
  needsAttention: boolean;
  snapshotState?: "counting" | "booked" | "in_progress_today";
  bookedForDate?: string;
};

export type MaintenanceThresholdApprovalStatus = "pending" | "approved" | "rejected";

export type MaintenanceThresholdApproval = {
  id: string;
  maintenanceTypeId: string;
  maintenanceTypeName: string;
  proposedThresholdDays: number;
  requestedByUserId: string;
  requestedByName: string;
  status: MaintenanceThresholdApprovalStatus;
  decidedByUserId?: string;
  decidedByName?: string;
  decidedAt?: string;
  createdAt: string;
};

export type AdminInvite = {
  token: string;
  email: string;
  role: Extract<AppRole, "admin">;
  createdByUserId: string;
  expiresAt: string;
};

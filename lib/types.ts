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

export type AdminInvite = {
  token: string;
  email: string;
  role: Extract<AppRole, "admin">;
  createdByUserId: string;
  expiresAt: string;
};

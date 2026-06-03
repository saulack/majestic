import { addDays, formatISO } from "date-fns";
import type { AdminInvite, NotificationPreference, Reservation, UserProfile } from "@/lib/types";

const today = new Date();

export const mockUsers: UserProfile[] = [
  { id: "user-1", fullName: "Alex Rivera", email: "alex@example.com", role: "superadmin" },
  { id: "user-2", fullName: "Jordan Lee", email: "jordan@example.com", role: "admin" },
  { id: "user-3", fullName: "Taylor Brooks", email: "taylor@example.com", role: "admin" },
  { id: "user-4", fullName: "Jamie Stone", email: "jamie@example.com", role: "user" }
];

export const mockReservations: Reservation[] = [
  {
    id: "res-1",
    userId: "user-1",
    userName: "Alex Rivera",
    startDate: formatISO(addDays(today, -22), { representation: "date" }),
    endDate: formatISO(addDays(today, -19), { representation: "date" }),
    status: "approved",
    reviewedByUserId: "user-2",
    reviewedByName: "Jordan Lee",
    reviewedAt: formatISO(addDays(today, -28)),
    notes: "Family stay",
    createdAt: formatISO(addDays(today, -30))
  },
  {
    id: "res-2",
    userId: "user-4",
    userName: "Jamie Stone",
    startDate: formatISO(addDays(today, 8), { representation: "date" }),
    endDate: formatISO(addDays(today, 12), { representation: "date" }),
    status: "pending",
    notes: "Remote work week",
    createdAt: formatISO(addDays(today, -4))
  },
  {
    id: "res-3",
    userId: "user-3",
    userName: "Taylor Brooks",
    startDate: formatISO(addDays(today, 20), { representation: "date" }),
    endDate: formatISO(addDays(today, 22), { representation: "date" }),
    status: "pending",
    notes: "Quick weekend",
    createdAt: formatISO(addDays(today, -2))
  },
  {
    id: "res-4",
    userId: "user-4",
    userName: "Jamie Stone",
    startDate: formatISO(addDays(today, -12), { representation: "date" }),
    endDate: formatISO(addDays(today, -10), { representation: "date" }),
    status: "declined",
    reviewedByUserId: "user-2",
    reviewedByName: "Jordan Lee",
    reviewedAt: formatISO(addDays(today, -11)),
    declineReason: "Maintenance scheduled during those dates.",
    notes: "Short getaway",
    createdAt: formatISO(addDays(today, -13))
  }
];

export const mockPreferences: NotificationPreference[] = [
  { userId: "user-1", channels: ["email", "sms"] },
  { userId: "user-2", channels: ["email"] },
  { userId: "user-3", channels: ["email", "whatsapp"] }
];

export const mockAdminInvites: AdminInvite[] = [
  {
    token: "invite_7830f7d89e",
    email: "new-admin@example.com",
    role: "admin",
    createdByUserId: "user-1",
    expiresAt: formatISO(addDays(today, 7))
  }
];

export const currentUser: UserProfile = mockUsers[0];

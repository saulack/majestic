import type { Reservation, UserProfile } from "@/lib/types";

export function isSuperadmin(user: UserProfile): boolean {
  return user.role === "superadmin";
}

export function isAdmin(user: UserProfile): boolean {
  return user.role === "admin";
}

export function isAdminLike(user: UserProfile): boolean {
  return user.role === "admin" || user.role === "superadmin";
}

export function canEditOwnReservation(user: UserProfile, reservation: Reservation): boolean {
  return reservation.userId === user.id;
}

export function canModerateReservation(
  actingUser: UserProfile,
  reservationOwner: UserProfile,
  reservation: Reservation
): boolean {
  if (actingUser.id === reservation.userId) {
    return false;
  }

  if (isSuperadmin(actingUser)) {
    return true;
  }

  if (!isAdmin(actingUser)) {
    return false;
  }

  // Admins can moderate regular users only, never other admins/superadmins.
  return reservationOwner.role === "user";
}

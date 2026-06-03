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
  _reservationOwner: UserProfile,
  reservation: Reservation
): boolean {
  // Admins and superadmins can moderate any reservation except their own.
  if (actingUser.id === reservation.userId) {
    return false;
  }
  return isAdminLike(actingUser);
}

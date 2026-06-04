import type { AppRole, UserProfile } from "@/lib/types";

export const ROLE_PREVIEW_COOKIE = "majestic-role-preview";

export function isPreviewRole(role: string | null | undefined): role is Extract<AppRole, "admin" | "user"> {
  return role === "admin" || role === "user";
}

export function getRolePreviewFromCookieValue(cookieValue: string | null | undefined): Extract<AppRole, "admin" | "user"> | null {
  return isPreviewRole(cookieValue) ? cookieValue : null;
}

export function getEffectiveRole(baseRole: AppRole, previewRole: Extract<AppRole, "admin" | "user"> | null): AppRole {
  if (baseRole !== "superadmin") {
    return baseRole;
  }

  return previewRole ?? baseRole;
}

export function getEffectiveUser(user: UserProfile, previewRole: Extract<AppRole, "admin" | "user"> | null): UserProfile {
  return {
    ...user,
    role: getEffectiveRole(user.role, previewRole)
  };
}

export function readRolePreviewFromBrowser(): Extract<AppRole, "admin" | "user"> | null {
  if (typeof document === "undefined") {
    return null;
  }

  const cookie = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${ROLE_PREVIEW_COOKIE}=`));

  if (!cookie) {
    return null;
  }

  return getRolePreviewFromCookieValue(cookie.split("=")[1] ?? null);
}

export function setRolePreviewInBrowser(role: Extract<AppRole, "admin" | "user">) {
  document.cookie = `${ROLE_PREVIEW_COOKIE}=${role}; path=/; max-age=${60 * 60 * 24 * 30}; samesite=lax`;
}

export function clearRolePreviewInBrowser() {
  document.cookie = `${ROLE_PREVIEW_COOKIE}=; path=/; max-age=0; samesite=lax`;
}

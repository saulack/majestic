"use client";

export const LOCAL_AUTH_USERNAME_KEY = "majestic-local-auth-username";
export const LOCAL_AUTH_PASSWORD_KEY = "majestic-local-auth-password";
export const LOCAL_AUTH_SESSION_KEY = "majestic-local-auth-session";
export const LOCAL_AUTH_PASSWORD_CHANGE_USED_KEY = "majestic-local-auth-password-change-used";

export function getLocalAuthDefaults() {
  return {
    username: "saulack",
    password: "saul"
  };
}

export function readLocalAuthSnapshot() {
  if (typeof window === "undefined") {
    return {
      username: getLocalAuthDefaults().username,
      password: getLocalAuthDefaults().password,
      sessionActive: false,
      passwordChangeUsed: false
    };
  }

  const defaults = getLocalAuthDefaults();
  return {
    username: window.localStorage.getItem(LOCAL_AUTH_USERNAME_KEY) ?? defaults.username,
    password: window.localStorage.getItem(LOCAL_AUTH_PASSWORD_KEY) ?? defaults.password,
    sessionActive: window.localStorage.getItem(LOCAL_AUTH_SESSION_KEY) === "true",
    passwordChangeUsed: window.localStorage.getItem(LOCAL_AUTH_PASSWORD_CHANGE_USED_KEY) === "true"
  };
}

export function activateLocalAuthSession(username: string) {
  window.localStorage.setItem(LOCAL_AUTH_USERNAME_KEY, username);
  window.localStorage.setItem(LOCAL_AUTH_SESSION_KEY, "true");
}

export function setLocalAuthPassword(password: string) {
  window.localStorage.setItem(LOCAL_AUTH_PASSWORD_KEY, password);
}

export function markLocalPasswordChangeUsed() {
  window.localStorage.setItem(LOCAL_AUTH_PASSWORD_CHANGE_USED_KEY, "true");
}

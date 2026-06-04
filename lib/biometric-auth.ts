"use client";

const BIOMETRIC_ENABLED_KEY = "majestic-biometric-enabled";
const BIOMETRIC_CREDENTIAL_ID_KEY = "majestic-biometric-credential-id";

type BiometricResult = {
  ok: boolean;
  error?: string;
};

function randomBytes(length: number) {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

function toBase64Url(bytes: Uint8Array) {
  const base64 = btoa(String.fromCharCode(...bytes));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function fromBase64Url(base64url: string) {
  const padded = base64url.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((base64url.length + 3) % 4);
  const decoded = atob(padded);
  return Uint8Array.from(decoded, (char) => char.charCodeAt(0));
}

export function supportsBiometricAuth() {
  return typeof window !== "undefined" && typeof PublicKeyCredential !== "undefined" && !!navigator.credentials;
}

export function isBiometricAuthEnabled() {
  if (typeof window === "undefined") {
    return false;
  }

  return window.localStorage.getItem(BIOMETRIC_ENABLED_KEY) === "true";
}

export function disableBiometricAuth() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
  window.localStorage.removeItem(BIOMETRIC_CREDENTIAL_ID_KEY);
}

export async function enrollBiometricAuth(username: string): Promise<BiometricResult> {
  if (!supportsBiometricAuth()) {
    return { ok: false, error: "Biometric authentication is not supported on this device/browser." };
  }

  try {
    const credential = await navigator.credentials.create({
      publicKey: {
        challenge: randomBytes(32),
        rp: {
          name: "Majestic Family Hub"
        },
        user: {
          id: randomBytes(16),
          name: username,
          displayName: username
        },
        pubKeyCredParams: [
          { type: "public-key", alg: -7 },
          { type: "public-key", alg: -257 }
        ],
        authenticatorSelection: {
          userVerification: "preferred"
        },
        timeout: 60000,
        attestation: "none"
      }
    });

    if (!credential || !(credential instanceof PublicKeyCredential)) {
      return { ok: false, error: "Biometric enrollment did not complete." };
    }

    const credentialId = toBase64Url(new Uint8Array(credential.rawId));
    window.localStorage.setItem(BIOMETRIC_CREDENTIAL_ID_KEY, credentialId);
    window.localStorage.setItem(BIOMETRIC_ENABLED_KEY, "true");

    return { ok: true };
  } catch {
    return { ok: false, error: "Biometric enrollment was canceled or failed." };
  }
}

export async function verifyBiometricAuthentication(): Promise<BiometricResult> {
  if (!isBiometricAuthEnabled()) {
    return { ok: true };
  }

  if (!supportsBiometricAuth()) {
    return { ok: false, error: "Biometric authentication is enabled but not supported in this browser." };
  }

  const credentialId = window.localStorage.getItem(BIOMETRIC_CREDENTIAL_ID_KEY);
  if (!credentialId) {
    return { ok: false, error: "No biometric credential found. Please re-enable biometric auth in account settings." };
  }

  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge: randomBytes(32),
        allowCredentials: [
          {
            id: fromBase64Url(credentialId),
            type: "public-key"
          }
        ],
        timeout: 60000,
        userVerification: "preferred"
      }
    });

    if (!assertion) {
      return { ok: false, error: "Biometric authentication failed." };
    }

    return { ok: true };
  } catch {
    return { ok: false, error: "Biometric authentication was canceled or failed." };
  }
}

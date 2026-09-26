// ============================================================================
// passwordService — reuses/extends the existing V11.x operational password
// mechanism. The password is NEVER stored or logged in plain text: only a
// SHA-256 hash (via the browser's built-in SubtleCrypto Web Crypto API,
// which requires no external library) is ever persisted or compared.
// Change Password and Reset Password both operate on this same store, so
// there is exactly one password system used everywhere (Settings, the
// Manual Schema Editor's delete confirmation, and the legacy Update Schema
// unlock all call this same service).
// ============================================================================

const HASH_STORAGE_KEY = 'apsql.pwhash.v131';
const DEFAULT_PASSWORD = 'apsql-admin';

async function sha256Hex(text: string): Promise<string> {
  const enc = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

let cachedDefaultHash: string | null = null;

async function getStoredHash(): Promise<string> {
  const stored = localStorage.getItem(HASH_STORAGE_KEY);
  if (stored) return stored;
  if (!cachedDefaultHash) cachedDefaultHash = await sha256Hex(DEFAULT_PASSWORD);
  return cachedDefaultHash;
}

export async function verifyPassword(candidate: string): Promise<boolean> {
  const [candidateHash, storedHash] = await Promise.all([sha256Hex(candidate), getStoredHash()]);
  return candidateHash === storedHash;
}

export async function changePassword(oldPassword: string, newPassword: string): Promise<{ ok: boolean; error?: string }> {
  if (!newPassword || newPassword.trim().length < 4) return { ok: false, error: 'New password must be at least 4 characters.' };
  const isValid = await verifyPassword(oldPassword);
  if (!isValid) return { ok: false, error: 'Current password is incorrect.' };
  const newHash = await sha256Hex(newPassword);
  localStorage.setItem(HASH_STORAGE_KEY, newHash);
  return { ok: true };
}

/** Demo-only administrative reset (in a production deployment this would
 * require identity verification / an out-of-band reset flow). Resets the
 * operational password back to the documented default. */
export function resetPasswordToDefault(): void {
  localStorage.removeItem(HASH_STORAGE_KEY);
}

export function isUsingDefaultPassword(): boolean {
  return localStorage.getItem(HASH_STORAGE_KEY) === null;
}

export const DEMO_DEFAULT_PASSWORD_HINT = DEFAULT_PASSWORD;

import 'server-only';

import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * Stateless authentication token embedded in Apple passes and validated by the
 * PassKit web-service endpoints. Derived as HMAC-SHA256(secret, serialNumber)
 * so no per-pass secret needs to be stored. Throws if the secret is unset.
 */
export function generatePassAuthToken(serialNumber: string): string {
  const secret = process.env.WALLET_PASS_AUTH_SECRET;
  if (!secret) {
    throw new Error('WALLET_NOT_CONFIGURED');
  }
  return createHmac('sha256', secret).update(serialNumber).digest('hex');
}

/**
 * Constant-time validation of an Apple `Authorization: ApplePass {token}` value
 * against the expected HMAC for the serial. Returns false on any mismatch or
 * length difference rather than throwing.
 */
export function verifyPassAuthToken(
  serialNumber: string,
  presentedToken: string,
): boolean {
  let expected: string;
  try {
    expected = generatePassAuthToken(serialNumber);
  } catch {
    return false;
  }
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(presentedToken, 'utf8');
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * Extracts the token from an `Authorization: ApplePass {token}` header value.
 */
export function parseApplePassAuthorization(
  header: string | null,
): string | null {
  if (!header) return null;
  const match = header.match(/^ApplePass\s+(.+)$/i);
  return match ? match[1]!.trim() : null;
}

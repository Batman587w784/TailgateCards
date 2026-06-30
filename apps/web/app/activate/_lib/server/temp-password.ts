import 'server-only';

import { randomBytes } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';

/**
 * Generates a temporary cardholder password emailed during activation.
 * Excludes visually ambiguous characters (0/O, 1/I/l) so it is easier to copy
 * by hand.
 */
export function generateTemporaryPassword(length = 12): string {
  const bytes = randomBytes(length);
  let out = '';
  for (let i = 0; i < length; i++) {
    out += ALPHABET[bytes[i]! % ALPHABET.length];
  }
  return out;
}

/**
 * Splits a single 'Full name' field into (firstName, lastName) for storage.
 * If the user only provides one token, lastName is null.
 */
export function splitCardholderName(fullName: string): {
  firstName: string;
  lastName: string | null;
} {
  const trimmed = fullName.trim().replace(/\s+/g, ' ');
  const idx = trimmed.indexOf(' ');
  if (idx === -1) {
    return { firstName: trimmed, lastName: null };
  }
  return {
    firstName: trimmed.slice(0, idx),
    lastName: trimmed.slice(idx + 1),
  };
}

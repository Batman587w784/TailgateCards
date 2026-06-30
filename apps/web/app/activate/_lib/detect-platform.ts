export type ClientPlatform = 'ios' | 'android' | 'desktop';

/**
 * Returns the platform inferred from a User-Agent string.
 * iPad-on-iPadOS-13+ reports as Mac and is intentionally treated as desktop —
 * the iPad screen handles the 2x1 button layout fine and the cardholder can
 * still tap the Apple button.
 */
export function detectPlatform(
  userAgent: string | null | undefined,
): ClientPlatform {
  if (!userAgent) return 'desktop';

  if (/iPhone|iPod/.test(userAgent)) return 'ios';
  if (/Android/.test(userAgent) && /Mobile/.test(userAgent)) return 'android';

  return 'desktop';
}

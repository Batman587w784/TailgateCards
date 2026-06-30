import 'server-only';

const ALLOWED_SCHEMES = ['https:'];

function isSafeImageUrl(raw: string): boolean {
  try {
    const url = new URL(raw);
    if (!ALLOWED_SCHEMES.includes(url.protocol)) return false;

    const host = url.hostname;
    if (
      /^localhost$/i.test(host) ||
      /^127\./.test(host) ||
      /^10\./.test(host) ||
      /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
      /^192\.168\./.test(host) ||
      /^169\.254\./.test(host) ||
      /^::1$/.test(host) ||
      /^fc00:/i.test(host)
    ) {
      return false;
    }

    return true;
  } catch {
    return false;
  }
}

export async function fetchTrustedImageBuffer(
  url: string,
  timeoutMs = 5_000,
): Promise<Buffer | null> {
  if (!isSafeImageUrl(url)) return null;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) return null;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return null;
  }
}

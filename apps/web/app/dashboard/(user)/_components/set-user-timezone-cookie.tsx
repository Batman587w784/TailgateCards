'use client';

import { useEffect } from 'react';

const COOKIE_NAME = 'user_tz';
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

export function SetUserTimezoneCookie() {
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!tz) return;

    const existing = document.cookie
      .split('; ')
      .find((row) => row.startsWith(`${COOKIE_NAME}=`));

    if (existing && decodeURIComponent(existing.split('=')[1] ?? '') === tz) {
      return;
    }

    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(tz)}; path=/; max-age=${ONE_YEAR_SECONDS}; samesite=lax`;
  }, []);

  return null;
}

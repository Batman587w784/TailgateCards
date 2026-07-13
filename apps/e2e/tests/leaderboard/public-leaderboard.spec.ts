import { expect, test } from '@playwright/test';

/**
 * M2 — public campus leaderboard (/l/[slug]).
 *
 * Smoke coverage for the anon-viewable, zero-PII board. Like the digital-cards
 * public-route tests, the seeded-data render + authenticated member board are
 * left to full-flow runs (they need a DB-seeded campus with a known share_slug
 * and a logged-in distributor); this file covers the routing/privacy contract
 * that needs no seed:
 *
 *   - an unknown campus slug must 404 (never expose data or error details);
 *   - the page is reachable logged-out (no auth redirect).
 */
test.describe('Public leaderboard — /l/[slug]', () => {
  test('unknown campus slug returns 404', async ({ page }) => {
    const response = await page.goto('/l/this-campus-does-not-exist-xyz');

    expect(response?.status()).toBe(404);
  });

  test('is public — no auth redirect to sign-in', async ({ page }) => {
    await page.goto('/l/this-campus-does-not-exist-xyz');

    // Even for a missing campus we should land on /l/... (404), never be bounced
    // to the auth flow the way /dashboard/* would be.
    expect(new URL(page.url()).pathname).not.toContain('/auth/sign-in');
  });
});

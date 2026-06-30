import { expect, test } from '@playwright/test';

import { AuthPageObject } from '../authentication/auth.po';

/**
 * Smoke tests for the M6 digital-card surfaces.
 *
 * Digital purchases now use the same inline Stripe Elements flow as physical
 * cards — no external redirect, no `/activate/finalize` step. Full-flow tests
 * that drive a real PaymentIntent require a Stripe sandbox + DB-seeded
 * distributor with a known share_slug.
 */
test.describe('Digital cards — public routes', () => {
  test('/activate/d/{unknown-slug} returns 404', async ({ page }) => {
    const response = await page.goto(
      '/activate/d/this-slug-does-not-exist-xyz',
    );

    expect(response?.status()).toBe(404);
  });

  test('/activate/{unknown-token} surfaces a not-found state', async ({
    page,
  }) => {
    // Token shape passes the regex but no row exists.
    await page.goto('/activate/abcdefghijklmnopqrstuvwxyz0123456789');

    await expect(
      page.getByText(/card not found|invalid card/i).first(),
    ).toBeVisible();
  });
});

test.describe('Validate — ?card_id= route', () => {
  /**
   * The cardholder dashboard QR (and any future wallet pass) encodes the card
   * UUID, not the human display code, so the merchant-side `/validate` route
   * must accept `?card_id=<uuid>` and route through the by-id loader without
   * the legacy "ORG-BATCH-NUMBER" parser.
   *
   * Positive-path coverage (assert holder name + `D-NNNNNN` rendering against
   * a seeded activated digital card) lives in the manual walk-through and
   * pgTAP layer. This test pins the routing contract: the by-id path renders
   * the validation surface for an authenticated merchant and surfaces the
   * not-found error for an unknown UUID.
   */
  test('/validate?card_id=<unknown-uuid> shows not-found for signed-in merchant', async ({
    page,
  }) => {
    const auth = new AuthPageObject(page);

    await auth.loginAsUser({ email: 'merchant-owner@tailgate.dev' });

    const unknownUuid = '00000000-0000-4000-8000-000000000999';
    await page.goto(`/validate?card_id=${unknownUuid}`);

    await expect(page.getByText(/card not found/i).first()).toBeVisible();
  });
});

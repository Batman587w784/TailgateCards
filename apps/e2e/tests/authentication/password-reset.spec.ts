import { expect, test } from '@playwright/test';

import { AuthPageObject } from './auth.po';

const newPassword = (Math.random() * 10000).toString();

test.describe('Password Reset Flow', () => {
  test('will reset the password and sign in with new one', async ({ page }) => {
    const auth = new AuthPageObject(page);

    let email = '';

    await expect(async () => {
      email = auth.createRandomEmail();

      auth.bootstrapUser({
        email,
        password: 'password',
        name: 'Test User',
      });

      await page.goto('/auth/password-reset');

      await page.fill('[name="email"]', email);
      await page.click('[type="submit"]');

      await auth.visitConfirmEmailLink(email, {
        deleteAfter: true,
        subject: 'Reset your password',
      });

      await page.waitForURL(new RegExp('/update-password?.*'));

      await auth.updatePassword(newPassword);

      await page.waitForURL('/home');
    }).toPass();

    await page.context().clearCookies();
    await page.reload();
    await page.goto('/auth/sign-in');

    await auth.loginAsUser({
      email,
      password: newPassword,
      next: '/home',
    });
  });
});

import {
  renderAccountDeleteEmail,
  renderCardActivationEmail,
  renderCardholderWelcomeEmail,
  renderInviteEmail,
  renderOtpEmail,
  renderPasswordResetEmail,
  renderWelcomeEmail,
} from '@kit/email-templates';

const SITE_URL = 'https://localhost:3000';
const PRODUCT_NAME = 'Tailgate';

export async function loadEmailTemplate(id: string) {
  switch (id) {
    case 'account-delete-email':
      return renderAccountDeleteEmail({
        productName: PRODUCT_NAME,
        siteUrl: SITE_URL,
      });

    case 'invite-email':
      return renderInviteEmail({
        teamName: 'Acme Team',
        teamLogo: '',
        inviter: 'John Doe',
        invitedUserEmail: 'test@tailgate.com',
        link: `${SITE_URL}/join?invite_token=abc123`,
        siteUrl: SITE_URL,
        productName: PRODUCT_NAME,
      });

    case 'otp-email':
      return renderOtpEmail({
        productName: PRODUCT_NAME,
        otp: '123456',
        siteUrl: SITE_URL,
      });

    case 'password-reset-email':
      return renderPasswordResetEmail({
        email: 'test@tailgate.com',
        otp: '789012',
        resetLink: `${SITE_URL}/auth/reset-password?token=abc123`,
        siteUrl: SITE_URL,
        productName: PRODUCT_NAME,
        expiresInMinutes: 60,
      });

    case 'card-activation-email':
      return renderCardActivationEmail({
        email: 'test@tailgate.com',
        cardCode: 'TIGER-DEMO-1',
        activationLink: `${SITE_URL}/activate/TIGER-DEMO-1`,
        siteUrl: SITE_URL,
        productName: PRODUCT_NAME,
      });

    case 'cardholder-welcome-email':
      return renderCardholderWelcomeEmail({
        email: 'test@tailgate.com',
        cardCode: 'TIGER-DEMO-1',
        siteUrl: SITE_URL,
        productName: PRODUCT_NAME,
      });

    case 'welcome-email':
      return renderWelcomeEmail({
        email: 'test@tailgate.com',
        siteUrl: SITE_URL,
        loginLink: `${SITE_URL}/auth/sign-in`,
        productName: PRODUCT_NAME,
      });

    case 'magic-link-email':
      return loadFromFileSystem('magic-link');

    case 'supabase-reset-password-email':
      return loadFromFileSystem('reset-password');

    case 'change-email-address-email':
      return loadFromFileSystem('change-email-address');

    case 'confirm-email':
      return loadFromFileSystem('confirm-email');

    default:
      throw new Error(`Email template not found: ${id}`);
  }
}

async function loadFromFileSystem(fileName: string) {
  const { readFileSync } = await import('node:fs');
  const { join } = await import('node:path');

  const filePath = join(
    process.cwd(),
    `../web/supabase/templates/${fileName}.html`,
  );

  return {
    html: readFileSync(filePath, 'utf8'),
  };
}

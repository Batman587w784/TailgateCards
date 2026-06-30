import 'server-only';

import { renderWelcomeEmail } from '@kit/email-templates';
import { getMailer } from '@kit/mailers';
import { getLogger } from '@kit/shared/logger';

interface SendWelcomeEmailParams {
  email: string;
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const emailSender = process.env.EMAIL_SENDER;
const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Tailgate';

export async function sendWelcomeEmail(params: SendWelcomeEmailParams) {
  const logger = await getLogger();
  const ctx = { name: 'welcome-email.service', email: params.email };

  if (!siteUrl || !emailSender) {
    logger.error(ctx, 'Missing required environment variables');
    throw new Error('Missing required environment variables');
  }

  logger.info(ctx, 'Rendering welcome email');

  const { html, subject } = await renderWelcomeEmail({
    email: params.email,
    siteUrl,
    loginLink: `${siteUrl}/auth/sign-in`,
    productName,
  });

  logger.info(ctx, 'Sending welcome email');

  const mailer = await getMailer();

  await mailer.sendEmail({
    from: emailSender,
    to: params.email,
    subject,
    html,
  });

  logger.info(ctx, 'Welcome email sent successfully');
}

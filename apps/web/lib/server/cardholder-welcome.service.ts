import 'server-only';

import { renderCardholderWelcomeEmail } from '@kit/email-templates';
import { getMailer } from '@kit/mailers';
import { getLogger } from '@kit/shared/logger';

interface SendCardholderWelcomeParams {
  email: string;
  cardCode: string;
  temporaryPassword?: string;
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const emailSender = process.env.EMAIL_SENDER;
const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Tailgate';

/**
 * Sends a welcome email to the cardholder after successful activation.
 * This email contains card details and a link to the site, but no password URL.
 */
export async function sendCardholderWelcomeEmail(
  params: SendCardholderWelcomeParams,
) {
  const logger = await getLogger();
  const ctx = { name: 'cardholder-welcome.service', email: params.email };

  if (!siteUrl || !emailSender) {
    logger.error(ctx, 'Missing required environment variables');
    throw new Error('Missing required environment variables');
  }

  logger.info(ctx, 'Rendering cardholder welcome email');

  const { html, subject } = await renderCardholderWelcomeEmail({
    email: params.email,
    cardCode: params.cardCode,
    siteUrl,
    productName,
    temporaryPassword: params.temporaryPassword,
  });

  logger.info(ctx, 'Sending cardholder welcome email');

  const mailer = await getMailer();

  await mailer.sendEmail({
    from: emailSender,
    to: params.email,
    subject,
    html,
  });

  logger.info(ctx, 'Cardholder welcome email sent successfully');
}

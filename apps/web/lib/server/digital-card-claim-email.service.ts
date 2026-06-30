import 'server-only';

import { renderCardActivationEmail } from '@kit/email-templates';
import { getMailer } from '@kit/mailers';
import { getLogger } from '@kit/shared/logger';

interface SendDigitalCardClaimEmailParams {
  email: string;
  cardCode: string;
  claimToken: string;
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const emailSender = process.env.EMAIL_SENDER;
const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Tailgate';

/**
 * Sent by the Stripe webhook after a successful digital-card purchase.
 * Reuses the card-activation template with /activate/{token}?payment=success.
 */
export async function sendDigitalCardClaimEmail(
  params: SendDigitalCardClaimEmailParams,
) {
  const logger = await getLogger();
  const ctx = { name: 'digital-card-claim-email', email: params.email };

  if (!siteUrl || !emailSender) {
    logger.error(ctx, 'Missing required environment variables');
    throw new Error('Missing required environment variables');
  }

  const activationLink = `${siteUrl}/activate/${params.claimToken}?payment=success`;

  const { html, subject } = await renderCardActivationEmail({
    email: params.email,
    cardCode: params.cardCode,
    activationLink,
    siteUrl,
    productName,
  });

  const mailer = await getMailer();

  await mailer.sendEmail({
    from: emailSender,
    to: params.email,
    subject,
    html,
  });

  logger.info(ctx, 'Digital card claim email sent');
}

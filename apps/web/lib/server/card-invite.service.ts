import 'server-only';

import { renderCardActivationEmail } from '@kit/email-templates';
import { getMailer } from '@kit/mailers';
import { getLogger } from '@kit/shared/logger';

interface SendCardActivationInviteParams {
  email: string;
  cardCode: string;
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const emailSender = process.env.EMAIL_SENDER;
const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Tailgate';

/**
 * Sends a card activation invite email to the cardholder.
 * The email contains a link to activate their card after payment.
 */
export async function sendCardActivationInvite(
  params: SendCardActivationInviteParams,
) {
  const logger = await getLogger();
  const ctx = { name: 'card-invite.service', email: params.email };

  if (!siteUrl || !emailSender) {
    logger.error(ctx, 'Missing required environment variables');
    throw new Error('Missing required environment variables');
  }

  // Build activation link
  const activationLink = `${siteUrl}/activate/${params.cardCode}`;

  logger.info(ctx, 'Rendering card activation email');

  // Render email
  const { html, subject } = await renderCardActivationEmail({
    email: params.email,
    cardCode: params.cardCode,
    activationLink,
    siteUrl,
    productName,
  });

  logger.info(ctx, 'Sending card activation email');

  // Send email
  const mailer = await getMailer();

  await mailer.sendEmail({
    from: emailSender,
    to: params.email,
    subject,
    html,
  });

  logger.info(ctx, 'Card activation email sent successfully');
}

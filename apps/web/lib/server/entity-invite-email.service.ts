import 'server-only';

import { renderEntityInviteEmail } from '@kit/email-templates';
import { getMailer } from '@kit/mailers';
import { getLogger } from '@kit/shared/logger';

interface SendEntityInviteEmailParams {
  email: string;
  entityType: 'organization' | 'merchant' | 'distributor';
  entityName: string;
  inviteLink: string;
}

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
const emailSender = process.env.EMAIL_SENDER;
const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Tailgate';

/**
 * Sends a styled, entity-specific invite email to the new user.
 */
export async function sendEntityInviteEmail(
  params: SendEntityInviteEmailParams,
) {
  const logger = await getLogger();

  const ctx = {
    name: 'entity-invite-email.service',
    email: params.email,
    entityType: params.entityType,
  };

  if (!siteUrl || !emailSender) {
    logger.error(ctx, 'Missing required environment variables');
    throw new Error('Missing required environment variables');
  }

  logger.info(ctx, 'Rendering entity invite email');

  const { html, subject } = await renderEntityInviteEmail({
    email: params.email,
    entityType: params.entityType,
    entityName: params.entityName,
    inviteLink: params.inviteLink,
    siteUrl,
    productName,
  });

  logger.info(ctx, 'Sending entity invite email');

  const mailer = await getMailer();

  await mailer.sendEmail({
    from: emailSender,
    to: params.email,
    subject,
    html,
  });

  logger.info(ctx, 'Entity invite email sent successfully');
}

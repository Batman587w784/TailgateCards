'use server';

import { z } from 'zod';

import { getMailer } from '@kit/mailers';
import { enhanceAction } from '@kit/next/actions';

import { ContactFormSchema } from '../contact-email.schema';

const ROLE_LABELS: Record<string, string> = {
  organization: 'Organization',
  merchant: 'Merchant',
  other: 'Other',
};

const contactEmail = z
  .string({
    description: `The email where you want to receive the contact form submissions.`,
    required_error:
      'Contact email is required. Please use the environment variable CONTACT_EMAIL.',
  })
  .parse(process.env.CONTACT_EMAIL);

const emailFrom = z
  .string({
    description: `The email sending address.`,
    required_error:
      'Sender email is required. Please use the environment variable EMAIL_SENDER.',
  })
  .parse(process.env.EMAIL_SENDER);

export const sendContactEmail = enhanceAction(
  async (data) => {
    const mailer = await getMailer();
    const roleLabel = ROLE_LABELS[data.role] ?? data.role;

    await mailer.sendEmail({
      to: contactEmail,
      from: emailFrom,
      subject: `Contact Form: ${roleLabel} - ${data.fullName}`,
      html: `
        <h2>New Contact Form Submission</h2>
        <table style="border-collapse: collapse; width: 100%; max-width: 600px;">
          <tr>
            <td style="padding: 8px; font-weight: bold; vertical-align: top;">Role:</td>
            <td style="padding: 8px;">${roleLabel}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; vertical-align: top;">Name:</td>
            <td style="padding: 8px;">${data.fullName}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; vertical-align: top;">Email:</td>
            <td style="padding: 8px;">${data.email}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; vertical-align: top;">Phone:</td>
            <td style="padding: 8px;">${data.phone || 'Not provided'}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; vertical-align: top;">Company:</td>
            <td style="padding: 8px;">${data.companyName || 'Not provided'}</td>
          </tr>
          <tr>
            <td style="padding: 8px; font-weight: bold; vertical-align: top;">Message:</td>
            <td style="padding: 8px;">${data.message || 'No message'}</td>
          </tr>
        </table>
      `,
    });

    return {};
  },
  {
    schema: ContactFormSchema,
    auth: false,
  },
);

#!/usr/bin/env node

/**
 * One-off script to resend an entity invite email.
 *
 * Usage:
 *   RESEND_API_KEY=re_xxx node scripts/resend-entity-invite.mjs
 *
 * Uses production Supabase credentials from apps/web/.env.prod
 */

const SUPABASE_URL = 'https://slevfchjaijqkpmiotkp.supabase.co';
const SUPABASE_SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNsZXZmY2hqYWlqcWtwbWlvdGtwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2Mzk3Nzc3MSwiZXhwIjoyMDc5NTUzNzcxfQ.S5TOC4jqLGKcHVSvjYlf3ZOQM1VVeTaVbq2POC_22vI';

const SITE_URL = 'https://tailgatecards.com';
const EMAIL_SENDER = 'Tailgate <app@tailgatecards.com>';
const PRODUCT_NAME = 'Tailgate';

// Target entity
const TARGET_EMAIL = 'wrightchoiceroofing208@gmail.com';
const ENTITY_NAME = 'Willow Creek Wildcats';
const ENTITY_TYPE = 'organization';
const REDIRECT_TO = `${SITE_URL}/update-password?callback=/dashboard`;

// Set this to override the recipient for testing (email goes to you, token stays for TARGET_EMAIL)
const SEND_TO_OVERRIDE = process.env.SEND_TO_OVERRIDE || null;

const RESEND_API_KEY = process.env.RESEND_API_KEY;

if (!RESEND_API_KEY) {
  console.error('Error: RESEND_API_KEY env var is required.');
  console.error('Usage: RESEND_API_KEY=re_xxx node scripts/resend-entity-invite.mjs');
  process.exit(1);
}

async function generateInviteLink() {
  console.log(`[1/3] Generating fresh invite link for ${TARGET_EMAIL}...`);

  const res = await fetch(`${SUPABASE_URL}/auth/v1/admin/generate_link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
      apikey: SUPABASE_SERVICE_ROLE_KEY,
    },
    body: JSON.stringify({
      type: 'recovery',
      email: TARGET_EMAIL,
      data: { display_name: ENTITY_NAME },
      redirect_to: REDIRECT_TO,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase generate_link failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  const actionLink = data.action_link;

  if (!actionLink) {
    throw new Error('No action_link in response: ' + JSON.stringify(data));
  }

  const token = new URL(actionLink).searchParams.get('token');
  if (!token) {
    throw new Error('No token in action_link: ' + actionLink);
  }

  const authConfirmUrl = new URL('/auth/confirm', SITE_URL);
  authConfirmUrl.searchParams.set('token_hash', token);
  authConfirmUrl.searchParams.set('type', 'recovery');
  authConfirmUrl.searchParams.set('next', REDIRECT_TO);

  const inviteLink = authConfirmUrl.toString();
  console.log(`   Invite link generated successfully.`);
  return inviteLink;
}

function buildEmailHtml(inviteLink) {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background-color:#f6f9fc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;padding:40px 0;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #eaeaea;">
    <!-- Header -->
    <div style="background-color:#1a1a2e;padding:24px 32px;text-align:center;">
      <span style="color:#ffffff;font-size:24px;font-weight:bold;">${PRODUCT_NAME}</span>
    </div>

    <!-- Content -->
    <div style="padding:32px;">
      <h1 style="font-size:24px;color:#242424;margin:0 0 16px;">Welcome, Organization Admin!</h1>

      <p style="font-size:16px;line-height:24px;color:#242424;">Hi there,</p>

      <p style="font-size:16px;line-height:24px;color:#242424;">
        You have been invited to manage <strong>${ENTITY_NAME}</strong>
        as an Organization Admin on ${PRODUCT_NAME}. Accept the invitation below to set up your password and access your dashboard.
      </p>

      <p style="font-size:14px;line-height:20px;color:#6b7280;">
        This invitation will expire in 7 days.
      </p>

      <div style="text-align:center;margin:32px 0;">
        <a href="${inviteLink}"
           style="display:inline-block;background-color:#1a1a2e;color:#ffffff;font-size:16px;font-weight:600;padding:12px 32px;border-radius:6px;text-decoration:none;">
          Accept Invitation
        </a>
      </div>

      <p style="font-size:16px;line-height:24px;color:#242424;">
        Or copy and paste this link into your browser:<br/>
        <a href="${inviteLink}" style="color:#2563eb;word-break:break-all;">${inviteLink}</a>
      </p>

      <hr style="border:none;border-top:1px solid #eaeaea;margin:26px 0;" />

      <p style="font-size:12px;line-height:24px;color:#666666;">
        This email was sent to ${TARGET_EMAIL}. If you did not expect this invitation, you can safely ignore this email.
      </p>
    </div>

    <!-- Footer -->
    <div style="background-color:#f9fafb;padding:16px 32px;text-align:center;border-top:1px solid #eaeaea;">
      <p style="font-size:12px;color:#9ca3af;margin:0;">
        You're receiving this because you were invited as an organization admin.
      </p>
    </div>
  </div>
</body>
</html>`;
}

async function sendEmail(inviteLink) {
  const recipient = SEND_TO_OVERRIDE || TARGET_EMAIL;
  console.log(`[2/3] Sending invite email to ${recipient}${SEND_TO_OVERRIDE ? ' (test override)' : ''}...`);

  const subject = `You're invited to manage ${ENTITY_NAME} on ${PRODUCT_NAME}`;
  const html = buildEmailHtml(inviteLink);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: EMAIL_SENDER,
      to: [recipient],
      subject,
      html,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Resend API failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  console.log(`   Email sent! Resend ID: ${data.id}`);
  return data;
}

async function main() {
  console.log(`\nResending ${ENTITY_TYPE} invite for "${ENTITY_NAME}"`);
  console.log(`Target: ${TARGET_EMAIL}\n`);

  const inviteLink = await generateInviteLink();
  await sendEmail(inviteLink);

  console.log(`\n[3/3] Done! Invite resent successfully.`);
}

main().catch((err) => {
  console.error('\nFailed:', err.message);
  process.exit(1);
});

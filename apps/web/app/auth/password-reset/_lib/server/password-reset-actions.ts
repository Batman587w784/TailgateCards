'use server';

import { z } from 'zod';

import { renderPasswordResetEmail } from '@kit/email-templates';
import { getMailer } from '@kit/mailers';
import { enhanceAction } from '@kit/next/actions';
import { createOtpApi } from '@kit/otp';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

const SITE_URL = z.string().url().parse(process.env.NEXT_PUBLIC_SITE_URL);
const EMAIL_SENDER = z.string().min(1).parse(process.env.EMAIL_SENDER);
const PRODUCT_NAME = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Tailgate';

const OTP_PURPOSE = 'password-reset';
const OTP_LINK_PURPOSE = 'password-reset-link';
const OTP_EXPIRY_SECONDS = 3600; // 1 hour

const RequestPasswordResetSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
});

const ResetPasswordWithOtpSchema = z.object({
  email: z.string().email(),
  otp: z.string().length(6, 'Please enter the 6-digit code'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

const ResetPasswordWithTokenSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(8, 'Password must be at least 8 characters'),
});

/**
 * Request a password reset.
 * Creates an OTP and sends email with OTP code + reset link.
 * Always returns success to prevent user enumeration.
 */
export const requestPasswordResetAction = enhanceAction(
  async (data) => {
    const logger = await getLogger();
    const ctx = { name: 'requestPasswordReset' };

    const { email } = data;
    const adminClient = getSupabaseServerAdminClient();

    logger.info({ ...ctx, email }, 'Password reset requested');

    try {
      // Look up user by email
      const { data: usersData } = await adminClient.auth.admin.listUsers();
      const user = usersData?.users?.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase(),
      );

      if (!user) {
        // Don't reveal that user doesn't exist
        logger.info({ ...ctx, email }, 'User not found, returning success');
        return { success: true };
      }

      const otpApi = createOtpApi(adminClient);

      // Create OTP for code entry
      const otpResult = await otpApi.createToken({
        userId: user.id,
        purpose: OTP_PURPOSE,
        expiresInSeconds: OTP_EXPIRY_SECONDS,
        metadata: { email },
      });

      // Create separate token for link-based reset
      const linkResult = await otpApi.createToken({
        userId: user.id,
        purpose: OTP_LINK_PURPOSE,
        expiresInSeconds: OTP_EXPIRY_SECONDS,
        metadata: { email },
        revokePrevious: false, // Don't revoke OTP token
      });

      // Build reset link
      const resetLink = `${SITE_URL}/auth/reset-password?token=${linkResult.token}&email=${encodeURIComponent(email)}`;

      // Render and send email
      const { html, subject } = await renderPasswordResetEmail({
        email,
        otp: otpResult.token,
        resetLink,
        siteUrl: SITE_URL,
        productName: PRODUCT_NAME,
        expiresInMinutes: Math.floor(OTP_EXPIRY_SECONDS / 60),
      });

      const mailer = await getMailer();

      await mailer.sendEmail({
        to: email,
        from: EMAIL_SENDER,
        subject,
        html,
      });

      logger.info(
        { ...ctx, email, userId: user.id },
        'Password reset email sent',
      );

      return { success: true };
    } catch (error) {
      logger.error(
        { ...ctx, email, error },
        'Failed to process password reset',
      );
      // Still return success to prevent user enumeration
      return { success: true };
    }
  },
  {
    schema: RequestPasswordResetSchema,
    auth: false,
  },
);

/**
 * Reset password using OTP code.
 * Verifies the OTP and updates the password.
 */
export const resetPasswordWithOtpAction = enhanceAction(
  async (data) => {
    const logger = await getLogger();
    const ctx = { name: 'resetPasswordWithOtp' };

    const { email, otp, newPassword } = data;
    const adminClient = getSupabaseServerAdminClient();

    logger.info({ ...ctx, email }, 'Password reset with OTP attempted');

    try {
      // Look up user by email
      const { data: usersData } = await adminClient.auth.admin.listUsers();
      const user = usersData?.users?.find(
        (u) => u.email?.toLowerCase() === email.toLowerCase(),
      );

      if (!user) {
        logger.warn({ ...ctx, email }, 'User not found for OTP reset');
        return {
          success: false,
          error: 'Invalid or expired verification code',
        };
      }

      const otpApi = createOtpApi(adminClient);

      // Verify OTP
      const verifyResult = await otpApi.verifyToken({
        token: otp,
        purpose: OTP_PURPOSE,
        userId: user.id,
      });

      if (!verifyResult.valid) {
        logger.warn(
          { ...ctx, email, message: verifyResult.message },
          'OTP verification failed',
        );
        return {
          success: false,
          error: verifyResult.message ?? 'Invalid or expired verification code',
        };
      }

      // Update password
      const { error: updateError } =
        await adminClient.auth.admin.updateUserById(user.id, {
          password: newPassword,
        });

      if (updateError) {
        logger.error(
          { ...ctx, email, error: updateError },
          'Failed to update password',
        );
        return { success: false, error: 'Failed to update password' };
      }

      logger.info(
        { ...ctx, email, userId: user.id },
        'Password reset successful',
      );

      return { success: true };
    } catch (error) {
      logger.error({ ...ctx, email, error }, 'Password reset with OTP failed');
      return { success: false, error: 'An unexpected error occurred' };
    }
  },
  {
    schema: ResetPasswordWithOtpSchema,
    auth: false,
  },
);

/**
 * Reset password using link token.
 * Verifies the token and updates the password.
 */
export const resetPasswordWithTokenAction = enhanceAction(
  async (data) => {
    const logger = await getLogger();
    const ctx = { name: 'resetPasswordWithToken' };

    const { token, newPassword } = data;
    const adminClient = getSupabaseServerAdminClient();

    logger.info(ctx, 'Password reset with token attempted');

    try {
      const otpApi = createOtpApi(adminClient);

      // Verify token (no userId needed for link-based reset)
      const verifyResult = await otpApi.verifyToken({
        token,
        purpose: OTP_LINK_PURPOSE,
      });

      if (!verifyResult.valid) {
        logger.warn(
          { ...ctx, message: verifyResult.message },
          'Token verification failed',
        );
        return {
          success: false,
          error: verifyResult.message ?? 'Invalid or expired reset link',
        };
      }

      const userId = verifyResult.user_id;

      if (!userId) {
        logger.error(ctx, 'No user_id in verified token');
        return { success: false, error: 'Invalid reset link' };
      }

      // Update password
      const { error: updateError } =
        await adminClient.auth.admin.updateUserById(userId, {
          password: newPassword,
        });

      if (updateError) {
        logger.error(
          { ...ctx, userId, error: updateError },
          'Failed to update password',
        );
        return { success: false, error: 'Failed to update password' };
      }

      logger.info({ ...ctx, userId }, 'Password reset via link successful');

      return { success: true };
    } catch (error) {
      logger.error({ ...ctx, error }, 'Password reset with token failed');
      return { success: false, error: 'An unexpected error occurred' };
    }
  },
  {
    schema: ResetPasswordWithTokenSchema,
    auth: false,
  },
);

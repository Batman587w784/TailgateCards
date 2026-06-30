'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createDeletePersonalAccountService } from '@kit/accounts/server';
import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  BasicInfoSchema,
  ChangePasswordSchema,
  DeleteAccountSchema,
  PhoneSchema,
} from '../schemas/account-settings.schema';

export const updateBasicInfoAction = enhanceAction(
  async (data, user) => {
    const logger = await getLogger();
    const client = getSupabaseServerClient();

    logger.info({ userId: user.id }, 'Updating cardholder basic info...');

    // Construct full name for accounts.name and user_metadata.display_name
    const fullName = `${data.firstName} ${data.lastName}`.trim();

    // Get the user's personal account
    const { data: account, error: accountError } = await client
      .from('accounts')
      .select('id')
      .eq('primary_owner_user_id', user.id)
      .eq('is_personal_account', true)
      .single();

    if (accountError) {
      logger.error(
        { userId: user.id, error: accountError },
        'Failed to find account',
      );
      throw accountError;
    }

    // Check if cardholder profile exists
    const { data: existingProfile } = await client
      .from('cardholder_profiles')
      .select('id')
      .eq('account_id', account.id)
      .single();

    if (existingProfile) {
      // Update existing profile
      const { error } = await client
        .from('cardholder_profiles')
        .update({
          first_name: data.firstName,
          last_name: data.lastName,
        })
        .eq('account_id', account.id);

      if (error) {
        logger.error({ userId: user.id, error }, 'Failed to update basic info');
        throw error;
      }
    } else {
      // Create new profile
      const { error } = await client.from('cardholder_profiles').insert({
        account_id: account.id,
        first_name: data.firstName,
        last_name: data.lastName,
      });

      if (error) {
        logger.error(
          { userId: user.id, error },
          'Failed to create cardholder profile',
        );
        throw error;
      }
    }

    // Update accounts.name for sidebar display
    const { error: accountUpdateError } = await client
      .from('accounts')
      .update({ name: fullName })
      .eq('id', account.id);

    if (accountUpdateError) {
      logger.error(
        { userId: user.id, error: accountUpdateError },
        'Failed to update account name',
      );
      throw accountUpdateError;
    }

    // Update user_metadata.display_name for dashboard welcome message
    const { error: userUpdateError } = await client.auth.updateUser({
      data: { display_name: fullName },
    });

    if (userUpdateError) {
      logger.error(
        { userId: user.id, error: userUpdateError },
        'Failed to update display name',
      );
      throw userUpdateError;
    }

    // Refresh the session to get updated JWT with new display_name
    const { error: refreshError } = await client.auth.refreshSession();

    if (refreshError) {
      logger.warn(
        { userId: user.id, error: refreshError },
        'Session refresh failed, user may need to refresh page',
      );
      // Don't throw - this is not critical, user can refresh page manually
    }

    // Sync primary_contact_name for merchants (if user is a merchant)
    const { data: merchantMembership } = await client
      .from('accounts_memberships')
      .select('account_id')
      .eq('user_id', user.id)
      .eq('account_role', 'merchant')
      .maybeSingle();

    if (merchantMembership?.account_id) {
      const { error: merchantProfileError } = await client
        .from('merchant_profiles')
        .update({ primary_contact_name: fullName })
        .eq('account_id', merchantMembership.account_id);

      if (merchantProfileError) {
        logger.warn(
          { userId: user.id, error: merchantProfileError },
          'Failed to update merchant primary_contact_name (non-critical)',
        );
        // Don't throw - this is supplementary data, cardholder profile is source of truth
      }
    }

    // Sync primary_contact_name for org admins (if user is an org admin)
    const { data: orgAdminMembership } = await client
      .from('accounts_memberships')
      .select('account_id')
      .eq('user_id', user.id)
      .eq('account_role', 'org_admin')
      .maybeSingle();

    if (orgAdminMembership?.account_id) {
      const { error: orgProfileError } = await client
        .from('organization_profiles')
        .update({ primary_contact_name: fullName })
        .eq('account_id', orgAdminMembership.account_id);

      if (orgProfileError) {
        logger.warn(
          { userId: user.id, error: orgProfileError },
          'Failed to update organization primary_contact_name (non-critical)',
        );
        // Don't throw - this is supplementary data, cardholder profile is source of truth
      }
    }

    logger.info({ userId: user.id }, 'Basic info updated successfully');

    // Revalidate entire dashboard layout to refresh name across all views
    revalidatePath('/dashboard', 'layout');

    return { success: true };
  },
  {
    schema: BasicInfoSchema,
  },
);

export const updatePhoneAction = enhanceAction(
  async (data, user) => {
    const logger = await getLogger();
    const client = getSupabaseServerClient();

    logger.info({ userId: user.id }, 'Updating cardholder phone...');

    // Get the user's personal account
    const { data: account, error: accountError } = await client
      .from('accounts')
      .select('id')
      .eq('primary_owner_user_id', user.id)
      .eq('is_personal_account', true)
      .single();

    if (accountError) {
      logger.error(
        { userId: user.id, error: accountError },
        'Failed to find account',
      );
      throw accountError;
    }

    // Check if cardholder profile exists
    const { data: existingProfile } = await client
      .from('cardholder_profiles')
      .select('id')
      .eq('account_id', account.id)
      .single();

    if (existingProfile) {
      // Update existing profile
      const { error } = await client
        .from('cardholder_profiles')
        .update({
          phone: data.phone ?? null,
        })
        .eq('account_id', account.id);

      if (error) {
        logger.error({ userId: user.id, error }, 'Failed to update phone');
        throw error;
      }
    } else {
      // Create new profile
      const { error } = await client.from('cardholder_profiles').insert({
        account_id: account.id,
        phone: data.phone ?? null,
      });

      if (error) {
        logger.error(
          { userId: user.id, error },
          'Failed to create cardholder profile',
        );
        throw error;
      }
    }

    logger.info({ userId: user.id }, 'Phone updated successfully');

    revalidatePath('/dashboard/account-settings');

    return { success: true };
  },
  {
    schema: PhoneSchema,
  },
);

export const changePasswordAction = enhanceAction(
  async (data, user) => {
    const logger = await getLogger();
    const client = getSupabaseServerClient();

    logger.info({ userId: user.id }, 'Changing password...');

    // Re-authenticate with current password
    const { error: authError } = await client.auth.signInWithPassword({
      email: user.email!,
      password: data.currentPassword,
    });

    if (authError) {
      logger.warn({ userId: user.id }, 'Current password verification failed');
      throw new Error('Current password is incorrect');
    }

    // Update to new password
    const { error: updateError } = await client.auth.updateUser({
      password: data.newPassword,
    });

    if (updateError) {
      logger.error(
        { userId: user.id, error: updateError },
        'Failed to update password',
      );
      throw updateError;
    }

    logger.info({ userId: user.id }, 'Password changed successfully');

    return { success: true };
  },
  {
    schema: ChangePasswordSchema,
  },
);

const enableAccountDeletion =
  process.env.NEXT_PUBLIC_ENABLE_PERSONAL_ACCOUNT_DELETION === 'true';

export const deleteCardholderAccountAction = enhanceAction(
  async (data, user) => {
    const logger = await getLogger();
    const client = getSupabaseServerClient();

    const ctx = {
      name: 'cardholder.account.delete',
      userId: user.id,
    };

    if (!enableAccountDeletion) {
      logger.warn(ctx, 'Account deletion is not enabled');
      throw new Error('Account deletion is not enabled');
    }

    logger.info(ctx, 'Deleting cardholder account...');

    const service = createDeletePersonalAccountService();

    await service.deletePersonalAccount({
      adminClient: getSupabaseServerAdminClient(),
      account: {
        id: user.id,
        email: user.email ?? null,
      },
    });

    await client.auth.signOut();

    logger.info(ctx, 'Cardholder account deleted successfully');

    revalidatePath('/', 'layout');

    redirect('/');
  },
  {
    schema: DeleteAccountSchema,
  },
);

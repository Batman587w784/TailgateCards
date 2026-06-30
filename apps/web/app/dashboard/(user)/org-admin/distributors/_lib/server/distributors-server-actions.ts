'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import appConfig from '~/config/app.config';
import pathsConfig from '~/config/paths.config';
import { sendEntityInviteEmail } from '~/lib/server/entity-invite-email.service';
import { generateEntityInviteLink } from '~/lib/server/generate-invite-link';

import {
  getUserOrganizationId,
  orgAdminAction,
} from '../../../../_lib/server/role-guards';
import {
  DeleteDistributorSchema,
  InviteDistributorSchema,
  ToggleDistributorStatusSchema,
} from '../schemas/distributor.schema';

export const inviteDistributorAction = orgAdminAction(
  enhanceAction(
    async (data) => {
      const logger = await getLogger();
      const adminClient = getSupabaseServerAdminClient();
      const orgId = await getUserOrganizationId();

      if (!orgId) {
        throw new Error('Organization not found');
      }

      const siteUrl = appConfig.url;
      const redirectTo = `${siteUrl}${pathsConfig.auth.passwordUpdate}?callback=${pathsConfig.app.home}`;

      // 1. Create auth user and generate invite link (no email sent yet)
      let user;
      let inviteLink;

      try {
        const result = await generateEntityInviteLink({
          adminClient,
          email: data.email,
          displayName: data.name,
          siteUrl,
          redirectTo,
        });

        user = result.user;
        inviteLink = result.inviteLink;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        if (
          message.includes('already been registered') ||
          message.includes('already exists')
        ) {
          throw new Error(
            'This email is already registered. Please use a different email.',
          );
        }
        throw error;
      }

      // 2. Poll for personal account creation with timeout
      const maxAttempts = 10;
      const delayMs = 200;
      let account: { id: string } | null = null;

      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        const { data: acc } = await adminClient
          .from('accounts')
          .select('id')
          .eq('primary_owner_user_id', user.id)
          .eq('is_personal_account', true)
          .single();

        if (acc) {
          account = acc;
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      if (!account) {
        await adminClient.auth.admin.deleteUser(user.id);
        throw new Error(
          'Personal account creation timed out. Please try again.',
        );
      }

      // 3. Update personal account with phone and organization link
      const { error: updateError } = await adminClient
        .from('accounts')
        .update({
          phone: data.phone ?? null,
          organization_id: orgId,
        })
        .eq('id', account.id);

      if (updateError) {
        await adminClient.auth.admin.deleteUser(user.id);
        throw updateError;
      }

      // 4. Add distributor as member of the organization
      const { error: membershipError } = await adminClient
        .from('accounts_memberships')
        .insert({
          user_id: user.id,
          account_id: orgId,
          account_role: 'distributor',
        });

      if (membershipError) {
        await adminClient.auth.admin.deleteUser(user.id);
        throw membershipError;
      }

      // 5. Send entity-specific styled invite email
      try {
        await sendEntityInviteEmail({
          email: data.email,
          entityType: 'distributor',
          entityName: data.name,
          inviteLink,
        });
      } catch {
        // Non-blocking: admin can resend invite later
        logger.error(
          { email: data.email },
          'Failed to send distributor invite email',
        );
      }

      logger.info(
        { email: data.email, distributorAccountId: account.id, orgId },
        'Org Admin successfully invited distributor',
      );

      revalidatePath('/dashboard/org-admin/distributors');

      return { success: true };
    },
    { schema: InviteDistributorSchema },
  ),
);

export const toggleDistributorStatusAction = orgAdminAction(
  enhanceAction(
    async (data) => {
      const client = getSupabaseServerClient();
      const orgId = await getUserOrganizationId();

      if (!orgId) {
        throw new Error('Organization not found');
      }

      // Verify distributor belongs to this org before updating
      const { data: distributor, error: verifyError } = await client
        .from('distributors_view')
        .select('id')
        .eq('id', data.distributorId)
        .eq('organization_id', orgId)
        .single();

      if (verifyError || !distributor) {
        throw new Error('Distributor not found in your organization');
      }

      const { error } = await client
        .from('accounts')
        .update({ is_active: data.isActive })
        .eq('id', data.distributorId);

      if (error) throw error;

      revalidatePath('/dashboard/org-admin/distributors');

      return { success: true };
    },
    { schema: ToggleDistributorStatusSchema },
  ),
);

export const deleteDistributorAction = orgAdminAction(
  enhanceAction(
    async (data) => {
      const client = getSupabaseServerClient();
      const orgId = await getUserOrganizationId();

      if (!orgId) {
        throw new Error('Organization not found');
      }

      // Get the distributor's user_id from their personal account
      const { data: distributor, error: fetchError } = await client
        .from('accounts')
        .select('primary_owner_user_id')
        .eq('id', data.distributorId)
        .eq('is_personal_account', true)
        .single();

      if (fetchError || !distributor) {
        throw new Error('Distributor not found');
      }

      // Delete the membership (removes distributor from org)
      const { error } = await client
        .from('accounts_memberships')
        .delete()
        .eq('user_id', distributor.primary_owner_user_id)
        .eq('account_id', orgId)
        .eq('account_role', 'distributor');

      if (error) throw error;

      // Unassign their cards
      const { error: unassignError } = await client
        .from('cards')
        .update({ distributor_id: null })
        .eq('distributor_id', data.distributorId)
        .eq('organization_id', orgId);

      if (unassignError) {
        throw new Error(
          'Distributor removed but failed to unassign cards: ' +
            unassignError.message,
        );
      }

      revalidatePath('/dashboard/org-admin/distributors');

      return { success: true };
    },
    { schema: DeleteDistributorSchema },
  ),
);

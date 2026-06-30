import 'server-only';

import { SupabaseClient } from '@supabase/supabase-js';

import { getLogger } from '@kit/shared/logger';

import appConfig from '~/config/app.config';
import pathsConfig from '~/config/paths.config';
import { Database } from '~/lib/database.types';
import { sendEntityInviteEmail } from '~/lib/server/entity-invite-email.service';
import { generateEntityInviteLink } from '~/lib/server/generate-invite-link';

import {
  CreateDistributorSchemaType,
  CreateMerchantSchemaType,
  CreateOrganizationSchemaType,
  ResendEntityInviteSchemaType,
  UpdateDistributorSchemaType,
  UpdateMerchantSchemaType,
  UpdateOrganizationSchemaType,
} from '../../schemas/entity.schema';
import { generatePasscode } from '../../utils/passcode';

export function createAdminEntitiesService(client: SupabaseClient<Database>) {
  return new AdminEntitiesService(client);
}

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .concat('-', Math.random().toString(36).substring(2, 8));
}

function translateOrganizationProfileError(
  error: { code?: string; message?: string } | null,
) {
  if (!error) return null;
  if (
    error.code === '23514' &&
    error.message?.includes('organization_profiles_share_lte_price')
  ) {
    return new Error(
      "Organization share per card can't exceed the card price. Lower the share or raise the price first.",
    );
  }
  return new Error(error.message ?? 'Organization profile update failed');
}

class AdminEntitiesService {
  constructor(private adminClient: SupabaseClient<Database>) {}

  async createOrganization(
    data: CreateOrganizationSchemaType,
    _adminUserId: string,
  ) {
    const siteUrl = appConfig.url;
    const redirectTo = `${siteUrl}${pathsConfig.auth.passwordUpdate}?callback=${pathsConfig.app.home}`;

    // 1. Create auth user and generate invite link (no email sent yet)
    const { user, inviteLink } = await generateEntityInviteLink({
      adminClient: this.adminClient,
      email: data.primaryContactEmail,
      displayName: data.primaryContactName ?? data.organizationName,
      siteUrl,
      redirectTo,
    });

    // 2. Poll for personal account creation with timeout
    const maxAttempts = 10;
    const delayMs = 200;
    let userAccount: { id: string } | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const { data: acc } = await this.adminClient
        .from('accounts')
        .select('id')
        .eq('primary_owner_user_id', user.id)
        .eq('is_personal_account', true)
        .single();

      if (acc) {
        userAccount = acc;
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    if (!userAccount) {
      await this.adminClient.auth.admin.deleteUser(user.id);
      throw new Error('User account creation timed out. Please try again.');
    }

    // 3. Create team account for the organization
    // Note: email is NOT set on team accounts - it's for personal accounts only
    // Primary contact email is stored in organization_profiles.primary_contact_email
    const { data: account, error: accountError } = await this.adminClient
      .from('accounts')
      .insert({
        name: data.organizationName,
        is_personal_account: false,
        slug: generateSlug(data.organizationName),
        primary_owner_user_id: user.id,
        card_prefix: data.cardPrefix,
      })
      .select()
      .single();

    if (accountError) {
      await this.adminClient.auth.admin.deleteUser(user.id);
      throw accountError;
    }

    // 4. Create organization profile
    const { error: profileError } = await this.adminClient
      .from('organization_profiles')
      .insert({
        account_id: account.id,
        organization_name: data.organizationName,
        share_per_card_cents: data.sharePerCardCents ?? 1250,
        primary_contact_name: data.primaryContactName ?? null,
        primary_contact_email: data.primaryContactEmail,
        contact_phone: data.primaryContactPhone ?? null,
        address: data.address ?? null,
        state: data.state ?? null,
        city: data.city ?? null,
      });

    if (profileError) {
      await this.adminClient.from('accounts').delete().eq('id', account.id);
      await this.adminClient.auth.admin.deleteUser(user.id);
      throw translateOrganizationProfileError(profileError);
    }

    // 5. Add user as admin of the organization
    const { error: membershipError } = await this.adminClient
      .from('accounts_memberships')
      .insert({
        user_id: user.id,
        account_id: account.id,
        account_role: 'org_admin',
      });

    if (membershipError) {
      await this.adminClient.from('accounts').delete().eq('id', account.id);
      await this.adminClient.auth.admin.deleteUser(user.id);
      throw membershipError;
    }

    // 6. Send entity-specific styled invite email
    try {
      await sendEntityInviteEmail({
        email: data.primaryContactEmail,
        entityType: 'organization',
        entityName: data.organizationName,
        inviteLink,
      });
    } catch (emailError) {
      // Non-blocking: admin can resend invite later
      const logger = await getLogger();
      logger.error(
        {
          email: data.primaryContactEmail,
          entityType: 'organization',
          emailError,
        },
        'Failed to send organization invite email',
      );
    }

    return account;
  }

  async createMerchant(data: CreateMerchantSchemaType, _adminUserId: string) {
    const siteUrl = appConfig.url;
    const redirectTo = `${siteUrl}${pathsConfig.auth.passwordUpdate}?callback=${pathsConfig.app.home}`;

    // 1. Create auth user and generate invite link (no email sent yet)
    const { user, inviteLink } = await generateEntityInviteLink({
      adminClient: this.adminClient,
      email: data.primaryContactEmail,
      displayName: data.primaryContactName ?? data.merchantName,
      siteUrl,
      redirectTo,
    });

    // 2. Poll for personal account creation with timeout
    const maxAttempts = 10;
    const delayMs = 200;
    let userAccount: { id: string } | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const { data: acc } = await this.adminClient
        .from('accounts')
        .select('id')
        .eq('primary_owner_user_id', user.id)
        .eq('is_personal_account', true)
        .single();

      if (acc) {
        userAccount = acc;
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }

    if (!userAccount) {
      await this.adminClient.auth.admin.deleteUser(user.id);
      throw new Error('User account creation timed out. Please try again.');
    }

    // 3. Create team account for the merchant
    // Note: email is NOT set on team accounts - it's for personal accounts only
    // Primary contact email is stored in merchant_profiles.primary_contact_email
    const { data: account, error: accountError } = await this.adminClient
      .from('accounts')
      .insert({
        name: data.merchantName,
        is_personal_account: false,
        slug: generateSlug(data.merchantName),
        primary_owner_user_id: user.id,
      })
      .select()
      .single();

    if (accountError) {
      await this.adminClient.auth.admin.deleteUser(user.id);
      throw accountError;
    }

    // 4. Create merchant profile
    const { error: profileError } = await this.adminClient
      .from('merchant_profiles')
      .insert({
        account_id: account.id,
        business_name: data.merchantName,
        primary_contact_name: data.primaryContactName ?? null,
        primary_contact_email: data.primaryContactEmail,
        contact_phone: data.primaryContactPhone ?? null,
        address: data.address ?? null,
        state: data.state ?? null,
        city: data.city ?? null,
        website: data.website ?? null,
      });

    if (profileError) {
      await this.adminClient.from('accounts').delete().eq('id', account.id);
      await this.adminClient.auth.admin.deleteUser(user.id);
      throw profileError;
    }

    // 5. Add user as owner of the merchant
    const { error: membershipError } = await this.adminClient
      .from('accounts_memberships')
      .insert({
        user_id: user.id,
        account_id: account.id,
        account_role: 'merchant',
      });

    if (membershipError) {
      await this.adminClient.from('accounts').delete().eq('id', account.id);
      await this.adminClient.auth.admin.deleteUser(user.id);
      throw membershipError;
    }

    // 6. Auto-generate dashboard passcode (4-char alphanumeric)
    const passcode = generatePasscode();

    const { error: passcodeError } = await this.adminClient.rpc(
      'admin_set_merchant_passcode',
      {
        target_account_id: account.id,
        new_passcode: passcode,
      },
    );

    if (passcodeError) {
      console.error(
        'Failed to set merchant dashboard passcode:',
        passcodeError,
      );
      // Don't fail - merchant was created successfully, passcode can be set later
    }

    // 7. Auto-create discount for the merchant
    const { error: discountError } = await this.adminClient
      .from('discounts')
      .insert({
        merchant_id: account.id,
        title: data.discountName,
        valid_from: new Date().toISOString(),
        is_active: true,
      });

    if (discountError) {
      console.error('Failed to create merchant discount:', discountError);
      // Don't fail - merchant was created successfully, discount can be added later
    }

    // 8. Send entity-specific styled invite email
    try {
      await sendEntityInviteEmail({
        email: data.primaryContactEmail,
        entityType: 'merchant',
        entityName: data.merchantName,
        inviteLink,
      });
    } catch (emailError) {
      // Non-blocking: admin can resend invite later
      const logger = await getLogger();
      logger.error(
        { email: data.primaryContactEmail, entityType: 'merchant', emailError },
        'Failed to send merchant invite email',
      );
    }

    return account;
  }

  async createDistributor(data: CreateDistributorSchemaType) {
    const siteUrl = appConfig.url;
    const redirectTo = `${siteUrl}${pathsConfig.auth.passwordUpdate}?callback=${pathsConfig.app.home}`;

    // 1. Create auth user and generate invite link (no email sent yet)
    const { user, inviteLink } = await generateEntityInviteLink({
      adminClient: this.adminClient,
      email: data.email,
      displayName: data.name,
      siteUrl,
      redirectTo,
    });

    // 2. Poll for personal account creation with timeout
    const maxAttempts = 10;
    const delayMs = 200;
    let account: { id: string } | null = null;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const { data: acc } = await this.adminClient
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
      // Cleanup: delete the auth user if account creation failed
      await this.adminClient.auth.admin.deleteUser(user.id);
      throw new Error('Personal account creation timed out. Please try again.');
    }

    // 3. Update personal account with phone and organization link
    const { error: updateError } = await this.adminClient
      .from('accounts')
      .update({
        phone: data.phone ?? null,
        organization_id: data.organizationId,
      })
      .eq('id', account.id);

    if (updateError) {
      // Cleanup on failure
      await this.adminClient.auth.admin.deleteUser(user.id);
      throw updateError;
    }

    // 4. Add distributor as member of the organization
    const { error: membershipError } = await this.adminClient
      .from('accounts_memberships')
      .insert({
        user_id: user.id,
        account_id: data.organizationId,
        account_role: 'distributor',
      });

    if (membershipError) {
      // Cleanup on failure
      await this.adminClient.auth.admin.deleteUser(user.id);
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
    } catch (emailError) {
      // Non-blocking: admin can resend invite later
      const logger = await getLogger();
      logger.error(
        { email: data.email, entityType: 'distributor', emailError },
        'Failed to send distributor invite email',
      );
    }

    return account;
  }

  async resendEntityInvite(data: ResendEntityInviteSchemaType) {
    const logger = await getLogger();
    const siteUrl = appConfig.url;
    const redirectTo = `${siteUrl}${pathsConfig.auth.passwordUpdate}?callback=${pathsConfig.app.home}`;

    // 1. Get the entity's primary owner
    const { data: account, error: accountError } = await this.adminClient
      .from('accounts')
      .select('primary_owner_user_id')
      .eq('id', data.accountId)
      .single();

    if (accountError || !account?.primary_owner_user_id) {
      throw new Error('Entity account not found');
    }

    // 2. Get the auth user's email (source of truth for Supabase auth)
    const { data: authUser, error: authError } =
      await this.adminClient.auth.admin.getUserById(
        account.primary_owner_user_id,
      );

    if (authError || !authUser.user?.email) {
      throw new Error('Auth user not found for this entity');
    }

    const email = authUser.user.email;

    // 3. Get entity name for the email template
    const { entityName } = await this.getEntityName(data);

    // 4. Generate a fresh invite link for the existing user.
    // For users in invited state (no email_confirmed_at, no password),
    // generateLink with type: 'invite' regenerates the invite token.
    const { data: linkData, error: linkError } =
      await this.adminClient.auth.admin.generateLink({
        type: 'invite',
        email,
        options: {
          redirectTo,
        },
      });

    if (linkError || !linkData?.properties?.action_link) {
      logger.error(
        {
          error: linkError,
          entityType: data.entityType,
          accountId: data.accountId,
        },
        'Failed to regenerate invite link',
      );
      throw new Error(
        linkError?.message ?? 'Failed to generate new invite link',
      );
    }

    // 4. Extract token and build custom invite link
    const token = new URL(linkData.properties.action_link).searchParams.get(
      'token',
    );

    if (!token) {
      throw new Error('Token not found in regenerated invite link');
    }

    const authConfirmUrl = new URL('/auth/confirm', siteUrl);
    authConfirmUrl.searchParams.set('token_hash', token);
    authConfirmUrl.searchParams.set('type', 'invite');
    authConfirmUrl.searchParams.set('next', redirectTo);

    const inviteLink = authConfirmUrl.toString();

    // 5. Send the invite email
    await sendEntityInviteEmail({
      email,
      entityType: data.entityType,
      entityName,
      inviteLink,
    });

    logger.info(
      { email, entityType: data.entityType, accountId: data.accountId },
      'Successfully resent entity invite email',
    );
  }

  private async getEntityName(
    data: ResendEntityInviteSchemaType,
  ): Promise<{ entityName: string }> {
    switch (data.entityType) {
      case 'organization': {
        const { data: org, error } = await this.adminClient
          .from('organization_profiles')
          .select('organization_name')
          .eq('account_id', data.accountId)
          .single();

        if (error) throw new Error('Organization not found');

        return { entityName: org.organization_name ?? '' };
      }
      case 'merchant': {
        const { data: merchant, error } = await this.adminClient
          .from('merchant_profiles')
          .select('business_name')
          .eq('account_id', data.accountId)
          .single();

        if (error) throw new Error('Merchant not found');

        return { entityName: merchant.business_name ?? '' };
      }
      case 'distributor': {
        const { data: account, error } = await this.adminClient
          .from('accounts')
          .select('name')
          .eq('id', data.accountId)
          .single();

        if (error) throw new Error('Distributor not found');

        return { entityName: account.name ?? '' };
      }
    }
  }

  async deleteOrganization(accountId: string) {
    // Soft delete: deactivate organization and cancel its active cards
    const { error: orgError } = await this.adminClient
      .from('organization_profiles')
      .update({ is_active: false })
      .eq('account_id', accountId);

    if (orgError) throw orgError;

    // Cancel only active cards (not already cancelled/expired)
    const { error: cardsError } = await this.adminClient
      .from('cards')
      .update({ status: 'cancelled' })
      .eq('organization_id', accountId)
      .in('status', ['pending', 'paid', 'activated']);

    if (cardsError) throw cardsError;
  }

  async deleteMerchant(accountId: string) {
    // Delete cascades to merchant_profiles
    const { error } = await this.adminClient
      .from('accounts')
      .delete()
      .eq('id', accountId);

    if (error) throw error;
  }

  async deleteDistributor(accountId: string) {
    // Get the user ID first
    const { data: account, error: fetchError } = await this.adminClient
      .from('accounts')
      .select('primary_owner_user_id')
      .eq('id', accountId)
      .single();

    if (fetchError) throw fetchError;

    if (account?.primary_owner_user_id) {
      // Delete the auth user (cascades to account)
      const { error } = await this.adminClient.auth.admin.deleteUser(
        account.primary_owner_user_id,
      );

      if (error) throw error;
    }
  }

  async deleteCardholder(cardId: string) {
    // First, verify the card exists and has a cardholder
    const { data: card, error: fetchError } = await this.adminClient
      .from('cards')
      .select('id, cardholder_id, status')
      .eq('id', cardId)
      .single();

    if (fetchError) throw fetchError;

    if (!card) {
      throw new Error('Card not found');
    }

    if (!card.cardholder_id) {
      throw new Error('Card has no cardholder to remove');
    }

    if (card.status === 'cancelled') {
      throw new Error('Cannot remove cardholder from cancelled card');
    }

    // Remove cardholder association and cancel the card
    const { error } = await this.adminClient
      .from('cards')
      .update({
        cardholder_id: null,
        status: 'cancelled',
      })
      .eq('id', cardId);

    if (error) throw error;
  }

  // Status toggle methods
  async updateOrganizationStatus(accountId: string, isActive: boolean) {
    const { error } = await this.adminClient
      .from('organization_profiles')
      .update({ is_active: isActive })
      .eq('account_id', accountId);

    if (error) throw error;
  }

  async updateMerchantStatus(accountId: string, isActive: boolean) {
    const { error } = await this.adminClient
      .from('merchant_profiles')
      .update({ is_active: isActive })
      .eq('account_id', accountId);

    if (error) throw error;
  }

  async updateDistributorStatus(accountId: string, isActive: boolean) {
    const { error } = await this.adminClient
      .from('accounts')
      .update({ is_active: isActive })
      .eq('id', accountId);

    if (error) throw error;
  }

  async updateOrganizationCashPayments(accountId: string, enabled: boolean) {
    const { error } = await this.adminClient
      .from('organization_profiles')
      .update({ cash_payments_enabled: enabled })
      .eq('account_id', accountId);

    if (error) throw error;
  }

  // Full update methods
  async updateOrganization(data: UpdateOrganizationSchemaType) {
    const updateData: Record<string, unknown> = {};

    if (data.organizationName !== undefined) {
      updateData.organization_name = data.organizationName;
    }
    if (data.sharePerCardCents !== undefined) {
      updateData.share_per_card_cents = data.sharePerCardCents;
    }
    if (data.primaryContactName !== undefined) {
      updateData.primary_contact_name = data.primaryContactName;
    }
    if (data.primaryContactEmail !== undefined) {
      updateData.primary_contact_email = data.primaryContactEmail || null;
    }
    if (data.contactPhone !== undefined) {
      updateData.contact_phone = data.contactPhone;
    }
    if (data.address !== undefined) {
      updateData.address = data.address;
    }
    if (data.state !== undefined) {
      updateData.state = data.state;
    }
    if (data.city !== undefined) {
      updateData.city = data.city;
    }
    if (data.isActive !== undefined) {
      updateData.is_active = data.isActive;
    }
    if (data.cashPaymentsEnabled !== undefined) {
      updateData.cash_payments_enabled = data.cashPaymentsEnabled;
    }

    if (Object.keys(updateData).length === 0) return;

    const { error } = await this.adminClient
      .from('organization_profiles')
      .update(updateData)
      .eq('account_id', data.accountId);

    if (error) throw translateOrganizationProfileError(error);
  }

  async updateMerchant(data: UpdateMerchantSchemaType) {
    const updateData: Record<string, unknown> = {};

    if (data.businessName !== undefined) {
      updateData.business_name = data.businessName;
    }
    if (data.primaryContactName !== undefined) {
      updateData.primary_contact_name = data.primaryContactName;
    }
    if (data.primaryContactEmail !== undefined) {
      updateData.primary_contact_email = data.primaryContactEmail || null;
    }
    if (data.contactPhone !== undefined) {
      updateData.contact_phone = data.contactPhone;
    }
    if (data.address !== undefined) {
      updateData.address = data.address;
    }
    if (data.state !== undefined) {
      updateData.state = data.state;
    }
    if (data.city !== undefined) {
      updateData.city = data.city;
    }
    if (data.isActive !== undefined) {
      updateData.is_active = data.isActive;
    }

    if (Object.keys(updateData).length === 0) return;

    const { error } = await this.adminClient
      .from('merchant_profiles')
      .update(updateData)
      .eq('account_id', data.accountId);

    if (error) throw error;
  }

  async updateDistributor(data: UpdateDistributorSchemaType) {
    const updateData: Record<string, unknown> = {};

    if (data.phone !== undefined) {
      updateData.phone = data.phone;
    }
    if (data.isActive !== undefined) {
      updateData.is_active = data.isActive;
    }

    if (Object.keys(updateData).length === 0) return;

    const { error } = await this.adminClient
      .from('accounts')
      .update(updateData)
      .eq('id', data.accountId);

    if (error) throw error;
  }

  async createOrganizationMerchantPartnerships(
    organizationId: string,
    merchantIds: string[],
  ) {
    if (merchantIds.length === 0) return;

    const partnerships = merchantIds.map((merchantId) => ({
      organization_id: organizationId,
      merchant_id: merchantId,
    }));

    const { error } = await this.adminClient
      .from('organization_merchant_partnerships')
      .insert(partnerships);

    if (error) throw error;
  }

  async updateOrganizationMerchantPartnerships(
    organizationId: string,
    merchantIds: string[],
  ) {
    // Delete all existing partnerships for this organization
    const { error: deleteError } = await this.adminClient
      .from('organization_merchant_partnerships')
      .delete()
      .eq('organization_id', organizationId);

    if (deleteError) throw deleteError;

    // Insert new partnerships
    if (merchantIds.length > 0) {
      await this.createOrganizationMerchantPartnerships(
        organizationId,
        merchantIds,
      );
    }
  }
}

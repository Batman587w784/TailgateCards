'use server';

import { revalidatePath } from 'next/cache';
import { notFound } from 'next/navigation';

import { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import { isSuperAdmin } from '@kit/admin';
import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  CreateCardsSchema,
  CreateDistributorSchema,
  CreateMerchantSchema,
  CreateOrganizationSchema,
  DeleteCardholderSchema,
  DeleteEntitySchema,
  ResendEntityInviteSchema,
  SetCardPrefixSchema,
  ToggleCashPaymentsSchema,
  ToggleStatusSchema,
  UpdateDistributorSchema,
  UpdateMerchantSchema,
  UpdateOrganizationSchema,
} from '../schemas/entity.schema';
import { RefreshPasscodeSchema } from '../schemas/passcode.schema';
import { generatePasscode } from '../utils/passcode';
import { createAdminEntitiesService } from './services/admin-entities.service';

async function requireSuperAdminAndGetUserId(): Promise<string> {
  const client = getSupabaseServerClient();
  const isAdmin = await isSuperAdmin(client);

  if (!isAdmin) {
    notFound();
  }

  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    notFound();
  }

  return user.id;
}

function getService() {
  const adminClient = getSupabaseServerAdminClient();
  return createAdminEntitiesService(adminClient);
}

const SetOrgNonprofitAmountSchema = z.object({
  orgAccountId: z.string().uuid(),
  // Net cents to the nonprofit per card. Capped at $1,000/card as a sanity bound.
  cents: z.coerce.number().int().min(0).max(100_000),
});

/**
 * Sets an org's per-card nonprofit amount (ledger #21). SUPER-ADMIN ONLY
 * (ledger #24) — this rate determines what the nonprofit receives, so a district
 * must not change its own payout. Feeds org_net_cents_per_card / the net goal
 * bars for campus-flagged districts.
 */
export const setOrgNonprofitAmount = enhanceAction(
  async (data) => {
    await requireSuperAdminAndGetUserId();

    const adminClient = getSupabaseServerAdminClient();
    const { error } = await adminClient
      .from('organization_profiles')
      .update({ nonprofit_cents_per_card: data.cents })
      .eq('account_id', data.orgAccountId);

    if (error) {
      return { success: false as const, error: error.message };
    }

    revalidatePath('/dashboard/entities');
    return { success: true as const };
  },
  { schema: SetOrgNonprofitAmountSchema },
);

export const createOrganizationAction = enhanceAction(
  async (data) => {
    const adminUserId = await requireSuperAdminAndGetUserId();

    const service = getService();
    const logger = await getLogger();

    logger.info(
      { organizationName: data.organizationName },
      'Super Admin is creating organization...',
    );

    try {
      const account = await service.createOrganization(data, adminUserId);

      // Create merchant partnerships if any were selected
      if (data.merchantPartnerIds && data.merchantPartnerIds.length > 0) {
        await service.createOrganizationMerchantPartnerships(
          account.id,
          data.merchantPartnerIds,
        );
        logger.info(
          {
            accountId: account.id,
            partnerCount: data.merchantPartnerIds.length,
          },
          'Created merchant partnerships for organization',
        );
      }

      logger.info(
        { accountId: account.id },
        'Super Admin has successfully created organization',
      );

      revalidatePath('/dashboard/entities');

      return {
        success: true as const,
        data: account,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to create organization');

      const message =
        error instanceof Error
          ? error.message
          : 'Failed to create organization';

      return {
        success: false as const,
        error: message,
      };
    }
  },
  {
    schema: CreateOrganizationSchema,
  },
);

export const createMerchantAction = enhanceAction(
  async (data) => {
    const adminUserId = await requireSuperAdminAndGetUserId();

    const service = getService();
    const logger = await getLogger();

    logger.info(
      { merchantName: data.merchantName },
      'Super Admin is creating merchant...',
    );

    try {
      const account = await service.createMerchant(data, adminUserId);

      logger.info(
        { accountId: account.id },
        'Super Admin has successfully created merchant',
      );

      revalidatePath('/dashboard/entities');

      return {
        success: true as const,
        data: account,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to create merchant');

      const message =
        error instanceof Error ? error.message : 'Failed to create merchant';

      return {
        success: false as const,
        error: message,
      };
    }
  },
  {
    schema: CreateMerchantSchema,
  },
);

export const createDistributorAction = enhanceAction(
  async (data) => {
    await requireSuperAdminAndGetUserId();

    const service = getService();
    const logger = await getLogger();

    logger.info(
      { email: data.email },
      'Super Admin is creating distributor...',
    );

    try {
      const account = await service.createDistributor(data);

      logger.info(
        { accountId: account.id },
        'Super Admin has successfully created distributor',
      );

      revalidatePath('/dashboard/entities');

      return {
        success: true as const,
        data: account,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to create distributor');

      const message =
        error instanceof Error ? error.message : 'Failed to create distributor';

      return {
        success: false as const,
        error: message,
      };
    }
  },
  {
    schema: CreateDistributorSchema,
  },
);

export const deleteOrganizationAction = enhanceAction(
  async ({ accountId }) => {
    await requireSuperAdminAndGetUserId();

    const service = getService();
    const logger = await getLogger();

    logger.info({ accountId }, 'Super Admin is deactivating organization...');

    await service.deleteOrganization(accountId);

    logger.info(
      { accountId },
      'Super Admin has successfully deactivated organization and cancelled its cards',
    );

    revalidatePath('/dashboard/entities');

    return {
      success: true,
    };
  },
  {
    schema: DeleteEntitySchema,
  },
);

export const deleteMerchantAction = enhanceAction(
  async ({ accountId }) => {
    await requireSuperAdminAndGetUserId();

    const service = getService();
    const logger = await getLogger();

    logger.info({ accountId }, 'Super Admin is deleting merchant...');

    await service.deleteMerchant(accountId);

    logger.info({ accountId }, 'Super Admin has successfully deleted merchant');

    revalidatePath('/dashboard/entities');

    return {
      success: true,
    };
  },
  {
    schema: DeleteEntitySchema,
  },
);

export const deleteDistributorAction = enhanceAction(
  async ({ accountId }) => {
    await requireSuperAdminAndGetUserId();

    const service = getService();
    const logger = await getLogger();

    logger.info({ accountId }, 'Super Admin is deleting distributor...');

    await service.deleteDistributor(accountId);

    logger.info(
      { accountId },
      'Super Admin has successfully deleted distributor',
    );

    revalidatePath('/dashboard/entities');

    return {
      success: true,
    };
  },
  {
    schema: DeleteEntitySchema,
  },
);

export const deleteCardholderAction = enhanceAction(
  async ({ cardId }) => {
    await requireSuperAdminAndGetUserId();

    const service = getService();
    const logger = await getLogger();

    logger.info({ cardId }, 'Super Admin is removing cardholder...');

    try {
      await service.deleteCardholder(cardId);

      logger.info(
        { cardId },
        'Super Admin has successfully removed cardholder',
      );

      revalidatePath('/dashboard/entities');

      return {
        success: true as const,
      };
    } catch (error) {
      logger.error({ error }, 'Failed to remove cardholder');

      const message =
        error instanceof Error ? error.message : 'Failed to remove cardholder';

      return {
        success: false as const,
        error: message,
      };
    }
  },
  {
    schema: DeleteCardholderSchema,
  },
);

// Toggle organization status
export const toggleOrganizationStatusAction = enhanceAction(
  async ({ accountId, isActive }) => {
    await requireSuperAdminAndGetUserId();

    const service = getService();
    const logger = await getLogger();

    logger.info(
      { accountId, isActive },
      'Super Admin is toggling organization status...',
    );

    await service.updateOrganizationStatus(accountId, isActive);

    logger.info(
      { accountId, isActive },
      'Super Admin has successfully toggled organization status',
    );

    revalidatePath('/dashboard/entities');

    return { success: true };
  },
  {
    schema: ToggleStatusSchema,
  },
);

// Toggle merchant status
export const toggleMerchantStatusAction = enhanceAction(
  async ({ accountId, isActive }) => {
    await requireSuperAdminAndGetUserId();

    const service = getService();
    const logger = await getLogger();

    logger.info(
      { accountId, isActive },
      'Super Admin is toggling merchant status...',
    );

    await service.updateMerchantStatus(accountId, isActive);

    logger.info(
      { accountId, isActive },
      'Super Admin has successfully toggled merchant status',
    );

    revalidatePath('/dashboard/entities');

    return { success: true };
  },
  {
    schema: ToggleStatusSchema,
  },
);

// Refresh merchant passcode
export const refreshMerchantPasscodeAction = enhanceAction(
  async ({ accountId }) => {
    await requireSuperAdminAndGetUserId();

    const adminClient = getSupabaseServerAdminClient();
    const logger = await getLogger();
    const newPasscode = generatePasscode();

    logger.info(
      { accountId },
      'Super Admin is refreshing merchant passcode...',
    );

    const { error } = await adminClient.rpc('admin_set_merchant_passcode', {
      target_account_id: accountId,
      new_passcode: newPasscode,
    });

    if (error) {
      logger.error({ error }, 'Failed to refresh merchant passcode');
      throw error;
    }

    logger.info(
      { accountId },
      'Super Admin has successfully refreshed merchant passcode',
    );

    revalidatePath('/dashboard/entities');

    return { success: true, passcode: newPasscode };
  },
  {
    schema: RefreshPasscodeSchema,
  },
);

// Toggle distributor status
export const toggleDistributorStatusAction = enhanceAction(
  async ({ accountId, isActive }) => {
    await requireSuperAdminAndGetUserId();

    const service = getService();
    const logger = await getLogger();

    logger.info(
      { accountId, isActive },
      'Super Admin is toggling distributor status...',
    );

    await service.updateDistributorStatus(accountId, isActive);

    logger.info(
      { accountId, isActive },
      'Super Admin has successfully toggled distributor status',
    );

    revalidatePath('/dashboard/entities');

    return { success: true };
  },
  {
    schema: ToggleStatusSchema,
  },
);

// Toggle cash payments for organization
export const toggleCashPaymentsAction = enhanceAction(
  async ({ accountId, enabled }) => {
    await requireSuperAdminAndGetUserId();

    const service = getService();
    const logger = await getLogger();

    logger.info(
      { accountId, enabled },
      'Super Admin is toggling organization cash payments...',
    );

    await service.updateOrganizationCashPayments(accountId, enabled);

    logger.info(
      { accountId, enabled },
      'Super Admin has successfully toggled organization cash payments',
    );

    revalidatePath('/dashboard/entities');

    return { success: true };
  },
  {
    schema: ToggleCashPaymentsSchema,
  },
);

// Update organization details
export const updateOrganizationAction = enhanceAction(
  async (data) => {
    await requireSuperAdminAndGetUserId();

    const service = getService();
    const logger = await getLogger();

    logger.info(
      { accountId: data.accountId },
      'Super Admin is updating organization...',
    );

    try {
      await service.updateOrganization(data);

      if (data.merchantPartnerIds !== undefined) {
        await service.updateOrganizationMerchantPartnerships(
          data.accountId,
          data.merchantPartnerIds,
        );
        logger.info(
          {
            accountId: data.accountId,
            partnerCount: data.merchantPartnerIds.length,
          },
          'Updated merchant partnerships for organization',
        );
      }

      logger.info(
        { accountId: data.accountId },
        'Super Admin has successfully updated organization',
      );

      revalidatePath('/dashboard/entities');

      return { success: true as const };
    } catch (error) {
      logger.error(
        { accountId: data.accountId, error },
        'Failed to update organization',
      );
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to update organization';
      return { success: false as const, error: message };
    }
  },
  {
    schema: UpdateOrganizationSchema,
  },
);

// Update merchant details
export const updateMerchantAction = enhanceAction(
  async (data) => {
    await requireSuperAdminAndGetUserId();

    const service = getService();
    const logger = await getLogger();

    logger.info(
      { accountId: data.accountId },
      'Super Admin is updating merchant...',
    );

    await service.updateMerchant(data);

    logger.info(
      { accountId: data.accountId },
      'Super Admin has successfully updated merchant',
    );

    revalidatePath('/dashboard/entities');

    return { success: true };
  },
  {
    schema: UpdateMerchantSchema,
  },
);

// Update distributor details
export const updateDistributorAction = enhanceAction(
  async (data) => {
    await requireSuperAdminAndGetUserId();

    const service = getService();
    const logger = await getLogger();

    logger.info(
      { accountId: data.accountId },
      'Super Admin is updating distributor...',
    );

    await service.updateDistributor(data);

    logger.info(
      { accountId: data.accountId },
      'Super Admin has successfully updated distributor',
    );

    revalidatePath('/dashboard/entities');

    return { success: true };
  },
  {
    schema: UpdateDistributorSchema,
  },
);

// Set card prefix for organization
export const setCardPrefixAction = enhanceAction(
  async (data) => {
    await requireSuperAdminAndGetUserId();

    const adminClient = getSupabaseServerAdminClient();
    const logger = await getLogger();

    logger.info(
      { organizationId: data.organizationId, prefix: data.prefix },
      'Super Admin is setting organization card prefix...',
    );

    // Check if prefix is already in use
    const { data: existing } = await adminClient
      .from('accounts')
      .select('id')
      .eq('card_prefix', data.prefix)
      .neq('id', data.organizationId)
      .single();

    if (existing) {
      return { success: false, error: 'Card prefix is already in use' };
    }

    // Set the prefix
    const { error } = await adminClient
      .from('accounts')
      .update({ card_prefix: data.prefix })
      .eq('id', data.organizationId);

    if (error) {
      logger.error({ error }, 'Failed to set card prefix');
      throw error;
    }

    logger.info(
      { organizationId: data.organizationId, prefix: data.prefix },
      'Super Admin has successfully set organization card prefix',
    );

    revalidatePath('/dashboard/entities');

    return { success: true };
  },
  {
    schema: SetCardPrefixSchema,
  },
);

// Create cards for an organization with batch
export const createCardsAction = enhanceAction(
  async (data) => {
    await requireSuperAdminAndGetUserId();

    const adminClient = getSupabaseServerAdminClient();
    const logger = await getLogger();

    logger.info(
      {
        organizationId: data.organizationId,
        batchName: data.batchName,
        batchPrefix: data.batchPrefix,
        quantity: data.quantity,
      },
      'Super Admin is creating cards...',
    );

    // Get organization with prefix
    const { data: org, error: orgError } = await adminClient
      .from('accounts')
      .select('id, card_prefix')
      .eq('id', data.organizationId)
      .single();

    if (orgError || !org) {
      return { success: false, error: 'Organization not found' };
    }

    const orgPrefix = org.card_prefix;

    if (!orgPrefix) {
      return {
        success: false,
        error: 'Organization has no card prefix. Please set one first.',
      };
    }

    // Check if batch prefix is already used by a different batch in this org
    const { data: prefixConflict } = await (adminClient as SupabaseClient)
      .from('batches')
      .select('id, name')
      .eq('organization_id', data.organizationId)
      .eq('prefix', data.batchPrefix)
      .neq('name', data.batchName)
      .single();

    if (prefixConflict) {
      const conflictName = (prefixConflict as { name: string }).name;
      return {
        success: false,
        error: `Batch prefix "${data.batchPrefix}" is already used by batch "${conflictName}". Each batch must have a unique prefix.`,
      };
    }

    // Get or create batch with prefix
    let batchId: string;

    // Check if batch with this name exists for the organization
    const { data: existingBatch } = await (adminClient as SupabaseClient)
      .from('batches')
      .select('id, prefix')
      .eq('organization_id', data.organizationId)
      .eq('name', data.batchName)
      .single();

    if (existingBatch) {
      batchId = (existingBatch as { id: string; prefix: string | null }).id;
      const existingPrefix = (
        existingBatch as { id: string; prefix: string | null }
      ).prefix;

      // Update batch prefix if it changed
      if (existingPrefix !== data.batchPrefix) {
        await (adminClient as SupabaseClient)
          .from('batches')
          .update({ prefix: data.batchPrefix })
          .eq('id', batchId);
        logger.info(
          {
            batchId,
            oldPrefix: existingPrefix,
            newPrefix: data.batchPrefix,
          },
          'Updated batch prefix',
        );
      }

      logger.info(
        { batchId, batchName: data.batchName, prefix: data.batchPrefix },
        'Using existing batch',
      );
    } else {
      // Create new batch with prefix
      const { data: newBatch, error: batchError } = await (
        adminClient as SupabaseClient
      )
        .from('batches')
        .insert({
          name: data.batchName,
          prefix: data.batchPrefix,
          organization_id: data.organizationId,
        })
        .select('id')
        .single();

      if (batchError || !newBatch) {
        logger.error({ error: batchError }, 'Failed to create batch');
        if (batchError?.code === '23505') {
          return {
            success: false,
            error: `Batch prefix "${data.batchPrefix}" is already in use.`,
          };
        }
        return { success: false, error: 'Failed to create batch' };
      }

      batchId = (newBatch as { id: string }).id;
      logger.info(
        { batchId, batchName: data.batchName, prefix: data.batchPrefix },
        'Created new batch',
      );
    }

    // Get the current max card number for this batch
    // Card numbers are per-batch, not per-organization
    const { data: maxCard } = await (adminClient as SupabaseClient)
      .from('cards')
      .select('card_number')
      .eq('batch_id', batchId)
      .order('card_number', { ascending: false })
      .limit(1)
      .single();

    const startNumber = (maxCard?.card_number ?? 0) + 1;

    // Create cards in batch
    const cardsToInsert = Array.from({ length: data.quantity }, (_, i) => ({
      organization_id: data.organizationId,
      batch_id: batchId,
      card_number: startNumber + i,
      status: 'pending' as const,
    }));

    const { data: createdCards, error: insertError } = await (
      adminClient as SupabaseClient
    )
      .from('cards')
      .insert(cardsToInsert)
      .select('id, card_number');

    if (insertError) {
      logger.error({ error: insertError }, 'Failed to create cards');
      throw insertError;
    }

    // Full display code format: ORG-BATCH-NUMBER
    const displayPrefix = `${orgPrefix}-${data.batchPrefix}`;

    logger.info(
      {
        organizationId: data.organizationId,
        batchId,
        batchName: data.batchName,
        count: createdCards?.length,
        displayPrefix,
      },
      'Super Admin has successfully created cards',
    );

    revalidatePath('/dashboard/cards');

    return {
      success: true,
      data: {
        cards: createdCards ?? [],
        batchName: data.batchName,
        prefix: displayPrefix,
        startNumber,
        endNumber: startNumber + data.quantity - 1,
      },
    };
  },
  {
    schema: CreateCardsSchema,
  },
);

// Get organization merchant partners
export const getOrganizationMerchantPartnersAction = enhanceAction(
  async ({ organizationId }) => {
    await requireSuperAdminAndGetUserId();

    const adminClient = getSupabaseServerAdminClient();

    const { data, error } = await adminClient
      .from('organization_merchant_partnerships')
      .select('merchant_id')
      .eq('organization_id', organizationId);

    if (error) {
      throw error;
    }

    return {
      success: true,
      data: (data ?? []).map((p) => p.merchant_id),
    };
  },
  {
    schema: z.object({
      organizationId: z.string().uuid(),
    }),
  },
);

// Resend entity invite email
export const resendEntityInviteAction = enhanceAction(
  async (data) => {
    await requireSuperAdminAndGetUserId();

    const service = getService();
    const logger = await getLogger();

    logger.info(
      { accountId: data.accountId, entityType: data.entityType },
      'Super Admin is resending entity invite...',
    );

    try {
      await service.resendEntityInvite(data);

      logger.info(
        { accountId: data.accountId, entityType: data.entityType },
        'Super Admin has successfully resent entity invite',
      );

      return { success: true as const };
    } catch (error) {
      logger.error({ error }, 'Failed to resend entity invite');

      const message =
        error instanceof Error ? error.message : 'Failed to resend invite';

      return { success: false as const, error: message };
    }
  },
  {
    schema: ResendEntityInviteSchema,
  },
);

// Get organization details by name
export const getOrganizationByNameAction = enhanceAction(
  async ({ organizationName }) => {
    await requireSuperAdminAndGetUserId();

    const adminClient = getSupabaseServerAdminClient();

    const { data, error } = await adminClient
      .from('organization_profiles')
      .select(
        `
        id,
        account_id,
        organization_name,
        organization_type,
        contact_phone,
        address,
        state,
        city,
        cash_payments_enabled,
        share_per_card_cents,
        is_active,
        created_at,
        primary_contact_name,
        primary_contact_email,
        account:accounts!inner(id, name, email, slug, created_at)
      `,
      )
      .eq('organization_name', organizationName)
      .single();

    if (error) {
      throw error;
    }

    // Fetch total revenue
    const { data: revenueData } = await adminClient.rpc(
      'get_organization_total_revenue',
      { org_account_id: data.account_id },
    );

    return {
      success: true,
      data: {
        ...data,
        total_revenue: Number(revenueData ?? 0),
      },
    };
  },
  {
    schema: z.object({
      organizationName: z.string().min(1),
    }),
  },
);

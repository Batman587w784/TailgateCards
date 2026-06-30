'use server';

import { revalidatePath } from 'next/cache';
import { notFound } from 'next/navigation';

import { isSuperAdmin } from '@kit/admin';
import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  CreateDiscountSchema,
  DeleteDiscountSchema,
  ToggleDiscountStatusSchema,
  UpdateDiscountSchema,
} from '../schemas/discount.schema';

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

// Create discount
export const createDiscountAction = enhanceAction(
  async (data) => {
    await requireSuperAdminAndGetUserId();

    const adminClient = getSupabaseServerAdminClient();
    const logger = await getLogger();

    logger.info({ title: data.title }, 'Super Admin is creating discount...');

    // Check if merchant already has an active discount
    const { data: existingDiscount } = await adminClient
      .from('discounts')
      .select('id')
      .eq('merchant_id', data.merchantId)
      .eq('is_active', true)
      .single();

    if (existingDiscount) {
      throw new Error(
        'This merchant already has an active discount. A merchant can only have one discount at a time.',
      );
    }

    const { data: discount, error } = await adminClient
      .from('discounts')
      .insert({
        title: data.title,
        merchant_id: data.merchantId,
        valid_from: data.validFrom?.toISOString() ?? new Date().toISOString(),
        is_active: true,
      })
      .select()
      .single();

    if (error) {
      logger.error({ error }, 'Failed to create discount');
      // Handle unique constraint violation
      if (error.code === '23505') {
        throw new Error(
          'This merchant already has an active discount. Please deactivate the existing discount first.',
        );
      }
      throw new Error('Failed to create discount');
    }

    logger.info(
      { discountId: discount.id },
      'Super Admin has successfully created discount',
    );

    revalidatePath('/dashboard/discounts');

    return {
      success: true,
      data: discount,
    };
  },
  {
    schema: CreateDiscountSchema,
  },
);

// Delete discount
export const deleteDiscountAction = enhanceAction(
  async ({ discountId }) => {
    await requireSuperAdminAndGetUserId();

    const adminClient = getSupabaseServerAdminClient();
    const logger = await getLogger();

    logger.info({ discountId }, 'Super Admin is deleting discount...');

    const { error } = await adminClient
      .from('discounts')
      .delete()
      .eq('id', discountId);

    if (error) {
      logger.error({ error }, 'Failed to delete discount');
      throw new Error('Failed to delete discount');
    }

    logger.info(
      { discountId },
      'Super Admin has successfully deleted discount',
    );

    revalidatePath('/dashboard/discounts');

    return { success: true };
  },
  {
    schema: DeleteDiscountSchema,
  },
);

// Toggle discount status
export const toggleDiscountStatusAction = enhanceAction(
  async ({ discountId, isActive }) => {
    await requireSuperAdminAndGetUserId();

    const adminClient = getSupabaseServerAdminClient();
    const logger = await getLogger();

    logger.info(
      { discountId, isActive },
      'Super Admin is toggling discount status...',
    );

    // If activating, check for existing active discount for this merchant
    if (isActive) {
      const { data: targetDiscount, error: fetchError } = await adminClient
        .from('discounts')
        .select('merchant_id')
        .eq('id', discountId)
        .single();

      if (fetchError || !targetDiscount) {
        throw new Error('Discount not found');
      }

      const { data: existingActive } = await adminClient
        .from('discounts')
        .select('id, title')
        .eq('merchant_id', targetDiscount.merchant_id)
        .eq('is_active', true)
        .neq('id', discountId)
        .single();

      if (existingActive) {
        throw new Error(
          `Cannot activate: "${existingActive.title}" is already active for this merchant. Please deactivate it first.`,
        );
      }
    }

    const { error } = await adminClient
      .from('discounts')
      .update({ is_active: isActive })
      .eq('id', discountId);

    if (error) {
      logger.error({ error }, 'Failed to toggle discount status');
      if (error.code === '23505') {
        throw new Error(
          'Another discount is already active for this merchant.',
        );
      }
      throw new Error('Failed to update discount status');
    }

    logger.info(
      { discountId, isActive },
      'Super Admin has successfully toggled discount status',
    );

    revalidatePath('/dashboard/discounts');

    return { success: true };
  },
  {
    schema: ToggleDiscountStatusSchema,
  },
);

// Update discount
export const updateDiscountAction = enhanceAction(
  async (data) => {
    await requireSuperAdminAndGetUserId();

    const adminClient = getSupabaseServerAdminClient();
    const logger = await getLogger();

    logger.info(
      { discountId: data.discountId },
      'Super Admin is updating discount...',
    );

    const { error } = await adminClient
      .from('discounts')
      .update({
        title: data.title,
        valid_from: data.validFrom.toISOString(),
        valid_until: data.validUntil?.toISOString() ?? null,
      })
      .eq('id', data.discountId);

    if (error) {
      logger.error({ error }, 'Failed to update discount');
      throw new Error('Failed to update discount');
    }

    logger.info(
      { discountId: data.discountId },
      'Super Admin has successfully updated discount',
    );

    revalidatePath('/dashboard/discounts');

    return { success: true };
  },
  {
    schema: UpdateDiscountSchema,
  },
);

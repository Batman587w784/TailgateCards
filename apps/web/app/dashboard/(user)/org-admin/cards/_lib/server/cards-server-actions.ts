'use server';

import 'server-only';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  getUserOrganizationId,
  orgAdminAction,
} from '../../../../_lib/server/role-guards';
import {
  AssignCardDistributorSchema,
  BulkAssignCardsByCountSchema,
  BulkAssignCardsDistributorSchema,
} from '../schemas/card.schema';

export const assignCardDistributorAction = orgAdminAction(
  enhanceAction(
    async (data) => {
      const logger = await getLogger();
      const client = getSupabaseServerClient();
      const orgId = await getUserOrganizationId();

      if (!orgId) {
        throw new Error('Organization not found');
      }

      // RLS enforces organization access - update will fail if card doesn't belong to org
      const { error: updateError, count } = await client
        .from('cards')
        .update({
          distributor_id: data.distributorId,
          assigned_at: new Date().toISOString(),
        })
        .eq('id', data.cardId)
        .select('id');

      if (updateError) throw updateError;

      if (count === 0) {
        throw new Error('Card not found or you do not have permission');
      }

      logger.info(
        { cardId: data.cardId, distributorId: data.distributorId, orgId },
        'Card distributor assignment updated',
      );

      revalidatePath('/dashboard/org-admin/cards');

      return { success: true };
    },
    { schema: AssignCardDistributorSchema },
  ),
);

export const bulkAssignCardsDistributorAction = orgAdminAction(
  enhanceAction(
    async (data) => {
      const logger = await getLogger();
      const client = getSupabaseServerClient();
      const orgId = await getUserOrganizationId();

      if (!orgId) {
        throw new Error('Organization not found');
      }

      // RLS enforces organization access - update will only affect cards in user's org
      const { data: updatedCards, error: updateError } = await client
        .from('cards')
        .update({
          distributor_id: data.distributorId,
          assigned_at: new Date().toISOString(),
        })
        .in('id', data.cardIds)
        .select('id');

      if (updateError) throw updateError;

      const assignedCount = updatedCards?.length ?? 0;

      if (assignedCount === 0) {
        throw new Error('No cards were updated - check permissions');
      }

      if (assignedCount !== data.cardIds.length) {
        logger.warn(
          {
            requested: data.cardIds.length,
            updated: assignedCount,
            orgId,
          },
          'Some cards could not be updated - possible permission issue',
        );
      }

      logger.info(
        {
          cardCount: assignedCount,
          distributorId: data.distributorId,
          orgId,
        },
        'Bulk card distributor assignment updated',
      );

      revalidatePath('/dashboard/org-admin/cards');

      return {
        success: true,
        assignedCount,
      };
    },
    { schema: BulkAssignCardsDistributorSchema },
  ),
);

export const bulkAssignCardsByCountAction = orgAdminAction(
  enhanceAction(
    async (data) => {
      const logger = await getLogger();
      const client = getSupabaseServerClient();
      const orgId = await getUserOrganizationId();

      if (!orgId) {
        throw new Error('Organization not found');
      }

      // Fetch N unassigned cards from org, ordered by created_at for consistency
      const { data: cards, error: fetchError } = await client
        .from('cards')
        .select('id')
        .eq('organization_id', orgId)
        .is('distributor_id', null)
        .order('created_at', { ascending: true })
        .limit(data.count);

      if (fetchError) throw fetchError;

      if (!cards || cards.length === 0) {
        throw new Error('No unassigned cards available');
      }

      // Update with additional IS NULL check to reduce race condition window
      // This ensures only cards that are still unassigned get updated
      const { data: updatedCards, error: updateError } = await client
        .from('cards')
        .update({
          distributor_id: data.distributorId,
          assigned_at: new Date().toISOString(),
        })
        .in(
          'id',
          cards.map((c) => c.id),
        )
        .is('distributor_id', null)
        .select('id');

      if (updateError) throw updateError;

      const assignedCount = updatedCards?.length ?? 0;

      if (assignedCount === 0) {
        throw new Error('No unassigned cards available');
      }

      logger.info(
        {
          cardCount: assignedCount,
          distributorId: data.distributorId,
          orgId,
        },
        'Bulk card assignment by count completed',
      );

      revalidatePath('/dashboard/org-admin/cards');

      return {
        success: true,
        assignedCount,
      };
    },
    { schema: BulkAssignCardsByCountSchema },
  ),
);

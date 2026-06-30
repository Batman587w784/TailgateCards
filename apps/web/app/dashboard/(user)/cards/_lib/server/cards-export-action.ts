'use server';

import 'server-only';

import { notFound } from 'next/navigation';

import { SupabaseClient } from '@supabase/supabase-js';

import { isSuperAdmin } from '@kit/admin';
import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { formatCardDisplayCode } from '~/lib/cards/format-display-code';
import { getUserTimezone } from '~/lib/dates/zoned-day';

import {
  CardData,
  applyCardFilters,
} from '../../../entities/_lib/server/entities-page.loader';
import { ExportCardsSchema } from '../schemas/export-cards.schema';

type CardQueryResult = {
  id: string;
  card_number: number | null;
  card_type: 'physical' | 'digital';
  digital_card_number: number | null;
  status: string;
  distributor_id: string | null;
  cardholder_id: string | null;
  created_at: string;
  activated_at: string | null;
  organization_id: string;
  batch_id: string | null;
  organization: {
    id: string;
    name: string;
    card_prefix: string | null;
  } | null;
  batch: { id: string; name: string; prefix: string | null } | null;
};

export const exportCardsAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const isAdmin = await isSuperAdmin(client);

    if (!isAdmin) {
      notFound();
    }

    const adminClient = getSupabaseServerAdminClient();

    const filters = {
      status: data.status?.length ? data.status : undefined,
      batch: data.batch?.length ? data.batch : undefined,
      organization: data.organization?.length ? data.organization : undefined,
      distributor: data.distributor?.length ? data.distributor : undefined,
      dateCreated: data.dateCreated?.length ? data.dateCreated : undefined,
      cardType: data.cardType?.length ? data.cardType : undefined,
    };

    // card_type and digital_card_number columns added by migration
    // 20260508100446 — typed as unknown until typegen.
    const queryBuilder = (adminClient as SupabaseClient)
      .from('cards')
      .select(
        `
        id,
        card_number,
        card_type,
        digital_card_number,
        status,
        distributor_id,
        cardholder_id,
        created_at,
        activated_at,
        organization_id,
        batch_id,
        organization:accounts!cards_organization_id_fkey(id, name, card_prefix),
        batch:batches(id, name, prefix)
      `,
      )
      .order('created_at', { ascending: false });

    const tz = await getUserTimezone();
    applyCardFilters(queryBuilder, filters, tz);

    const { data: cards, error } = await queryBuilder;

    if (error) {
      throw new Error(error.message);
    }

    const rawCards = (cards ?? []) as unknown as CardQueryResult[];
    const searchQuery = data.query?.trim();

    // Batch-fetch all distributor names in one query
    const distributorIds = [
      ...new Set(rawCards.map((c) => c.distributor_id).filter(Boolean)),
    ] as string[];

    const distributorMap = new Map<string, string>();

    if (distributorIds.length > 0) {
      const { data: distributors } = await adminClient
        .from('accounts')
        .select('id, name')
        .in('id', distributorIds);

      (distributors ?? []).forEach((d) => {
        distributorMap.set(d.id, d.name);
      });
    }

    // Transform to CardData format
    const cardDataList: CardData[] = rawCards.map((card) => {
      const org = card.organization;
      const batch = card.batch;

      const displayCode = formatCardDisplayCode({
        card_type: card.card_type,
        card_number: card.card_number,
        digital_card_number: card.digital_card_number,
        organization_prefix: org?.card_prefix ?? null,
        batch_prefix: batch?.prefix ?? null,
      });

      return {
        id: card.id,
        card_number: card.card_number,
        display_code: displayCode,
        card_type: card.card_type,
        organization_id: card.organization_id,
        organization_name: org?.name ?? 'Unknown',
        organization_prefix: org?.card_prefix ?? null,
        status: card.status as CardData['status'],
        distributor_id: card.distributor_id,
        distributor_name: card.distributor_id
          ? (distributorMap.get(card.distributor_id) ?? null)
          : null,
        cardholder_id: card.cardholder_id,
        created_at: card.created_at,
        activated_at: card.activated_at,
        batch_id: card.batch_id,
        batch_name: batch?.name ?? null,
      };
    });

    // Apply text search if present
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      const dashCount = (searchQuery.match(/-/g) || []).length;

      if (dashCount >= 2) {
        return cardDataList.filter(
          (card) => card.display_code.toLowerCase() === lowerQuery,
        );
      }

      return cardDataList.filter(
        (card) =>
          card.display_code.toLowerCase().includes(lowerQuery) ||
          card.organization_name.toLowerCase().includes(lowerQuery) ||
          (card.batch_name?.toLowerCase().includes(lowerQuery) ?? false),
      );
    }

    return cardDataList;
  },
  {
    schema: ExportCardsSchema,
  },
);

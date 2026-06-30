import 'server-only';

import { SupabaseClient } from '@supabase/supabase-js';

import { Database } from '~/lib/database.types';

const DEFAULT_PAGE_SIZE = 10;

export type OrgDistributor = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  is_active: boolean;
  created_at: string | null;
  assigned_cards: number;
  total_cards: number;
  activated_cards: number;
  total_earnings_cents: number;
};

export type DistributorOption = {
  id: string;
  name: string;
};

export async function loadOrgDistributors(
  client: SupabaseClient<Database>,
  orgId: string,
  page: number = 1,
  pageSize: number = DEFAULT_PAGE_SIZE,
  query?: string,
  sortBy?: string,
  sortOrder: 'asc' | 'desc' = 'desc',
) {
  // Map sortBy values to actual database columns
  const sortColumn = sortBy === 'name' ? 'name' : 'created_at';
  const ascending = sortOrder === 'asc';

  let queryBuilder = client
    .from('distributors_view')
    .select('id, name, email, phone, is_active, created_at, organization_id', {
      count: 'exact',
    })
    .eq('organization_id', orgId)
    .order(sortColumn, { ascending });

  if (query) {
    queryBuilder = queryBuilder.or(
      `name.ilike.%${query}%,email.ilike.%${query}%`,
    );
  }

  const { data, count, error } = await queryBuilder.range(
    (page - 1) * pageSize,
    page * pageSize - 1,
  );

  if (error) throw error;

  // Filter out any rows with null id and fetch batch-level stats
  const validDistributors = (data ?? []).filter(
    (d): d is typeof d & { id: string } => d.id !== null,
  );

  // Fetch the organization's share per activated card so revenue reflects
  // the org's cut, not the full card price paid by the cardholder.
  const { data: orgProfile } = await client
    .from('organization_profiles')
    .select('share_per_card_cents')
    .eq('account_id', orgId)
    .single();

  const sharePerCardCents = orgProfile?.share_per_card_cents ?? 0;

  const distributorsWithStats = await Promise.all(
    validDistributors.map(async (distributor) => {
      // Get card stats for cards assigned to this distributor
      const { data: cardStats } = await client
        .from('cards')
        .select('status')
        .eq('distributor_id', distributor.id);

      const cards = cardStats ?? [];
      const totalCards = cards.length;
      const activatedCards = cards.filter(
        (c) => c.status === 'activated',
      ).length;
      const totalEarnings = activatedCards * sharePerCardCents;

      return {
        id: distributor.id,
        name: distributor.name ?? '',
        email: distributor.email,
        phone: distributor.phone,
        is_active: distributor.is_active ?? true,
        created_at: distributor.created_at,
        assigned_cards: totalCards,
        total_cards: totalCards,
        activated_cards: activatedCards,
        total_earnings_cents: totalEarnings,
      };
    }),
  );

  return {
    data: distributorsWithStats as OrgDistributor[],
    count: count ?? 0,
    pageCount: Math.ceil((count ?? 0) / pageSize),
  };
}

export async function loadDistributorsForSelect(
  client: SupabaseClient<Database>,
  orgId: string,
): Promise<DistributorOption[]> {
  const { data, error } = await client
    .from('distributors_view')
    .select('id, name')
    .eq('organization_id', orgId)
    .eq('is_active', true)
    .order('name', { ascending: true });

  if (error) throw error;

  return (data ?? [])
    .filter((d): d is typeof d & { id: string } => d.id !== null)
    .map((d) => ({
      id: d.id,
      name: d.name ?? 'Unnamed Distributor',
    }));
}

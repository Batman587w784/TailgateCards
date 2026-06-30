import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

export interface CardStats {
  active_cards: number;
  inactive_cards: number;
  usage_percentage: number;
}

export interface TransactionStats {
  total_revenue_cents: number;
  failed_transactions: number;
}

export interface PlatformStats {
  active_organizations: number;
  active_merchants: number;
  total_cardholders: number;
}

export interface RevenueDataPoint {
  month: string;
  revenue: number;
}

export interface TopOrganization {
  [key: string]: string | number;
  name: string;
  total_revenue: number;
}

export interface CardUsageDistribution {
  no_usage: number;
  used_1_time: number;
  used_2_times: number;
  used_3_times: number;
  used_4_plus_times: number;
}

export interface CardTypeSplit {
  physical_total: number;
  physical_activated: number;
  digital_total: number;
  digital_activated: number;
  physical_revenue_cents: number;
  digital_revenue_cents: number;
}

const EMPTY_CARD_TYPE_SPLIT: CardTypeSplit = {
  physical_total: 0,
  physical_activated: 0,
  digital_total: 0,
  digital_activated: 0,
  physical_revenue_cents: 0,
  digital_revenue_cents: 0,
};

export interface CardsActivatedByOrg {
  organization_id: string;
  organization_name: string;
  activated_count: number;
  inactive_count: number;
}

export interface RecentActivation {
  id: string;
  cardholder_name: string | null;
  cardholder_id: string;
  card_id: string;
  display_code: string;
  organization_name: string;
  activated_at: string;
}

export interface Organization {
  id: string;
  name: string;
}

export interface SuperAdminDashboardData {
  cardStats: CardStats;
  transactionStats: TransactionStats;
  platformStats: PlatformStats;
  revenueData: RevenueDataPoint[];
  cardUsageDistribution: CardUsageDistribution;
  cardsActivatedByOrg: CardsActivatedByOrg[];
  topOrganizations: TopOrganization[];
  recentActivations: RecentActivation[];
  activationPagination: {
    page: number;
    totalPages: number;
  };
  organizations: Organization[];
  cardTypeSplit: CardTypeSplit;
}

export interface SuperAdminDashboardFilters {
  page?: number;
  organizationId?: string;
  dateFrom?: Date;
  dateTo?: Date;
}

export const loadSuperAdminDashboard = cache(superAdminDashboardLoader);

async function superAdminDashboardLoader(
  filters: SuperAdminDashboardFilters = {},
): Promise<SuperAdminDashboardData> {
  const client = getSupabaseServerClient();

  const { page = 1, organizationId, dateFrom, dateTo } = filters;

  // Convert dates to ISO strings for RPC
  const orgIdParam = organizationId || undefined;
  const dateFromParam = dateFrom?.toISOString();
  const dateToParam = dateTo?.toISOString();

  // Fetch all data in parallel with filters applied
  const [
    organizationsResult,
    cardStatsResult,
    transactionStatsResult,
    platformStatsResult,
    revenueResult,
    cardUsageResult,
    cardsActivatedResult,
    topOrgsResult,
    activationsResult,
    cardTypeSplitResult,
  ] = await Promise.all([
    client.rpc('get_admin_organizations_list'),
    client.rpc('get_admin_card_stats_filtered', {
      p_organization_id: orgIdParam,
      p_date_from: dateFromParam,
      p_date_to: dateToParam,
    }),
    client.rpc('get_admin_transaction_stats_filtered', {
      p_organization_id: orgIdParam,
      p_date_from: dateFromParam,
      p_date_to: dateToParam,
    }),
    client.rpc('get_admin_platform_stats', {
      p_organization_id: orgIdParam,
    }),
    client.rpc('get_admin_revenue_over_time', {
      months_back: 6,
      p_organization_id: orgIdParam,
      p_date_from: dateFromParam,
      p_date_to: dateToParam,
    }),
    client.rpc('get_admin_card_usage_distribution', {
      p_organization_id: orgIdParam,
      p_date_from: dateFromParam,
      p_date_to: dateToParam,
    }),
    client.rpc('get_admin_cards_activated_by_org', {
      p_date_from: dateFromParam,
      p_date_to: dateToParam,
    }),
    client.rpc('get_admin_top_organizations', {
      limit_count: 5,
      p_date_from: dateFromParam,
      p_date_to: dateToParam,
    }),
    client.rpc('get_admin_recent_activations', {
      p_organization_id: orgIdParam,
      p_date_from: dateFromParam,
      p_date_to: dateToParam,
      p_page: page,
      p_limit: 10,
    }),
    client.rpc('get_admin_card_type_split', {
      p_organization_id: orgIdParam,
      p_date_from: dateFromParam,
      p_date_to: dateToParam,
    }),
  ]);

  // Parse organizations
  const organizations: Organization[] = (organizationsResult.data ?? []).map(
    (row: { id: string; name: string }) => ({
      id: row.id,
      name: row.name,
    }),
  );

  // Parse card stats
  const cardStats: CardStats = (cardStatsResult.data as CardStats | null) ?? {
    active_cards: 0,
    inactive_cards: 0,
    usage_percentage: 0,
  };

  // Parse transaction stats
  const transactionStats: TransactionStats =
    (transactionStatsResult.data as TransactionStats | null) ?? {
      total_revenue_cents: 0,
      failed_transactions: 0,
    };

  // Parse platform stats
  const platformStats: PlatformStats =
    (platformStatsResult.data as PlatformStats | null) ?? {
      active_organizations: 0,
      active_merchants: 0,
      total_cardholders: 0,
    };

  // Parse revenue data
  const revenueData: RevenueDataPoint[] = (revenueResult.data ?? []).map(
    (row: { month: string; revenue: number }) => ({
      month: row.month,
      revenue: row.revenue,
    }),
  );

  // Parse card usage distribution
  const cardUsageDistribution: CardUsageDistribution =
    (cardUsageResult.data as CardUsageDistribution | null) ?? {
      no_usage: 0,
      used_1_time: 0,
      used_2_times: 0,
      used_3_times: 0,
      used_4_plus_times: 0,
    };

  // Parse cards activated by org
  const cardsActivatedByOrg: CardsActivatedByOrg[] = (
    cardsActivatedResult.data ?? []
  ).map(
    (row: {
      organization_id: string;
      organization_name: string;
      activated_count: number;
      inactive_count: number;
    }) => ({
      organization_id: row.organization_id,
      organization_name: row.organization_name,
      activated_count: Number(row.activated_count),
      inactive_count: Number(row.inactive_count),
    }),
  );

  // Parse top organizations
  const topOrganizations: TopOrganization[] = (topOrgsResult.data ?? []).map(
    (row: { name: string; total_revenue: number }) => ({
      name: row.name,
      total_revenue: row.total_revenue,
    }),
  );

  // Parse recent activations
  const activationsData = activationsResult.data as {
    data: Array<{
      id: string;
      cardholder_name: string | null;
      cardholder_id: string;
      card_id: string;
      display_code: string;
      organization_name: string;
      activated_at: string;
    }>;
    count: number;
    page: number;
    limit: number;
  } | null;

  const recentActivations: RecentActivation[] = (
    activationsData?.data ?? []
  ).map((item) => ({
    id: item.id,
    cardholder_name: item.cardholder_name,
    cardholder_id: item.cardholder_id,
    card_id: item.card_id,
    display_code: item.display_code,
    organization_name: item.organization_name,
    activated_at: item.activated_at,
  }));

  const totalPages = activationsData
    ? Math.ceil(activationsData.count / activationsData.limit)
    : 1;

  const cardTypeSplitData =
    cardTypeSplitResult.data as Partial<CardTypeSplit> | null;
  const cardTypeSplit: CardTypeSplit = cardTypeSplitData
    ? {
        physical_total: Number(cardTypeSplitData.physical_total ?? 0),
        physical_activated: Number(cardTypeSplitData.physical_activated ?? 0),
        digital_total: Number(cardTypeSplitData.digital_total ?? 0),
        digital_activated: Number(cardTypeSplitData.digital_activated ?? 0),
        physical_revenue_cents: Number(
          cardTypeSplitData.physical_revenue_cents ?? 0,
        ),
        digital_revenue_cents: Number(
          cardTypeSplitData.digital_revenue_cents ?? 0,
        ),
      }
    : EMPTY_CARD_TYPE_SPLIT;

  return {
    cardStats,
    transactionStats,
    platformStats,
    revenueData,
    cardUsageDistribution,
    cardsActivatedByOrg,
    topOrganizations,
    recentActivations,
    activationPagination: {
      page,
      totalPages,
    },
    organizations,
    cardTypeSplit,
  };
}

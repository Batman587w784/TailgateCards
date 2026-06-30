import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  getUserTimezone,
  zonedDayEndUTC,
  zonedDayStartUTC,
} from '~/lib/dates/zoned-day';

import { getUserOrganizationId } from './role-guards';

export interface CardStats {
  total_cards: number;
  inactive_cards: number;
  unassigned_cards: number;
  cards_activated: number;
  expired_cards: number;
  cancelled_cards: number;
}

export interface RevenueStats {
  total_revenue_cents: number;
  total_activated_revenue_cents: number;
  total_pending_revenue_cents: number;
  stripe_revenue_cents: number;
  cash_revenue_cents: number;
}

export interface DistributorStats {
  total_distributors: number;
  active_distributors: number;
}

export interface SalesDataPoint {
  month: string;
  sales_count: number;
  revenue_cents: number;
}

export interface TopDistributor {
  distributor_id: string;
  distributor_name: string;
  cards_activated: number;
  total_cards: number;
  revenue_cents: number;
}

export interface RecentActivation {
  activation_id: string;
  display_code: string;
  cardholder_name: string | null;
  distributor_name: string | null;
  activated_at: string;
  price_cents: number;
}

export interface CardsDistribution {
  assigned_cards: number;
  unassigned_cards: number;
  activated_cards: number;
  pending_cards: number;
  total_raised_cents: number;
}

export interface CardTypeSplit {
  physical_total: number;
  physical_activated: number;
  digital_total: number;
  digital_activated: number;
  physical_revenue_cents: number;
  digital_revenue_cents: number;
}

export interface DistributorOption {
  id: string;
  name: string;
}

export interface OrgAdminDashboardFilters {
  dateFrom?: string;
  dateTo?: string;
  distributorIds?: string[];
}

export interface OrgAdminDashboardData {
  organizationName: string;
  cardStats: CardStats;
  revenueStats: RevenueStats;
  distributorStats: DistributorStats;
  salesData: SalesDataPoint[];
  topDistributors: TopDistributor[];
  recentActivations: RecentActivation[];
  cardsDistribution: CardsDistribution;
  cardTypeSplit: CardTypeSplit;
  distributorsForFilter: DistributorOption[];
}

const EMPTY_CARD_TYPE_SPLIT: CardTypeSplit = {
  physical_total: 0,
  physical_activated: 0,
  digital_total: 0,
  digital_activated: 0,
  physical_revenue_cents: 0,
  digital_revenue_cents: 0,
};

export async function loadOrgAdminDashboard(
  filters: OrgAdminDashboardFilters = {},
): Promise<OrgAdminDashboardData> {
  const client = getSupabaseServerClient();
  const orgId = await getUserOrganizationId();

  if (!orgId) {
    return getEmptyDashboardData();
  }

  const { dateFrom, dateTo, distributorIds } = filters;

  // Convert tz-naive yyyy-MM-dd filter dates to UTC instants anchored to the
  // user's IANA timezone so e.g. "2026-05-15" means the calendar day in the
  // viewer's locale, not in UTC.
  const tz = await getUserTimezone();
  const dateFromParam = dateFrom ? zonedDayStartUTC(dateFrom, tz) : undefined;
  const dateToParam = dateTo ? zonedDayEndUTC(dateTo, tz) : undefined;

  // For single distributor filter - if multiple, use first one
  // Most dashboard stats work best with single distributor filter
  const distributorIdParam =
    distributorIds && distributorIds.length === 1
      ? distributorIds[0]
      : undefined;

  const [
    orgProfileResult,
    cardStatsResult,
    revenueStatsResult,
    distributorStatsResult,
    salesDataResult,
    topDistributorsResult,
    recentActivationsResult,
    cardsDistributionResult,
    cardTypeSplitResult,
    distributorsForFilterResult,
  ] = await Promise.all([
    client
      .from('organization_profiles')
      .select('organization_name')
      .eq('account_id', orgId)
      .single(),
    client.rpc('get_org_admin_card_stats', {
      org_account_id: orgId,
      p_date_from: dateFromParam,
      p_date_to: dateToParam,
      p_distributor_id: distributorIdParam,
    }),
    client.rpc('get_org_admin_revenue_stats', {
      org_account_id: orgId,
      p_date_from: dateFromParam,
      p_date_to: dateToParam,
      p_distributor_id: distributorIdParam,
    }),
    client.rpc('get_org_admin_distributor_stats', {
      org_account_id: orgId,
      p_date_from: dateFromParam,
      p_date_to: dateToParam,
    }),
    client.rpc('get_org_admin_sales_over_time', {
      org_account_id: orgId,
      months_back: 6,
      p_distributor_id: distributorIdParam,
    }),
    client.rpc('get_org_admin_top_distributors', {
      org_account_id: orgId,
      limit_count: 5,
      p_date_from: dateFromParam,
      p_date_to: dateToParam,
    }),
    client.rpc('get_org_admin_recent_activations', {
      org_account_id: orgId,
      limit_count: 10,
      p_date_from: dateFromParam,
      p_date_to: dateToParam,
      p_distributor_id: distributorIdParam,
    }),
    client.rpc('get_org_admin_cards_distribution', {
      org_account_id: orgId,
      p_date_from: dateFromParam,
      p_date_to: dateToParam,
      p_distributor_id: distributorIdParam,
    }),
    client.rpc('get_org_admin_card_type_split', {
      org_account_id: orgId,
      p_date_from: dateFromParam,
      p_date_to: dateToParam,
      p_distributor_id: distributorIdParam,
    }),
    // Load all distributors for filter dropdown (unfiltered)
    client
      .from('distributors_view')
      .select('id, name')
      .eq('organization_id', orgId)
      .order('name', { ascending: true }),
  ]);

  const organizationName = orgProfileResult.data?.organization_name ?? '';

  const cardStats: CardStats = (cardStatsResult.data as CardStats | null) ?? {
    total_cards: 0,
    inactive_cards: 0,
    unassigned_cards: 0,
    cards_activated: 0,
    expired_cards: 0,
    cancelled_cards: 0,
  };

  const revenueStats: RevenueStats =
    (revenueStatsResult.data as RevenueStats | null) ?? {
      total_revenue_cents: 0,
      total_activated_revenue_cents: 0,
      total_pending_revenue_cents: 0,
      stripe_revenue_cents: 0,
      cash_revenue_cents: 0,
    };

  const distributorStats: DistributorStats =
    (distributorStatsResult.data as DistributorStats | null) ?? {
      total_distributors: 0,
      active_distributors: 0,
    };

  const salesData: SalesDataPoint[] = (salesDataResult.data ?? []).map(
    (row: { month: string; sales_count: number; revenue_cents: number }) => ({
      month: row.month,
      sales_count: row.sales_count,
      revenue_cents: row.revenue_cents,
    }),
  );

  const topDistributors: TopDistributor[] = (
    topDistributorsResult.data ?? []
  ).map(
    (row: {
      distributor_id: string;
      distributor_name: string;
      cards_activated: number;
      total_cards: number;
      revenue_cents: number;
    }) => ({
      distributor_id: row.distributor_id,
      distributor_name: row.distributor_name,
      cards_activated: row.cards_activated,
      total_cards: row.total_cards,
      revenue_cents: row.revenue_cents,
    }),
  );

  const recentActivations: RecentActivation[] = (
    recentActivationsResult.data ?? []
  ).map(
    (row: {
      activation_id: string;
      display_code: string;
      cardholder_name: string | null;
      distributor_name: string | null;
      activated_at: string;
      price_cents: number;
    }) => ({
      activation_id: row.activation_id,
      display_code: row.display_code,
      cardholder_name: row.cardholder_name,
      distributor_name: row.distributor_name,
      activated_at: row.activated_at,
      price_cents: row.price_cents,
    }),
  );

  const cardsDistribution: CardsDistribution =
    (cardsDistributionResult.data as CardsDistribution | null) ?? {
      assigned_cards: 0,
      unassigned_cards: 0,
      activated_cards: 0,
      pending_cards: 0,
      total_raised_cents: 0,
    };

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

  const distributorsForFilter: DistributorOption[] = (
    distributorsForFilterResult.data ?? []
  )
    .filter(
      (d: {
        id: string | null;
        name: string | null;
      }): d is { id: string; name: string | null } => d.id !== null,
    )
    .map((d: { id: string; name: string | null }) => ({
      id: d.id,
      name: d.name ?? 'Unnamed Distributor',
    }));

  return {
    organizationName,
    cardStats,
    revenueStats,
    distributorStats,
    salesData,
    topDistributors,
    recentActivations,
    cardsDistribution,
    cardTypeSplit,
    distributorsForFilter,
  };
}

function getEmptyDashboardData(): OrgAdminDashboardData {
  return {
    organizationName: '',
    cardStats: {
      total_cards: 0,
      inactive_cards: 0,
      unassigned_cards: 0,
      cards_activated: 0,
      expired_cards: 0,
      cancelled_cards: 0,
    },
    revenueStats: {
      total_revenue_cents: 0,
      total_activated_revenue_cents: 0,
      total_pending_revenue_cents: 0,
      stripe_revenue_cents: 0,
      cash_revenue_cents: 0,
    },
    distributorStats: {
      total_distributors: 0,
      active_distributors: 0,
    },
    salesData: [],
    topDistributors: [],
    recentActivations: [],
    cardsDistribution: {
      assigned_cards: 0,
      unassigned_cards: 0,
      activated_cards: 0,
      pending_cards: 0,
      total_raised_cents: 0,
    },
    cardTypeSplit: EMPTY_CARD_TYPE_SPLIT,
    distributorsForFilter: [],
  };
}

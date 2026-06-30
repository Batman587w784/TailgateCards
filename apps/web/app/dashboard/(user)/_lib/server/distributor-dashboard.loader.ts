import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  getUserTimezone,
  zonedDayEndUTC,
  zonedDayStartUTC,
} from '~/lib/dates/zoned-day';

import { getUserOrganizationId } from './role-guards';

export interface DistributorCardStats {
  total_assigned: number;
  remaining: number;
  activated: number;
  total_sales: number;
  activation_rate: number;
}

export interface SalesDataPoint {
  month: string;
  month_start: string;
  sales_count: number;
  revenue_cents: number;
}

export interface DistributorActivity {
  id: string;
  activity_type: string;
  message: string;
  created_at: string;
}

export interface DistributorTopRanking {
  distributor_id: string;
  distributor_name: string;
  cards_activated: number;
  total_cards: number;
  revenue_cents: number;
}

export interface DistributorDashboardFilters {
  dateFrom?: string;
  dateTo?: string;
}

export interface DistributorDashboardData {
  distributorId: string | null;
  distributorName: string | null;
  shareSlug: string | null;
  cardStats: DistributorCardStats;
  totalEarnings: number;
  salesTrend: SalesDataPoint[];
  recentActivities: DistributorActivity[];
  topDistributors: DistributorTopRanking[];
}

/**
 * Get the current user's ID if they have a distributor role.
 * Cards table uses user_id as distributor_id, not account_id.
 */
async function getUserDistributorId(): Promise<string | null> {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) return null;

  const { data } = await client
    .from('accounts_memberships')
    .select('user_id')
    .eq('user_id', user.id)
    .eq('account_role', 'distributor')
    .limit(1)
    .maybeSingle();

  return data?.user_id ?? null;
}

export async function loadDistributorDashboard(
  filters: DistributorDashboardFilters = {},
): Promise<DistributorDashboardData> {
  const client = getSupabaseServerClient();
  const distributorId = await getUserDistributorId();

  if (!distributorId) {
    return getEmptyDashboardData();
  }

  const { dateFrom, dateTo } = filters;
  const tz = await getUserTimezone();
  const dateFromParam = dateFrom ? zonedDayStartUTC(dateFrom, tz) : undefined;
  const dateToParam = dateTo ? zonedDayEndUTC(dateTo, tz) : undefined;

  const orgId = await getUserOrganizationId();

  const { data: accountData } = await client
    .from('accounts')
    .select('name')
    .eq('primary_owner_user_id', distributorId)
    .eq('is_personal_account', true)
    .maybeSingle();

  const distributorName = accountData?.name ?? null;

  const { data: membershipRow } = await client
    .from('accounts_memberships')
    .select('share_slug')
    .eq('user_id', distributorId)
    .eq('account_role', 'distributor')
    .limit(1)
    .maybeSingle();

  const shareSlug = membershipRow?.share_slug ?? null;

  const [
    cardStatsResult,
    revenueResult,
    salesTrendResult,
    activitiesResult,
    topDistributorsResult,
  ] = await Promise.all([
    client.rpc('get_distributor_card_stats', {
      p_distributor_id: distributorId,
      p_date_from: dateFromParam,
      p_date_to: dateToParam,
    }),
    client.rpc('get_distributor_revenue_stats', {
      p_distributor_id: distributorId,
      p_date_from: dateFromParam,
      p_date_to: dateToParam,
    }),
    client.rpc('get_distributor_sales_over_time', {
      p_distributor_id: distributorId,
      p_months_back: 6,
      p_date_from: dateFromParam,
      p_date_to: dateToParam,
    }),
    client.rpc('get_distributor_recent_activities', {
      p_distributor_id: distributorId,
      p_limit: 20,
      p_date_from: dateFromParam,
      p_date_to: dateToParam,
    }),
    orgId
      ? client.rpc('get_org_admin_top_distributors', {
          org_account_id: orgId,
          limit_count: 5,
          p_date_from: dateFromParam,
          p_date_to: dateToParam,
        })
      : Promise.resolve({ data: null }),
  ]);

  const cardStatsRow = Array.isArray(cardStatsResult.data)
    ? cardStatsResult.data[0]
    : null;

  const cardStats: DistributorCardStats = cardStatsRow
    ? {
        total_assigned: Number(cardStatsRow.total_assigned ?? 0),
        remaining: Number(cardStatsRow.remaining ?? 0),
        activated: Number(cardStatsRow.activated ?? 0),
        total_sales: Number(cardStatsRow.total_sales ?? 0),
        activation_rate: Number(cardStatsRow.activation_rate ?? 0),
      }
    : {
        total_assigned: 0,
        remaining: 0,
        activated: 0,
        total_sales: 0,
        activation_rate: 0,
      };

  const revenueRow = Array.isArray(revenueResult.data)
    ? revenueResult.data[0]
    : null;

  const totalEarnings = revenueRow?.total_earnings_cents
    ? Number(revenueRow.total_earnings_cents)
    : 0;

  const salesTrendData = (salesTrendResult.data ?? []) as Array<{
    month: string;
    month_start: string;
    sales_count: number;
    revenue_cents: number;
  }>;
  const salesTrend: SalesDataPoint[] = salesTrendData.map((row) => ({
    month: row.month,
    month_start: row.month_start,
    sales_count: row.sales_count,
    revenue_cents: row.revenue_cents,
  }));

  const activitiesData = (activitiesResult.data ?? []) as Array<{
    id: string;
    activity_type: string;
    message: string;
    created_at: string;
  }>;
  const recentActivities: DistributorActivity[] = activitiesData.map((row) => ({
    id: row.id,
    activity_type: row.activity_type,
    message: row.message,
    created_at: row.created_at,
  }));

  const topDistributorsRows = (topDistributorsResult.data ?? []) as Array<{
    distributor_id: string;
    distributor_name: string;
    cards_activated: number;
    total_cards: number;
    revenue_cents: number;
  }>;
  const topDistributors: DistributorTopRanking[] = topDistributorsRows.map(
    (row) => ({
      distributor_id: row.distributor_id,
      distributor_name: row.distributor_name,
      cards_activated: Number(row.cards_activated),
      total_cards: Number(row.total_cards),
      revenue_cents: Number(row.revenue_cents),
    }),
  );

  return {
    distributorId,
    distributorName,
    shareSlug,
    cardStats,
    totalEarnings,
    salesTrend,
    recentActivities,
    topDistributors,
  };
}

function getEmptyDashboardData(): DistributorDashboardData {
  return {
    distributorId: null,
    distributorName: null,
    shareSlug: null,
    cardStats: {
      total_assigned: 0,
      remaining: 0,
      activated: 0,
      total_sales: 0,
      activation_rate: 0,
    },
    totalEarnings: 0,
    salesTrend: [],
    recentActivities: [],
    topDistributors: [],
  };
}

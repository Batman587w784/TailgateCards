import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { getUserMerchantId } from './role-guards';

// --- Interfaces ---
export interface VisitorKPIStats {
  total_redemptions: number;
  unique_visitors: number;
  new_visitors: number;
  avg_visits_per_user: number;
}

export interface RedemptionTimeData {
  month: string;
  redemption_count: number;
}

export interface VisitAnalytics {
  total_unique_visitors: number;
  one_visit: number;
  two_visits: number;
  three_visits: number;
  four_plus_visits: number;
}

export interface RecentScan {
  id: string;
  discount_id: string;
  discount_title: string;
  card_code: string;
  redeemed_at: string;
}

export interface MerchantInfo {
  id: string;
  business_name: string;
}

export interface VisitorInsightsFilters {
  dateFrom?: Date;
  dateTo?: Date;
}

export interface VisitorInsightsData {
  merchant: MerchantInfo | null;
  kpiStats: VisitorKPIStats;
  redemptionsOverTime: RedemptionTimeData[];
  visitAnalytics: VisitAnalytics;
  recentScans: RecentScan[];
}

// --- Loader ---
export const loadVisitorInsights = cache(visitorInsightsLoader);

async function visitorInsightsLoader(
  filters: VisitorInsightsFilters = {},
): Promise<VisitorInsightsData> {
  const client = getSupabaseServerClient();
  const merchantId = await getUserMerchantId();

  if (!merchantId) {
    return getEmptyData();
  }

  // Convert dates to ISO strings for RPC - defensive check
  const dateFromParam =
    filters.dateFrom && !isNaN(filters.dateFrom.getTime())
      ? filters.dateFrom.toISOString()
      : undefined;
  const dateToParam =
    filters.dateTo && !isNaN(filters.dateTo.getTime())
      ? filters.dateTo.toISOString()
      : undefined;

  const [
    merchantResult,
    kpiResult,
    timeDataResult,
    analyticsResult,
    scansResult,
  ] = await Promise.all([
    client
      .from('merchant_profiles')
      .select('account_id, business_name')
      .eq('account_id', merchantId)
      .single(),
    client.rpc('get_merchant_visitor_kpi_stats', {
      merchant_account_id: merchantId,
      time_period_months: 6,
      p_date_from: dateFromParam,
      p_date_to: dateToParam,
    }),
    client.rpc('get_merchant_redemptions_over_time', {
      merchant_account_id: merchantId,
      months_back: 6,
      p_date_from: dateFromParam,
      p_date_to: dateToParam,
    }),
    client.rpc('get_merchant_visit_analytics', {
      merchant_account_id: merchantId,
      time_period_months: 6,
      p_date_from: dateFromParam,
      p_date_to: dateToParam,
    }),
    client.rpc('get_merchant_recent_scans', {
      merchant_account_id: merchantId,
      limit_count: 10,
      p_date_from: dateFromParam,
      p_date_to: dateToParam,
    }),
  ]);

  // Log errors but continue with partial data
  if (kpiResult.error) {
    console.error('Failed to load KPI stats:', kpiResult.error);
  }
  if (timeDataResult.error) {
    console.error(
      'Failed to load redemptions over time:',
      timeDataResult.error,
    );
  }
  if (analyticsResult.error) {
    console.error('Failed to load visit analytics:', analyticsResult.error);
  }
  if (scansResult.error) {
    console.error('Failed to load recent scans:', scansResult.error);
  }

  const merchant = merchantResult.data
    ? {
        id: merchantResult.data.account_id,
        business_name: merchantResult.data.business_name ?? 'Unknown Business',
      }
    : null;

  const rawKpi = kpiResult.data as {
    total_redemptions: number;
    unique_visitors: number;
    new_visitors: number;
  } | null;

  const kpiStats: VisitorKPIStats = {
    total_redemptions: rawKpi?.total_redemptions ?? 0,
    unique_visitors: rawKpi?.unique_visitors ?? 0,
    new_visitors: rawKpi?.new_visitors ?? 0,
    avg_visits_per_user:
      rawKpi && rawKpi.unique_visitors > 0
        ? Number((rawKpi.total_redemptions / rawKpi.unique_visitors).toFixed(1))
        : 0,
  };

  const redemptionsOverTime: RedemptionTimeData[] = (
    (timeDataResult.data ?? []) as Array<{
      month: string;
      redemption_count: number;
    }>
  ).map((row) => ({
    month: row.month,
    redemption_count: Number(row.redemption_count),
  }));

  const rawAnalytics = analyticsResult.data as {
    total_unique_visitors: number;
    one_visit: number;
    two_visits: number;
    three_visits: number;
    four_plus_visits: number;
  } | null;

  const visitAnalytics: VisitAnalytics = {
    total_unique_visitors: rawAnalytics?.total_unique_visitors ?? 0,
    one_visit: rawAnalytics?.one_visit ?? 0,
    two_visits: rawAnalytics?.two_visits ?? 0,
    three_visits: rawAnalytics?.three_visits ?? 0,
    four_plus_visits: rawAnalytics?.four_plus_visits ?? 0,
  };

  const recentScans: RecentScan[] = (
    (scansResult.data ?? []) as Array<{
      id: string;
      discount_id: string;
      discount_title: string;
      card_code: string;
      redeemed_at: string;
    }>
  ).map((row) => ({
    id: row.id,
    discount_id: row.discount_id,
    discount_title: row.discount_title,
    card_code: row.card_code,
    redeemed_at: row.redeemed_at,
  }));

  return {
    merchant,
    kpiStats,
    redemptionsOverTime,
    visitAnalytics,
    recentScans,
  };
}

function getEmptyData(): VisitorInsightsData {
  return {
    merchant: null,
    kpiStats: {
      total_redemptions: 0,
      unique_visitors: 0,
      new_visitors: 0,
      avg_visits_per_user: 0,
    },
    redemptionsOverTime: [],
    visitAnalytics: {
      total_unique_visitors: 0,
      one_visit: 0,
      two_visits: 0,
      three_visits: 0,
      four_plus_visits: 0,
    },
    recentScans: [],
  };
}

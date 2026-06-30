import 'server-only';

import { SupabaseClient } from '@supabase/supabase-js';

import { formatCardDisplayCode } from '~/lib/cards/format-display-code';
import { Database } from '~/lib/database.types';

import type {
  PaymentStats,
  PaymentTransaction,
} from '../schemas/payment.schema';

const DEFAULT_PAGE_SIZE = 10;

export async function loadPaymentsStats(
  client: SupabaseClient<Database>,
): Promise<PaymentStats> {
  const { data, error } = await client.rpc('get_admin_transaction_stats');

  if (error) throw error;

  const stats = data as PaymentStats | null;

  return {
    total_volume_cents: stats?.total_volume_cents ?? 0,
    revenue_generated_cents: stats?.revenue_generated_cents ?? 0,
    successful_transactions: stats?.successful_transactions ?? 0,
    failed_transactions: stats?.failed_transactions ?? 0,
  };
}

export type SortColumn =
  | 'date'
  | 'amount'
  | 'status'
  | 'cardholder_email'
  | 'organization_name';

export async function loadPayments(
  client: SupabaseClient<Database>,
  page: number = 1,
  pageSize: number = DEFAULT_PAGE_SIZE,
  query?: string,
  sortColumn: SortColumn = 'date',
  sortDirection: 'asc' | 'desc' = 'desc',
) {
  // If searching, check for matching organization names and cardholder emails
  let orgFilterIds: string[] | null = null;
  let cardholderFilterIds: string[] | null = null;

  if (query) {
    // Search organization names
    const { data: orgMatches } = await client
      .from('organization_profiles')
      .select('account_id')
      .ilike('organization_name', `%${query}%`);

    if (orgMatches && orgMatches.length > 0) {
      orgFilterIds = orgMatches.map((o) => o.account_id);
    }

    // Search cardholder emails in accounts table
    const { data: accountMatches } = await client
      .from('accounts')
      .select('id')
      .ilike('email', `%${query}%`);

    if (accountMatches && accountMatches.length > 0) {
      cardholderFilterIds = accountMatches.map((a) => a.id);
    }
  }

  // Build the base query
  let queryBuilder = client
    .from('cards')
    .select(
      `
      id,
      stripe_payment_intent_id,
      stripe_customer_email,
      organization_id,
      cardholder_id,
      price_cents,
      paid_at,
      created_at,
      status,
      batch_id,
      card_number,
      card_type,
      digital_card_number
    `,
      { count: 'exact' },
    )
    .in('status', ['paid', 'activated', 'expired', 'cancelled']);

  // Apply search filter - email OR organization OR cardholder email
  if (query) {
    const orConditions: string[] = [];

    // Always search by stripe_customer_email
    orConditions.push(`stripe_customer_email.ilike.%${query}%`);

    // Search by organization ID if matches found
    if (orgFilterIds && orgFilterIds.length > 0) {
      orConditions.push(`organization_id.in.(${orgFilterIds.join(',')})`);
    }

    // Search by cardholder_id if email matches found in accounts
    if (cardholderFilterIds && cardholderFilterIds.length > 0) {
      orConditions.push(`cardholder_id.in.(${cardholderFilterIds.join(',')})`);
    }

    queryBuilder = queryBuilder.or(orConditions.join(','));
  }

  // Apply sorting based on column
  // Note: email and organization sorting happens after data transformation
  const dbSortColumn = getDbSortColumn(sortColumn);
  if (dbSortColumn) {
    queryBuilder = queryBuilder.order(dbSortColumn, {
      ascending: sortDirection === 'asc',
      nullsFirst: false,
    });
  } else {
    // Default sort by date for columns that need post-processing
    queryBuilder = queryBuilder.order('paid_at', {
      ascending: false,
      nullsFirst: false,
    });
  }

  // Apply pagination
  const { data, count, error } = await queryBuilder.range(
    (page - 1) * pageSize,
    page * pageSize - 1,
  );

  if (error) throw error;

  if (!data || data.length === 0) {
    return {
      data: [],
      count: 0,
      pageCount: 0,
    };
  }

  // Batch fetch organization names (single query instead of N queries)
  const orgIds = [
    ...new Set(data.map((c) => c.organization_id).filter(Boolean)),
  ];
  const { data: orgsData } = await client
    .from('organization_profiles')
    .select('account_id, organization_name')
    .in('account_id', orgIds);

  const orgMap = new Map(
    (orgsData ?? []).map((o) => [o.account_id, o.organization_name]),
  );

  // Batch fetch organization card prefixes
  const { data: accountsWithPrefix } = await client
    .from('accounts')
    .select('id, card_prefix')
    .in('id', orgIds);

  const orgPrefixMap = new Map(
    (accountsWithPrefix ?? []).map((a) => [a.id, a.card_prefix]),
  );

  // Batch fetch batch prefixes
  const batchIds = [
    ...new Set(data.map((c) => c.batch_id).filter(Boolean)),
  ] as string[];

  let batchPrefixMap = new Map<string, string | null>();
  if (batchIds.length > 0) {
    const { data: batchesData } = await client
      .from('batches')
      .select('id, prefix')
      .in('id', batchIds);

    batchPrefixMap = new Map((batchesData ?? []).map((b) => [b.id, b.prefix]));
  }

  // Batch fetch cardholder emails for cards without stripe_customer_email
  const cardholderIds = [
    ...new Set(
      data
        .filter((c) => !c.stripe_customer_email && c.cardholder_id)
        .map((c) => c.cardholder_id as string),
    ),
  ];

  let cardholderEmailMap = new Map<string, string | null>();
  if (cardholderIds.length > 0) {
    const { data: accountsData } = await client
      .from('accounts')
      .select('id, email')
      .in('id', cardholderIds);

    cardholderEmailMap = new Map(
      (accountsData ?? []).map((a) => [a.id, a.email]),
    );
  }

  // Transform data with pre-fetched lookups (no additional queries)
  let payments: PaymentTransaction[] = data.map((card) => {
    const cardholderEmail =
      card.stripe_customer_email ??
      (card.cardholder_id
        ? cardholderEmailMap.get(card.cardholder_id)
        : null) ??
      null;

    const orgPrefix = card.organization_id
      ? (orgPrefixMap.get(card.organization_id) ?? null)
      : null;
    const batchPrefix = card.batch_id
      ? (batchPrefixMap.get(card.batch_id) ?? null)
      : null;

    const formatted = formatCardDisplayCode({
      card_type: card.card_type,
      card_number: card.card_number,
      digital_card_number: card.digital_card_number,
      organization_prefix: orgPrefix,
      batch_prefix: batchPrefix,
    });
    const cardId = formatted !== '' ? formatted : card.id.substring(0, 8);

    return {
      transaction_id: card.stripe_payment_intent_id ?? card.id,
      card_id: cardId,
      cardholder_email: cardholderEmail,
      organization_name: card.organization_id
        ? (orgMap.get(card.organization_id) ?? null)
        : null,
      amount_cents: card.price_cents ?? 0,
      date: card.paid_at ?? card.created_at ?? new Date().toISOString(),
      status: card.status === 'cancelled' ? 'failed' : 'successful',
    };
  });

  // Apply client-side sorting for columns not directly in DB
  if (sortColumn === 'cardholder_email' || sortColumn === 'organization_name') {
    payments = sortPaymentsInMemory(payments, sortColumn, sortDirection);
  }

  return {
    data: payments,
    count: count ?? 0,
    pageCount: Math.ceil((count ?? 0) / pageSize),
  };
}

function getDbSortColumn(
  sortColumn: SortColumn,
): 'paid_at' | 'price_cents' | 'status' | null {
  switch (sortColumn) {
    case 'date':
      return 'paid_at';
    case 'amount':
      return 'price_cents';
    case 'status':
      return 'status';
    default:
      return null;
  }
}

function sortPaymentsInMemory(
  payments: PaymentTransaction[],
  sortColumn: 'cardholder_email' | 'organization_name',
  sortDirection: 'asc' | 'desc',
): PaymentTransaction[] {
  return [...payments].sort((a, b) => {
    const aVal = a[sortColumn] ?? '';
    const bVal = b[sortColumn] ?? '';
    const comparison = aVal.localeCompare(bVal);
    return sortDirection === 'asc' ? comparison : -comparison;
  });
}

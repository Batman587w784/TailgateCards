export type SalesCardTypeFilter = 'all' | 'physical' | 'digital';

export type SalesStatusFilter = 'all' | 'active' | 'inactive';

export const STATUS_FILTER_TO_DB: Record<
  Exclude<SalesStatusFilter, 'all'>,
  string[]
> = {
  active: ['activated'],
  inactive: ['pending', 'paid', 'cancelled', 'expired'],
};

export const DB_STATUS_TO_DISPLAY: Record<string, 'Active' | 'Inactive'> = {
  activated: 'Active',
  pending: 'Inactive',
  paid: 'Inactive',
  cancelled: 'Inactive',
  expired: 'Inactive',
};

export interface SalesFilters {
  soldFrom: string | null;
  soldTo: string | null;
  assignedFrom: string | null;
  assignedTo: string | null;
  cardType: SalesCardTypeFilter;
  status: SalesStatusFilter;
  query: string | null;
}

export interface SaleData {
  id: string;
  display_code: string;
  status: string;
  card_type: 'physical' | 'digital';
  activated_at: string | null;
  assigned_at: string | null;
  price_cents: number | null;
  organization_name: string;
  batch_name: string | null;
  cardholder_name: string | null;
  [key: string]: unknown;
}

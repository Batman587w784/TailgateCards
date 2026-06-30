export interface FilterOption {
  id: string;
  label: string;
}

export interface FilterCategory {
  id: keyof CardsFilters;
  label: string;
  options: FilterOption[];
}

export interface CardsFilters {
  status: string[];
  batch: string[];
  organization: string[];
  distributor: string[];
  dateCreated: string[];
  cardType: string[];
}

export const STATUS_FILTER_OPTIONS: FilterOption[] = [
  { id: 'active', label: 'Active' },
  { id: 'expired', label: 'Expired' },
  { id: 'inactive', label: 'Inactive' },
];

export const CARD_TYPE_FILTER_OPTIONS: FilterOption[] = [
  { id: 'physical', label: 'Physical' },
  { id: 'digital', label: 'Digital' },
];

// Maps display status to database status values
export const STATUS_TO_DB_MAP: Record<string, string[]> = {
  active: ['activated'],
  expired: ['expired'],
  inactive: ['pending', 'paid', 'cancelled'],
};

// Maps database status to display status
export const DB_STATUS_TO_DISPLAY: Record<string, string> = {
  activated: 'Active',
  expired: 'Expired',
  pending: 'Inactive',
  paid: 'Inactive',
  cancelled: 'Inactive',
};

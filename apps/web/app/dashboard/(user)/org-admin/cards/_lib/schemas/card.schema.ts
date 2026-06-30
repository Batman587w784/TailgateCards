import { z } from 'zod';

export const AssignCardDistributorSchema = z.object({
  cardId: z.string().uuid('Invalid card ID'),
  distributorId: z.string().uuid('Please select a distributor').nullable(),
});

export type AssignCardDistributorSchemaType = z.infer<
  typeof AssignCardDistributorSchema
>;

export const BulkAssignCardsDistributorSchema = z.object({
  cardIds: z.array(z.string().uuid()).min(1, 'At least one card is required'),
  distributorId: z.string().uuid('Please select a distributor').nullable(),
});

export type BulkAssignCardsDistributorSchemaType = z.infer<
  typeof BulkAssignCardsDistributorSchema
>;

export const BulkAssignCardsByCountSchema = z.object({
  distributorId: z.string().uuid('Please select a distributor'),
  count: z.number().int().positive('Amount must be at least 1'),
});

export type BulkAssignCardsByCountSchemaType = z.infer<
  typeof BulkAssignCardsByCountSchema
>;

export type CardStatus = 'pending' | 'activated' | 'expired' | 'cancelled';

export type CardFilters = {
  statuses: CardStatus[];
  distributorIds: string[];
  batchPrefixes: string[];
  dateFrom: string | null;
  dateTo: string | null;
};

export const defaultFilters: CardFilters = {
  statuses: [],
  distributorIds: [],
  batchPrefixes: [],
  dateFrom: null,
  dateTo: null,
};

export function parseFiltersFromParams(params: {
  statuses?: string;
  distributors?: string;
  batches?: string;
  dateFrom?: string;
  dateTo?: string;
}): CardFilters {
  const validStatuses: CardStatus[] = [
    'pending',
    'activated',
    'expired',
    'cancelled',
  ];

  const statusesParam = params.statuses?.split(',').filter(Boolean) ?? [];
  const statuses = statusesParam.filter((s): s is CardStatus =>
    validStatuses.includes(s as CardStatus),
  );

  return {
    statuses,
    distributorIds: params.distributors?.split(',').filter(Boolean) ?? [],
    batchPrefixes: params.batches?.split(',').filter(Boolean) ?? [],
    dateFrom: params.dateFrom ?? null,
    dateTo: params.dateTo ?? null,
  };
}

export function hasActiveFilters(filters: CardFilters): boolean {
  return (
    filters.statuses.length > 0 ||
    filters.distributorIds.length > 0 ||
    filters.batchPrefixes.length > 0 ||
    filters.dateFrom !== null ||
    filters.dateTo !== null
  );
}

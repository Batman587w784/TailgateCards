import { z } from 'zod';

export const ExportCardsSchema = z.object({
  query: z.string().max(200).optional(),
  status: z.array(z.enum(['active', 'expired', 'inactive'])).optional(),
  batch: z.array(z.string().uuid()).optional(),
  organization: z.array(z.string().uuid()).optional(),
  distributor: z.array(z.string().uuid()).optional(),
  dateCreated: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).optional(),
  cardType: z.array(z.enum(['physical', 'digital'])).optional(),
});

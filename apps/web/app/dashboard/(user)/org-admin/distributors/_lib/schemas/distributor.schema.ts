import { z } from 'zod';

export const InviteDistributorSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().optional(),
});

export type InviteDistributorSchemaType = z.infer<
  typeof InviteDistributorSchema
>;

export const ToggleDistributorStatusSchema = z.object({
  distributorId: z.string().uuid('Invalid distributor ID'),
  isActive: z.boolean(),
});

export type ToggleDistributorStatusSchemaType = z.infer<
  typeof ToggleDistributorStatusSchema
>;

export const DeleteDistributorSchema = z.object({
  distributorId: z.string().uuid('Invalid distributor ID'),
});

export type DeleteDistributorSchemaType = z.infer<
  typeof DeleteDistributorSchema
>;

import { z } from 'zod';

// Create discount schema - NO discount_value (percentage is now in the title)
export const CreateDiscountSchema = z.object({
  title: z.string().min(1, 'Discount name is required'),
  merchantId: z.string().uuid('Please select a merchant'),
  validFrom: z.date().optional(),
});

export type CreateDiscountSchemaType = z.infer<typeof CreateDiscountSchema>;

// Delete discount schema
export const DeleteDiscountSchema = z.object({
  discountId: z.string().uuid('Invalid discount ID'),
});

export type DeleteDiscountSchemaType = z.infer<typeof DeleteDiscountSchema>;

// Toggle discount status schema
export const ToggleDiscountStatusSchema = z.object({
  discountId: z.string().uuid('Invalid discount ID'),
  isActive: z.boolean(),
});

export type ToggleDiscountStatusSchemaType = z.infer<
  typeof ToggleDiscountStatusSchema
>;

// Update discount schema - NO discount_value
export const UpdateDiscountSchema = z.object({
  discountId: z.string().uuid('Invalid discount ID'),
  title: z.string().min(1, 'Discount name is required'),
  validFrom: z.date({ required_error: 'Start date is required' }),
  validUntil: z.date().optional().nullable(),
});

export type UpdateDiscountSchemaType = z.infer<typeof UpdateDiscountSchema>;

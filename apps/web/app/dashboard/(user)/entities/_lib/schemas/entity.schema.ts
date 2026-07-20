import { z } from 'zod';

// State validation schema (reusable - optional version for updates)
const StateSchemaOptional = z
  .string()
  .min(2, 'State name must be at least 2 characters')
  .max(100, 'State name must be at most 100 characters')
  .optional();

// City validation schema (reusable - optional version for updates)
const CitySchemaOptional = z
  .string()
  .min(2, 'City name must be at least 2 characters')
  .max(100, 'City name must be at most 100 characters')
  .optional();

// Organization schemas
export const CreateOrganizationSchema = z.object({
  organizationName: z.string().min(1, 'Organization name is required'),
  cardPrefix: z
    .string()
    .min(2, 'Card prefix must be at least 2 characters')
    .max(10, 'Card prefix must be at most 10 characters')
    .regex(
      /^[A-Z0-9]+$/,
      'Card prefix must be uppercase letters or numbers only',
    ),
  sharePerCardCents: z
    .number()
    .int('Share must be a whole number')
    .min(0, 'Share cannot be negative')
    .max(100000, 'Share cannot exceed $1000')
    .optional()
    .default(1250),
  primaryContactName: z.string().optional(),
  primaryContactEmail: z.string().email('Valid email is required'),
  primaryContactPhone: z.string().optional(),
  address: z.string().optional(),
  state: StateSchemaOptional,
  city: CitySchemaOptional,
  merchantPartnerIds: z.array(z.string().uuid()).optional(),
});

export type CreateOrganizationSchemaType = z.infer<
  typeof CreateOrganizationSchema
>;

export const UpdateOrganizationSchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
  organizationName: z
    .string()
    .min(1, 'Organization name is required')
    .optional(),
  sharePerCardCents: z
    .number()
    .int('Share must be a whole number')
    .min(0, 'Share cannot be negative')
    .max(100000, 'Share cannot exceed $1000')
    .optional(),
  primaryContactName: z.string().optional(),
  primaryContactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  state: StateSchemaOptional,
  city: CitySchemaOptional,
  isActive: z.boolean().optional(),
  cashPaymentsEnabled: z.boolean().optional(),
  merchantPartnerIds: z.array(z.string().uuid()).optional(),
});

export type UpdateOrganizationSchemaType = z.infer<
  typeof UpdateOrganizationSchema
>;

// District (Campus) schemas — M3 / P0-1
export const CreateCampusSchema = z.object({
  name: z.string().min(1, 'Campus name is required'),
  districtType: z.enum(['campus', 'generic']).default('campus'),
  state: StateSchemaOptional,
  city: CitySchemaOptional,
  isActive: z.boolean().optional().default(true),
});

export type CreateCampusSchemaType = z.infer<typeof CreateCampusSchema>;

export const UpdateCampusSchema = z.object({
  districtId: z.string().uuid('Invalid district ID'),
  name: z.string().min(1, 'Campus name is required').optional(),
  districtType: z.enum(['campus', 'generic']).optional(),
  state: StateSchemaOptional,
  city: CitySchemaOptional,
  isActive: z.boolean().optional(),
});

export type UpdateCampusSchemaType = z.infer<typeof UpdateCampusSchema>;

export const ToggleCampusStatusSchema = z.object({
  districtId: z.string().uuid('Invalid district ID'),
  isActive: z.boolean(),
});

export type ToggleCampusStatusSchemaType = z.infer<
  typeof ToggleCampusStatusSchema
>;

export const AssignChaptersSchema = z.object({
  districtId: z.string().uuid('Invalid district ID'),
  orgAccountIds: z.array(z.string().uuid()),
});

export type AssignChaptersSchemaType = z.infer<typeof AssignChaptersSchema>;

// District logo standardization — M3 / P0-3
export const UpdateDistrictLogoSchema = z.object({
  districtId: z.string().uuid('Invalid district ID'),
  logoUrl: z.string().url(),
});

export type UpdateDistrictLogoSchemaType = z.infer<
  typeof UpdateDistrictLogoSchema
>;

export const ToggleStandardizeLogosSchema = z.object({
  districtId: z.string().uuid('Invalid district ID'),
  standardize: z.boolean(),
});

export type ToggleStandardizeLogosSchemaType = z.infer<
  typeof ToggleStandardizeLogosSchema
>;

// Merchant schemas
export const CreateMerchantSchema = z.object({
  merchantName: z.string().min(1, 'Merchant name is required'),
  discountName: z.string().min(1, 'Discount name is required'),
  primaryContactName: z.string().optional(),
  primaryContactEmail: z.string().email('Valid email is required'),
  primaryContactPhone: z.string().optional(),
  address: z.string().optional(),
  state: StateSchemaOptional,
  city: CitySchemaOptional,
  website: z
    .string()
    .optional()
    .or(z.literal(''))
    .refine(
      (value) => {
        if (!value || value === '') return true;

        // Social handle: @username (alphanumeric + underscores, 1-30 chars)
        if (value.startsWith('@')) {
          return /^@[a-zA-Z0-9_]{1,30}$/.test(value);
        }

        // Full URL with protocol
        if (value.startsWith('http://') || value.startsWith('https://')) {
          try {
            const url = new URL(value);
            return (
              ['http:', 'https:'].includes(url.protocol) && value.length <= 2048
            );
          } catch {
            return false;
          }
        }

        // Domain only (e.g., example.com, sub.example.com/path)
        const domainRegex =
          /^([a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}(\/.*)?$/;
        return domainRegex.test(value) && value.length <= 253;
      },
      {
        message:
          'Please enter a valid URL (https://...), domain (example.com), or social handle (@username)',
      },
    ),
});

export type CreateMerchantSchemaType = z.infer<typeof CreateMerchantSchema>;

export const UpdateMerchantSchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
  businessName: z.string().min(1, 'Business name is required').optional(),
  primaryContactName: z.string().optional(),
  primaryContactEmail: z.string().email().optional().or(z.literal('')),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  state: StateSchemaOptional,
  city: CitySchemaOptional,
  isActive: z.boolean().optional(),
});

export type UpdateMerchantSchemaType = z.infer<typeof UpdateMerchantSchema>;

// Distributor schemas
export const CreateDistributorSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email is required'),
  phone: z.string().min(1, 'Phone number is required'),
  organizationId: z.string().uuid('Please select an organization'),
});

export type CreateDistributorSchemaType = z.infer<
  typeof CreateDistributorSchema
>;

export const UpdateDistributorSchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
  name: z.string().trim().min(1, 'Name is required').optional(),
  phone: z.string().optional(),
  isActive: z.boolean().optional(),
});

export type UpdateDistributorSchemaType = z.infer<
  typeof UpdateDistributorSchema
>;

// Toggle status schemas
export const ToggleStatusSchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
  isActive: z.boolean(),
});

export type ToggleStatusSchemaType = z.infer<typeof ToggleStatusSchema>;

export const ToggleCashPaymentsSchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
  enabled: z.boolean(),
});

export type ToggleCashPaymentsSchemaType = z.infer<
  typeof ToggleCashPaymentsSchema
>;

// Delete entity schema
export const DeleteEntitySchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
});

export type DeleteEntitySchemaType = z.infer<typeof DeleteEntitySchema>;

// Card schemas
export const CreateCardsSchema = z.object({
  organizationId: z.string().uuid('Please select an organization'),
  batchName: z
    .string()
    .min(1, 'Batch name is required')
    .max(100, 'Batch name must be at most 100 characters'),
  batchPrefix: z
    .string()
    .min(2, 'Batch prefix must be at least 2 characters')
    .max(10, 'Batch prefix must be at most 10 characters')
    .regex(
      /^[A-Z0-9]+$/,
      'Batch prefix must be uppercase letters or numbers only',
    ),
  quantity: z
    .number()
    .int('Quantity must be a whole number')
    .min(1, 'Quantity must be at least 1')
    .max(5000, 'Quantity must be at most 5000'),
});

export type CreateCardsSchemaType = z.infer<typeof CreateCardsSchema>;

export const SetCardPrefixSchema = z.object({
  organizationId: z.string().uuid('Invalid organization ID'),
  prefix: z
    .string()
    .min(2, 'Prefix must be at least 2 characters')
    .max(10, 'Prefix must be at most 10 characters')
    .regex(/^[A-Z0-9]+$/, 'Prefix must be uppercase letters or numbers only'),
});

export type SetCardPrefixSchemaType = z.infer<typeof SetCardPrefixSchema>;

// Delete cardholder schema
export const DeleteCardholderSchema = z.object({
  cardId: z.string().uuid('Invalid card ID'),
});

export type DeleteCardholderSchemaType = z.infer<typeof DeleteCardholderSchema>;

// Resend entity invite schema
export const ResendEntityInviteSchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
  entityType: z.enum(['organization', 'merchant', 'distributor']),
});

export type ResendEntityInviteSchemaType = z.infer<
  typeof ResendEntityInviteSchema
>;

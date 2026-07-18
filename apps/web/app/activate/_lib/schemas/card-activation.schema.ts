import { z } from 'zod';

/**
 * Postal code validation patterns by country
 */
const POSTAL_CODE_PATTERNS: Record<
  string,
  { pattern: RegExp; example: string }
> = {
  US: { pattern: /^\d{5}(-\d{4})?$/, example: '12345 or 12345-6789' },
  CA: { pattern: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/, example: 'K1A 0B1' },
  GB: {
    pattern: /^[A-Za-z]{1,2}\d[A-Za-z\d]?[ ]?\d[A-Za-z]{2}$/,
    example: 'SW1A 1AA',
  },
  AU: { pattern: /^\d{4}$/, example: '2000' },
  DE: { pattern: /^\d{5}$/, example: '10115' },
  FR: { pattern: /^\d{5}$/, example: '75001' },
  ES: { pattern: /^\d{5}$/, example: '28001' },
  IT: { pattern: /^\d{5}$/, example: '00100' },
  NL: { pattern: /^\d{4}[ ]?[A-Za-z]{2}$/, example: '1012 AB' },
  MX: { pattern: /^\d{5}$/, example: '06600' },
};

/**
 * Validates postal code against country-specific format
 */
function validatePostalCode(postalCode: string, countryCode: string): boolean {
  const countryPattern = POSTAL_CODE_PATTERNS[countryCode];
  if (!countryPattern) {
    return postalCode.trim().replace(/[\s-]/g, '').length >= 3;
  }
  return countryPattern.pattern.test(postalCode.trim());
}

/**
 * Gets validation error message for postal code
 */
function getPostalCodeErrorMessage(countryCode: string): string {
  const pattern = POSTAL_CODE_PATTERNS[countryCode];
  return pattern
    ? `Invalid format. Example: ${pattern.example}`
    : 'Please enter a valid postal code';
}

/**
 * Step 1: Card Verification Schema
 * Validates card code format: ORG-BATCH-NUMBER (e.g., "ACME-SPR25-1")
 */
export const VerifyCardSchema = z.object({
  cardCode: z
    .string()
    .min(1, 'Card code is required')
    .regex(
      /^[A-Z0-9]{2,10}-[A-Z0-9]{2,10}-\d+$/i,
      'Invalid card code format. Expected format: ORG-BATCH-NUMBER (e.g., ACME-SPR25-1)',
    ),
});

export type VerifyCardFormData = z.infer<typeof VerifyCardSchema>;

/**
 * Step 2: Card Activation Schema (MVP - without payment)
 * Collects email and location for card activation
 */
export const ActivateCardMvpSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  country: z.string().min(1, 'Country is required'),
  region: z.string().min(1, 'State/Region is required'),
});

export type ActivateCardMvpFormData = z.infer<typeof ActivateCardMvpSchema>;

/**
 * Cardholder name: single field, full name as printed on the card.
 */
const CardholderNameSchema = z
  .string()
  .trim()
  .min(2, 'Please enter the full name on the card')
  .max(80, 'Cardholder name must be less than 80 characters')
  .regex(
    /^[\p{L}][\p{L}\s'-]*[\p{L}.]$/u,
    'Use letters, spaces, hyphens, or apostrophes',
  );

/**
 * Step 2: Card Activation Schema (with Stripe payment)
 * Single-step form: collects everything needed to activate the card and create
 * the cardholder account in one shot. Identity/profile (split first/last name,
 * phone, password) is deferred to the dashboard.
 */
export const ActivateCardSchema = z
  .object({
    email: z.string().email('Please enter a valid email address'),
    country: z.string().min(1, 'Country is required'),
    postalCode: z.string().min(1, 'ZIP/Postal code is required'),
    cardholderName: CardholderNameSchema,
    termsAccepted: z.boolean(),
    marketingOptIn: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (!validatePostalCode(data.postalCode, data.country)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: getPostalCodeErrorMessage(data.country),
        path: ['postalCode'],
      });
    }
    if (!data.termsAccepted) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'You must agree to the terms',
        path: ['termsAccepted'],
      });
    }
  });

export type ActivateCardFormData = z.infer<typeof ActivateCardSchema>;

/**
 * Schema for creating PaymentIntent
 * Email is collected by Stripe PaymentElement, not upfront
 */
export const CreatePaymentIntentSchema = z.object({
  cardCode: z.string().min(1),
});

export type CreatePaymentIntentData = z.infer<typeof CreatePaymentIntentSchema>;

/**
 * Schema for confirming payment and activating card
 * Email is provided from the client form (inline with payment)
 */
export const ConfirmPaymentSchema = z
  .object({
    cardCode: z.string().min(1),
    paymentIntentId: z.string().min(1),
    email: z.string().email(),
    country: z.string().min(1),
    postalCode: z.string().min(1),
    cardholderName: CardholderNameSchema,
    termsAccepted: z.boolean(),
    marketingOptIn: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (!validatePostalCode(data.postalCode, data.country)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: getPostalCodeErrorMessage(data.country),
        path: ['postalCode'],
      });
    }
  });

export type ConfirmPaymentData = z.infer<typeof ConfirmPaymentSchema>;

/**
 * Discriminates between a distributor sales link (`/activate/d/{slug}`) and
 * an org-direct sales link (`/activate/o/{slug}`). Defaults to `distributor`
 * so existing callers don't need to change.
 */
const LinkTypeSchema = z
  .enum(['distributor', 'organization'])
  .default('distributor');

export type DigitalLinkType = z.infer<typeof LinkTypeSchema>;

/**
 * Upper bound on how many cards a buyer can purchase in a single checkout.
 * Shared by the quantity picker, the PaymentIntent action, and the schema.
 */
export const MAX_CARD_QUANTITY = 25;

/**
 * Schema for creating a digital-card PaymentIntent from a distributor or
 * organization sales-link slug.
 */
export const CreateDigitalCardPaymentIntentSchema = z.object({
  slug: z.string().min(1),
  linkType: LinkTypeSchema,
  quantity: z.coerce
    .number()
    .int()
    .min(1)
    .max(MAX_CARD_QUANTITY)
    .default(1),
});

export type CreateDigitalCardPaymentIntentData = z.infer<
  typeof CreateDigitalCardPaymentIntentSchema
>;

/**
 * Schema for confirming a digital-card payment and activating it inline.
 */
export const ConfirmDigitalPaymentSchema = z
  .object({
    slug: z.string().min(1),
    linkType: LinkTypeSchema,
    paymentIntentId: z.string().min(1),
    email: z.string().email(),
    country: z.string().min(1),
    postalCode: z.string().min(1),
    cardholderName: CardholderNameSchema,
    termsAccepted: z.boolean(),
    marketingOptIn: z.boolean(),
  })
  .superRefine((data, ctx) => {
    if (!validatePostalCode(data.postalCode, data.country)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: getPostalCodeErrorMessage(data.country),
        path: ['postalCode'],
      });
    }
  });

export type ConfirmDigitalPaymentData = z.infer<
  typeof ConfirmDigitalPaymentSchema
>;

/**
 * Extended schema for MVP server action (includes cardCode)
 */
export const ActivateCardActionSchema = ActivateCardMvpSchema.extend({
  cardCode: z.string().min(1),
});

export type ActivateCardActionData = z.infer<typeof ActivateCardActionSchema>;

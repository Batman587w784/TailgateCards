import { z } from 'zod';

/**
 * M1 / T6 — self-signup contact step. Phone is required (it's the OTP identity);
 * email is optional. Phone is normalized to E.164 before being sent to
 * signInWithOtp.
 */
export const JoinContactSchema = z.object({
  phone: z
    .string()
    .min(8, 'Enter a valid phone number (include country code, e.g. +1…)'),
  email: z
    .string()
    .email('Enter a valid email')
    .optional()
    .or(z.literal('')),
});

export type JoinContactFormData = z.infer<typeof JoinContactSchema>;

/** Normalize a user-entered phone to E.164 (`+` followed by digits). */
export function normalizePhoneE164(input: string): string {
  const digits = input.replace(/\D/g, '');
  return digits.length > 0 ? `+${digits}` : '';
}

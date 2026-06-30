import { z } from 'zod';

export const PasscodeSchema = z
  .string()
  .length(4, 'Passcode must be 4 characters')
  .regex(/^[A-Z0-9]+$/i, 'Passcode must contain only letters and numbers')
  .transform((val) => val.toUpperCase());

export const VerifyPasscodeSchema = z.object({
  passcode: PasscodeSchema,
});

export const RefreshPasscodeSchema = z.object({
  accountId: z.string().uuid('Invalid account ID'),
});

export type VerifyPasscodeInput = z.infer<typeof VerifyPasscodeSchema>;
export type RefreshPasscodeInput = z.infer<typeof RefreshPasscodeSchema>;

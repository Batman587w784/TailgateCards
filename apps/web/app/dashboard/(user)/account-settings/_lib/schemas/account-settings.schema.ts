import { z } from 'zod';

export const DeleteAccountSchema = z.object({
  confirmation: z.literal('DELETE', {
    errorMap: () => ({ message: 'Please type DELETE to confirm' }),
  }),
});

export type DeleteAccountFormData = z.infer<typeof DeleteAccountSchema>;

export const BasicInfoSchema = z.object({
  firstName: z
    .string()
    .min(2, 'First name must be at least 2 characters')
    .max(100),
  lastName: z
    .string()
    .min(2, 'Last name must be at least 2 characters')
    .max(100),
});

export const PhoneSchema = z.object({
  phone: z.string().optional(),
});

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(99),
    confirmPassword: z.string().min(8).max(99),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export type BasicInfoFormData = z.infer<typeof BasicInfoSchema>;
export type PhoneFormData = z.infer<typeof PhoneSchema>;
export type ChangePasswordFormData = z.infer<typeof ChangePasswordSchema>;

import { z } from 'zod';

export const ContactFormSchema = z.object({
  role: z.enum(['organization', 'merchant', 'other'], {
    required_error: 'Please select a role',
  }),
  fullName: z.string().min(1, 'Full name is required').max(200),
  email: z.string().email('Please enter a valid email'),
  phone: z.string().optional(),
  companyName: z.string().max(200).optional(),
  message: z.string().max(5000).optional(),
});

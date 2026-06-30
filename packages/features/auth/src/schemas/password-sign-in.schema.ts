import { z } from 'zod';

import { PasswordSchema } from './password.schema';

export const PasswordSignInSchema = z.object({
  email: z
    .string()
    .min(1, { message: 'auth:errors.emailRequired' })
    .email({ message: 'auth:errors.invalidEmail' }),
  password: z
    .string()
    .min(1, { message: 'auth:errors.passwordRequired' })
    .pipe(PasswordSchema),
});

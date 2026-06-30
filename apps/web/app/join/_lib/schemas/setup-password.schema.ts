import { z } from 'zod';

import {
  RefinedPasswordSchema,
  refineRepeatPassword,
} from '@kit/auth/schemas/password';

export const SetupPasswordSchema = z
  .object({
    password: RefinedPasswordSchema,
    repeatPassword: RefinedPasswordSchema,
  })
  .superRefine(refineRepeatPassword);

export type SetupPasswordFormData = z.infer<typeof SetupPasswordSchema>;

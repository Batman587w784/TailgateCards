import { z } from 'zod';

export const GetGoogleWalletSaveUrlSchema = z.object({
  cardCode: z.string().min(1),
});

export type GetGoogleWalletSaveUrlInput = z.infer<
  typeof GetGoogleWalletSaveUrlSchema
>;

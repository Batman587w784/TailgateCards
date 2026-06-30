'use server';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

const UpdateMerchantPictureSchema = z.object({
  accountId: z.string().uuid(),
  pictureUrl: z.string().url(),
});

export const updateMerchantPictureAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerAdminClient();
    const logger = await getLogger();

    logger.info(
      { accountId: data.accountId, pictureUrl: data.pictureUrl },
      'Updating merchant picture...',
    );

    const { error } = await client
      .from('accounts')
      .update({ picture_url: data.pictureUrl })
      .eq('id', data.accountId);

    if (error) {
      logger.error(
        { error: error.message, code: error.code, details: error.details },
        'Failed to update merchant picture',
      );
      throw new Error(`Failed to update merchant picture: ${error.message}`);
    }

    logger.info(
      { accountId: data.accountId, pictureUrl: data.pictureUrl },
      'Successfully updated merchant picture',
    );

    return {
      success: true,
    };
  },
  {
    schema: UpdateMerchantPictureSchema,
  },
);

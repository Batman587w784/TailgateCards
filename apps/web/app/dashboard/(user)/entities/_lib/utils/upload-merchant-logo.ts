import type { SupabaseClient } from '@supabase/supabase-js';

import { updateMerchantPictureAction } from '../server/update-merchant-picture-server-action';

const AVATARS_BUCKET = 'account_image';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

export async function uploadMerchantLogo(
  client: SupabaseClient,
  file: File,
  accountId: string,
) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File size must be less than 5MB');
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(
      'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed',
    );
  }

  const bytes = await file.arrayBuffer();
  const bucket = client.storage.from(AVATARS_BUCKET);
  const cacheBuster = crypto.randomUUID().slice(0, 16);

  const result = await bucket.upload(accountId, bytes, {
    contentType: file.type,
    upsert: true,
  });

  if (result.error) throw result.error;

  const publicUrl = bucket.getPublicUrl(accountId).data.publicUrl;
  const pictureUrl = `${publicUrl}?v=${cacheBuster}`;

  // Update database via server action (required for RLS permissions)
  const updateResult = await updateMerchantPictureAction({
    accountId,
    pictureUrl,
  });

  if (!updateResult.success) {
    throw new Error('Failed to update merchant picture in database');
  }

  return pictureUrl;
}

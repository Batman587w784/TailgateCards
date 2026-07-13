import type { SupabaseClient } from '@supabase/supabase-js';

import { updateDistrictLogoAction } from '../server/districts-server-actions';

const AVATARS_BUCKET = 'account_image';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

/**
 * Uploads a district logo to the account_image bucket keyed by the district id
 * (super-admin is permitted by the bucket policy) and stores the public URL on
 * districts.logo_url. Mirrors uploadMerchantLogo.
 */
export async function uploadDistrictLogo(
  client: SupabaseClient,
  file: File,
  districtId: string,
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
  // Use the bare district id (a UUID, distinct from any account id) so the
  // account_image bucket policy's filename->uuid parse succeeds.
  const path = districtId;

  const result = await bucket.upload(path, bytes, {
    contentType: file.type,
    upsert: true,
  });

  if (result.error) throw result.error;

  const publicUrl = bucket.getPublicUrl(path).data.publicUrl;
  const logoUrl = `${publicUrl}?v=${cacheBuster}`;

  const updateResult = await updateDistrictLogoAction({ districtId, logoUrl });

  if (!updateResult.success) {
    throw new Error('Failed to update district logo in database');
  }

  return logoUrl;
}

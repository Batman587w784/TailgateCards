import type { SupabaseClient } from '@supabase/supabase-js';

import {
  updateDistrictLogoSelfAction,
  updateOrganizationLogoAction,
} from './server/logo-server-actions';

const AVATARS_BUCKET = 'account_image';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

function validate(file: File) {
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File size must be less than 5MB');
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    throw new Error(
      'Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed',
    );
  }
}

/**
 * Uploads to the account_image bucket keyed by the entity id (org account id or
 * district id) — same path scheme the super-admin tools use, so
 * get_effective_org_logo and the district standardize-logos flag keep working.
 */
async function uploadToBucket(
  client: SupabaseClient,
  file: File,
  id: string,
): Promise<string> {
  validate(file);

  const bytes = await file.arrayBuffer();
  const bucket = client.storage.from(AVATARS_BUCKET);
  const cacheBuster = crypto.randomUUID().slice(0, 16);

  const result = await bucket.upload(id, bytes, {
    contentType: file.type,
    upsert: true,
  });

  if (result.error) throw result.error;

  const publicUrl = bucket.getPublicUrl(id).data.publicUrl;
  return `${publicUrl}?v=${cacheBuster}`;
}

export async function uploadOrganizationLogo(
  client: SupabaseClient,
  file: File,
  orgAccountId: string,
): Promise<string> {
  const logoUrl = await uploadToBucket(client, file, orgAccountId);
  const res = await updateOrganizationLogoAction({ logoUrl });

  if (!res.success) {
    throw new Error('Failed to save the organization logo');
  }

  return logoUrl;
}

export async function uploadDistrictLogoSelf(
  client: SupabaseClient,
  file: File,
  districtId: string,
): Promise<string> {
  const logoUrl = await uploadToBucket(client, file, districtId);
  const res = await updateDistrictLogoSelfAction({ logoUrl });

  if (!res.success) {
    throw new Error('Failed to save the district logo');
  }

  return logoUrl;
}

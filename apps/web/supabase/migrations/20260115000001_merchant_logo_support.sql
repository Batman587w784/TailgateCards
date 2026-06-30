-- Enable merchant logo upload and display for cardholders
-- This migration adds RLS policies to:
-- 1. Allow public read access to merchant account pictures
-- 2. Allow super admins to upload merchant logos

-- Add RLS policy to allow public read access to merchant account pictures
-- This allows cardholders to see merchant logos when viewing discounts
create policy accounts_merchant_public_picture_read
  on public.accounts
  for select
  using (
    -- Allow reading picture_url for accounts that are merchants
    -- (have a merchant_profile entry)
    exists (
      select 1
      from public.merchant_profiles mp
      where mp.account_id = accounts.id
    )
  );

-- Drop the existing storage policy and recreate with super admin support
-- This allows super admins to upload merchant logos when creating merchants
drop policy if exists account_image on storage.objects;

create policy account_image on storage.objects for all using (
  bucket_id = 'account_image'
  and (
    kit.get_storage_filename_as_uuid(name) = auth.uid()
    or public.has_role_on_account(kit.get_storage_filename_as_uuid(name))
    or public.is_super_admin()
  )
)
with check (
  bucket_id = 'account_image'
  and (
    kit.get_storage_filename_as_uuid(name) = auth.uid()
    or public.has_permission(
      auth.uid(),
      kit.get_storage_filename_as_uuid(name),
      'settings.manage'
    )
    or public.is_super_admin()
  )
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Let a district admin upload their OWN district's logo to the account_image
-- bucket (path = district id). District ids aren't accounts, so the existing
-- has_permission(...'settings.manage') clause never matches for them — only
-- super-admin could. Add an is_district_admin_of clause so district admins can
-- self-manage their district logo. Additive: for org/personal paths the id is
-- not a district, so is_district_admin_of returns false and nothing changes.
-- ─────────────────────────────────────────────────────────────────────────────

drop policy if exists account_image on storage.objects;

create policy account_image on storage.objects for all using (
  bucket_id = 'account_image'
  and (
    kit.get_storage_filename_as_uuid(name) = auth.uid()
    or public.has_role_on_account(kit.get_storage_filename_as_uuid(name))
    or public.is_district_admin_of(kit.get_storage_filename_as_uuid(name))
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
    or public.is_district_admin_of(kit.get_storage_filename_as_uuid(name))
    or public.is_super_admin()
  )
);

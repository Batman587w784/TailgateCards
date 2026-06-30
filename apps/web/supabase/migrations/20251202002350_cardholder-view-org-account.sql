/*
 * -------------------------------------------------------
 * Migration: Allow Cardholders to View Organization Accounts
 *
 * Cardholders need to see basic info about organizations
 * that issued their cards. Without this, the card details
 * cannot display the organization name.
 *
 * Note: We use auth.uid() directly instead of get_user_personal_account_id()
 * to avoid circular RLS evaluation (accounts -> cards -> accounts).
 * For personal accounts, account.id = user.id, so this works correctly.
 * -------------------------------------------------------
 */

-- Allow cardholders to view accounts for organizations their cards belong to
create policy accounts_cardholder_view_org
  on public.accounts
  for select
  to authenticated
  using (
    -- User has a card from this organization
    -- Using auth.uid() directly to avoid circular RLS
    -- (personal account id = user id)
    exists (
      select 1 from public.cards c
      where c.cardholder_id = auth.uid()
        and c.organization_id = accounts.id
    )
  );

comment on policy accounts_cardholder_view_org on public.accounts is
  'Cardholders can view organization accounts that issued their cards';

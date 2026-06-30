-- Enqueue helpers ---------------------------------------------------------

create or replace function public.enqueue_wallet_sync_card(p_card_id uuid, p_reason text)
returns void language sql security definer set search_path = '' as $$
  insert into public.wallet_sync_queue (scope, card_id, reason)
  values ('card', p_card_id, p_reason)
  on conflict do nothing;
$$;

create or replace function public.enqueue_wallet_sync_org(p_org_id uuid, p_reason text)
returns void language sql security definer set search_path = '' as $$
  insert into public.wallet_sync_queue (scope, organization_id, reason)
  values ('organization', p_org_id, p_reason)
  on conflict do nothing;
$$;

-- cards: expiry + status changes -----------------------------------------

create or replace function public.tg_cards_wallet_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.expires_at is distinct from old.expires_at then
    perform public.enqueue_wallet_sync_card(new.id, 'expiry');
  end if;
  if new.status is distinct from old.status
     and new.status in ('cancelled', 'expired') then
    perform public.enqueue_wallet_sync_card(new.id, 'status');
  end if;
  return new;
end;
$$;

create trigger cards_wallet_sync
after update on public.cards
for each row execute function public.tg_cards_wallet_sync();

-- discounts: fan out to every partnered org ------------------------------

create or replace function public.tg_discounts_wallet_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  v_merchant_id uuid := coalesce(new.merchant_id, old.merchant_id);
begin
  perform public.enqueue_wallet_sync_org(p.organization_id, 'discounts')
  from public.organization_merchant_partnerships p
  where p.merchant_id = v_merchant_id;
  return coalesce(new, old);
end;
$$;

create trigger discounts_wallet_sync
after insert or update or delete on public.discounts
for each row execute function public.tg_discounts_wallet_sync();

-- partnerships: org discount set changed ---------------------------------

create or replace function public.tg_partnerships_wallet_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform public.enqueue_wallet_sync_org(
    coalesce(new.organization_id, old.organization_id), 'discounts');
  return coalesce(new, old);
end;
$$;

create trigger partnerships_wallet_sync
after insert or delete on public.organization_merchant_partnerships
for each row execute function public.tg_partnerships_wallet_sync();

-- organization_profiles: name change ------------------------------------

create or replace function public.tg_org_profiles_wallet_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.organization_name is distinct from old.organization_name then
    perform public.enqueue_wallet_sync_org(new.account_id, 'org_profile');
  end if;
  return new;
end;
$$;

create trigger org_profiles_wallet_sync
after update on public.organization_profiles
for each row execute function public.tg_org_profiles_wallet_sync();

-- batches: name change ---------------------------------------------------

create or replace function public.tg_batches_wallet_sync()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.name is distinct from old.name then
    perform public.enqueue_wallet_sync_org(new.organization_id, 'org_profile');
  end if;
  return new;
end;
$$;

create trigger batches_wallet_sync
after update on public.batches
for each row execute function public.tg_batches_wallet_sync();

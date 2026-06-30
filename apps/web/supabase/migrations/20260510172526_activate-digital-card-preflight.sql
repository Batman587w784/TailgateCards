-- M6 audit item #6: surface a clear error when a buyer tries to claim a
-- second digital card, rather than leaking the raw 23505 from
-- ix_cards_cardholder_unique on UPDATE.
--
-- Adds a defense-in-depth pre-check inside activate_digital_card so any
-- caller routing through this RPC sees a friendly message before the
-- unique index fires.

create or replace function public.activate_digital_card(
  p_claim_token text,
  p_validity_days integer default 365
)
returns public.cards
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card public.cards;
  v_user_account_id uuid;
begin
  v_user_account_id := public.get_user_personal_account_id();

  if v_user_account_id is null then
    raise exception 'User must be authenticated';
  end if;

  if p_claim_token is null or length(p_claim_token) = 0 then
    raise exception 'claim_token is required';
  end if;

  if exists (
    select 1
      from public.cards
     where cardholder_id = v_user_account_id
  ) then
    raise exception 'You already have an active card';
  end if;

  select * into v_card
    from public.cards
   where claim_token = p_claim_token
     and card_type = 'digital'
   for update;

  if v_card is null then
    raise exception 'Card not found';
  end if;

  if v_card.cardholder_id is not null then
    raise exception 'Card is already assigned';
  end if;

  if v_card.status not in ('pending', 'paid') then
    raise exception 'Card cannot be activated (status: %)', v_card.status;
  end if;

  update public.cards
     set cardholder_id = v_user_account_id,
         status        = 'activated',
         activated_at  = now(),
         expires_at    = now() + (p_validity_days || ' days')::interval
   where id = v_card.id
   returning * into v_card;

  return v_card;
end;
$$;

comment on function public.activate_digital_card(text, integer) is 'Claims a digital card by its claim_token for the current authenticated user. Pre-checks that the caller does not already own a card to avoid surfacing 23505 from ix_cards_cardholder_unique.';

grant execute on function public.activate_digital_card(text, integer) to authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- Buy-page district naming preset — so the goal-bar label is routed through the
-- naming layer (Campus/Chapter vs District/Organization) instead of hardcoded.
-- Adds district_naming_preset to both buy-page RPCs. Signatures change →
-- drop+create (bodies otherwise identical to 20260719120000).
-- ─────────────────────────────────────────────────────────────────────────────

drop function if exists public.get_distributor_buy_page(text);

create function public.get_distributor_buy_page(p_slug text)
returns table (
  distributor_id uuid,
  distributor_name text,
  organization_id uuid,
  organization_name text,
  organization_picture_url text,
  organization_city text,
  organization_state text,
  district_id uuid,
  district_name text,
  district_type text,
  district_naming_preset text,
  district_picture_url text,
  district_city text,
  district_state text,
  price_cents integer
)
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_user_id uuid;
  v_org_id uuid;
begin
  if p_slug is null or length(p_slug) = 0 then
    return;
  end if;

  select am.user_id, am.account_id
    into v_user_id, v_org_id
    from public.accounts_memberships am
   where am.share_slug = p_slug
     and am.account_role = 'distributor'
   limit 1;

  if v_user_id is null then
    return;
  end if;

  return query
    select
      d.id                                              as distributor_id,
      d.name::text                                      as distributor_name,
      org.id                                            as organization_id,
      coalesce(op.organization_name, org.name)::text    as organization_name,
      public.get_effective_org_logo(org.id)             as organization_picture_url,
      op.city::text                                     as organization_city,
      op.state::text                                    as organization_state,
      dist.id                                           as district_id,
      dist.name::text                                   as district_name,
      dist.district_type::text                          as district_type,
      dist.naming_preset::text                          as district_naming_preset,
      dist.logo_url                                     as district_picture_url,
      dist.city::text                                   as district_city,
      dist.state::text                                  as district_state,
      coalesce(op.card_price_cents, 2500)::integer      as price_cents
    from public.accounts d
    join public.accounts org on org.id = v_org_id
    left join public.organization_profiles op on op.account_id = org.id
    left join public.districts dist on dist.id = op.district_id
   where d.primary_owner_user_id = v_user_id
     and d.is_personal_account = true
   limit 1;
end;
$function$;

grant execute on function public.get_distributor_buy_page(text) to anon, authenticated;

drop function if exists public.get_organization_buy_page(text);

create function public.get_organization_buy_page(p_slug text)
returns table (
  organization_id uuid,
  organization_name text,
  organization_picture_url text,
  organization_city text,
  organization_state text,
  district_id uuid,
  district_name text,
  district_type text,
  district_naming_preset text,
  district_picture_url text,
  district_city text,
  district_state text,
  price_cents integer
)
language plpgsql
security definer
set search_path to ''
as $function$
begin
  if p_slug is null or length(p_slug) = 0 then
    return;
  end if;

  return query
    select
      org.id                                            as organization_id,
      coalesce(op.organization_name, org.name)::text    as organization_name,
      public.get_effective_org_logo(org.id)             as organization_picture_url,
      op.city::text                                     as organization_city,
      op.state::text                                    as organization_state,
      dist.id                                           as district_id,
      dist.name::text                                   as district_name,
      dist.district_type::text                          as district_type,
      dist.naming_preset::text                          as district_naming_preset,
      dist.logo_url                                     as district_picture_url,
      dist.city::text                                   as district_city,
      dist.state::text                                  as district_state,
      coalesce(op.card_price_cents, 2500)::integer      as price_cents
    from public.accounts org
    left join public.organization_profiles op on op.account_id = org.id
    left join public.districts dist on dist.id = op.district_id
   where org.slug = p_slug
     and org.is_personal_account = false
   limit 1;
end;
$function$;

grant execute on function public.get_organization_buy_page(text) to anon, authenticated;

/*
 * -------------------------------------------------------
 * Migration: Dashboard Activities Infrastructure
 *
 * This migration adds:
 * - activities table for tracking platform events
 * - activity_type enum for categorizing activities
 * - Triggers for automatic activity creation
 * - RLS policies for role-based access
 * - RPC functions for dashboard analytics
 * -------------------------------------------------------
 */

-- ============================================================
-- SECTION 1: Activity Type Enum
-- ============================================================

create type public.activity_type as enum (
  'organization_onboarded',
  'organization_deactivated',
  'merchant_added',
  'discount_created',
  'discount_updated',
  'payment_failed',
  'card_sold',
  'card_activated',
  'distributor_added',
  'distributor_deactivated',
  'batch_assigned',
  'sale_completed',
  'redemption_completed'
);

comment on type public.activity_type is 'Types of activities tracked in the platform';

-- ============================================================
-- SECTION 2: Activities Table
-- ============================================================

create table if not exists public.activities (
  id uuid unique not null default extensions.uuid_generate_v4(),

  -- Activity details
  type public.activity_type not null,
  message text not null,

  -- Context
  actor_id uuid references public.accounts(id) on delete set null,
  organization_id uuid references public.accounts(id) on delete set null,

  -- Entity reference
  entity_type text,
  entity_id uuid,

  -- Additional data
  metadata jsonb default '{}',

  -- Timestamp
  created_at timestamptz not null default now(),

  primary key (id)
);

comment on table public.activities is 'Activity log for platform events and dashboard feeds';
comment on column public.activities.actor_id is 'Account that performed the action (can be null for system actions)';
comment on column public.activities.organization_id is 'Organization context for filtering (null for platform-wide events)';
comment on column public.activities.entity_type is 'Type of entity this activity relates to (card, discount, etc.)';
comment on column public.activities.entity_id is 'ID of the entity this activity relates to';

-- Enable RLS
alter table public.activities enable row level security;

-- Revoke all and grant specific permissions
revoke all on public.activities from authenticated, service_role;
grant select, insert on table public.activities to authenticated, service_role;

-- Indexes for efficient querying
create index if not exists ix_activities_created_at on public.activities (created_at desc);
create index if not exists ix_activities_organization_id on public.activities (organization_id, created_at desc) where organization_id is not null;
create index if not exists ix_activities_actor_id on public.activities (actor_id, created_at desc) where actor_id is not null;
create index if not exists ix_activities_type on public.activities (type, created_at desc);

-- ============================================================
-- SECTION 3: RLS Policies for Activities
-- ============================================================

-- Super admins can view all activities
create policy super_admins_access_activities
  on public.activities
  as permissive
  for select
  to authenticated
  using (public.is_super_admin());

-- Organization members can view activities for their organization
create policy activities_organization_read
  on public.activities
  for select
  to authenticated
  using (
    organization_id is not null and
    public.has_role_on_account(organization_id)
  );

-- Users can view activities where they are the actor
create policy activities_actor_read
  on public.activities
  for select
  to authenticated
  using (
    actor_id = public.get_user_personal_account_id()
  );

-- Service role can insert activities (for triggers)
create policy activities_service_insert
  on public.activities
  for insert
  to service_role
  with check (true);

-- Authenticated users can insert activities (for manual logging)
create policy activities_authenticated_insert
  on public.activities
  for insert
  to authenticated
  with check (true);

-- ============================================================
-- SECTION 4: Activity Logging Functions
-- ============================================================

-- Helper function to log an activity
create or replace function public.log_activity(
  p_type public.activity_type,
  p_message text,
  p_actor_id uuid default null,
  p_organization_id uuid default null,
  p_entity_type text default null,
  p_entity_id uuid default null,
  p_metadata jsonb default '{}'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_activity_id uuid;
begin
  insert into public.activities (
    type,
    message,
    actor_id,
    organization_id,
    entity_type,
    entity_id,
    metadata
  ) values (
    p_type,
    p_message,
    p_actor_id,
    p_organization_id,
    p_entity_type,
    p_entity_id,
    p_metadata
  )
  returning id into v_activity_id;

  return v_activity_id;
end;
$$;

comment on function public.log_activity is 'Logs a platform activity for dashboard feeds';
grant execute on function public.log_activity to authenticated, service_role;

-- ============================================================
-- SECTION 5: Triggers for Automatic Activity Logging
-- ============================================================

-- Trigger function for card status changes
create or replace function public.trigger_log_card_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_name text;
  v_actor_name text;
begin
  -- Get organization name
  select name into v_org_name
  from public.accounts
  where id = new.organization_id;

  -- Get actor name (distributor or org)
  if new.distributor_id is not null then
    select name into v_actor_name
    from public.accounts
    where id = new.distributor_id;
  end if;

  -- Card sold (status changed to paid)
  if tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'paid' then
    perform public.log_activity(
      'card_sold'::public.activity_type,
      coalesce(v_actor_name, v_org_name) || ' sold card ' || new.card_code || ' - ' || new.payment_type,
      new.distributor_id,
      new.organization_id,
      'card',
      new.id,
      jsonb_build_object('card_code', new.card_code, 'payment_type', new.payment_type, 'price_cents', new.price_cents)
    );
  end if;

  -- Card activated
  if tg_op = 'UPDATE' and old.status != 'activated' and new.status = 'activated' then
    perform public.log_activity(
      'card_activated'::public.activity_type,
      'Card ' || new.card_code || ' activated successfully',
      new.cardholder_id,
      new.organization_id,
      'card',
      new.id,
      jsonb_build_object('card_code', new.card_code, 'cardholder_id', new.cardholder_id)
    );
  end if;

  return new;
end;
$$;

-- Attach trigger to cards table
drop trigger if exists cards_log_activity on public.cards;
create trigger cards_log_activity
after update on public.cards
for each row execute function public.trigger_log_card_activity();

-- Trigger function for redemption events
create or replace function public.trigger_log_redemption_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_discount_title text;
  v_merchant_name text;
  v_card_org_id uuid;
begin
  -- Get discount title
  select title into v_discount_title
  from public.discounts
  where id = new.discount_id;

  -- Get merchant name
  select a.name into v_merchant_name
  from public.accounts a
  where a.id = new.merchant_id;

  -- Get organization from card
  select organization_id into v_card_org_id
  from public.cards
  where id = new.card_id;

  -- Log redemption completed
  if tg_op = 'INSERT' and new.status = 'completed' then
    perform public.log_activity(
      'redemption_completed'::public.activity_type,
      'Discount "' || v_discount_title || '" redeemed at ' || v_merchant_name,
      null,
      new.merchant_id,
      'redemption',
      new.id,
      jsonb_build_object('discount_id', new.discount_id, 'card_id', new.card_id)
    );
  end if;

  return new;
end;
$$;

-- Attach trigger to redemptions table
drop trigger if exists redemptions_log_activity on public.redemptions;
create trigger redemptions_log_activity
after insert on public.redemptions
for each row execute function public.trigger_log_redemption_activity();

-- Trigger function for organization profile events
create or replace function public.trigger_log_organization_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org_name text;
begin
  -- Get organization name from account
  select name into v_org_name
  from public.accounts
  where id = new.account_id;

  -- Organization created
  if tg_op = 'INSERT' then
    perform public.log_activity(
      'organization_onboarded'::public.activity_type,
      'New organization onboarded: ' || coalesce(new.organization_name, v_org_name),
      null,
      new.account_id,
      'organization',
      new.account_id,
      jsonb_build_object('organization_type', new.organization_type)
    );
  end if;

  return new;
end;
$$;

-- Attach trigger to organization_profiles table
drop trigger if exists organization_profiles_log_activity on public.organization_profiles;
create trigger organization_profiles_log_activity
after insert on public.organization_profiles
for each row execute function public.trigger_log_organization_activity();

-- Trigger function for merchant profile events
create or replace function public.trigger_log_merchant_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant_name text;
begin
  -- Get merchant name from account
  select name into v_merchant_name
  from public.accounts
  where id = new.account_id;

  -- Merchant created
  if tg_op = 'INSERT' then
    perform public.log_activity(
      'merchant_added'::public.activity_type,
      'New merchant added: ' || coalesce(new.business_name, v_merchant_name),
      null,
      null,
      'merchant',
      new.account_id,
      jsonb_build_object('business_type', new.business_type)
    );
  end if;

  return new;
end;
$$;

-- Attach trigger to merchant_profiles table
drop trigger if exists merchant_profiles_log_activity on public.merchant_profiles;
create trigger merchant_profiles_log_activity
after insert on public.merchant_profiles
for each row execute function public.trigger_log_merchant_activity();

-- Trigger function for discount events
create or replace function public.trigger_log_discount_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_merchant_name text;
begin
  -- Get merchant name
  select a.name into v_merchant_name
  from public.accounts a
  where a.id = new.merchant_id;

  -- Discount created
  if tg_op = 'INSERT' then
    perform public.log_activity(
      'discount_created'::public.activity_type,
      'Discount campaign created: "' || new.title || '" - ' || v_merchant_name,
      null,
      new.merchant_id,
      'discount',
      new.id,
      jsonb_build_object('discount_type', new.discount_type, 'discount_value', new.discount_value)
    );
  end if;

  -- Discount updated
  if tg_op = 'UPDATE' then
    perform public.log_activity(
      'discount_updated'::public.activity_type,
      'Discount campaign updated: "' || new.title || '" - ' || v_merchant_name,
      null,
      new.merchant_id,
      'discount',
      new.id,
      jsonb_build_object('discount_type', new.discount_type, 'discount_value', new.discount_value)
    );
  end if;

  return new;
end;
$$;

-- Attach trigger to discounts table
drop trigger if exists discounts_log_activity on public.discounts;
create trigger discounts_log_activity
after insert or update on public.discounts
for each row execute function public.trigger_log_discount_activity();

-- ============================================================
-- SECTION 6: Dashboard RPC Functions
-- ============================================================

-- Get admin card stats
create or replace function public.get_admin_card_stats()
returns json
language sql
security definer
set search_path = ''
as $$
  select json_build_object(
    'total_activated', coalesce(count(*) filter (where status = 'activated'), 0),
    'cards_distributed', coalesce(count(*) filter (where status in ('paid', 'activated', 'expired')), 0),
    'redemptions_used', coalesce((select count(*) from public.redemptions where status = 'completed'), 0),
    'redemption_rate', coalesce(
      round(
        (select count(*) from public.redemptions where status = 'completed')::numeric /
        nullif(count(*) filter (where status = 'activated'), 0) * 100, 1
      ), 0
    )
  )
  from public.cards;
$$;

comment on function public.get_admin_card_stats() is 'Get card statistics for super admin dashboard';
grant execute on function public.get_admin_card_stats() to authenticated;

-- Get admin transaction stats
create or replace function public.get_admin_transaction_stats()
returns json
language sql
security definer
set search_path = ''
as $$
  select json_build_object(
    'total_volume_cents', coalesce(sum(price_cents), 0),
    'revenue_generated_cents', coalesce(sum(price_cents), 0),
    'successful_transactions', coalesce(count(*) filter (where status in ('paid', 'activated')), 0),
    'failed_transactions', coalesce(count(*) filter (where status = 'cancelled'), 0)
  )
  from public.cards;
$$;

comment on function public.get_admin_transaction_stats() is 'Get transaction statistics for super admin dashboard';
grant execute on function public.get_admin_transaction_stats() to authenticated;

-- Get admin platform stats
create or replace function public.get_admin_platform_stats()
returns json
language sql
security definer
set search_path = ''
as $$
  select json_build_object(
    'active_organizations', (select count(*) from public.organization_profiles),
    'active_merchants', (select count(*) from public.merchant_profiles),
    'total_cardholders', (select count(*) from public.accounts where platform_role = 'cardholder' and is_personal_account = true)
  );
$$;

comment on function public.get_admin_platform_stats() is 'Get platform usage statistics for super admin dashboard';
grant execute on function public.get_admin_platform_stats() to authenticated;

-- Get revenue over time
create or replace function public.get_admin_revenue_over_time(months_back int default 6)
returns table(month text, revenue bigint)
language sql
security definer
set search_path = ''
as $$
  with months as (
    select generate_series(
      date_trunc('month', now()) - ((months_back - 1) || ' months')::interval,
      date_trunc('month', now()),
      '1 month'::interval
    ) as month_start
  )
  select
    to_char(m.month_start, 'Mon') as month,
    coalesce(sum(c.price_cents), 0)::bigint as revenue
  from months m
  left join public.cards c on date_trunc('month', c.paid_at) = m.month_start
    and c.paid_at is not null
    and c.status in ('paid', 'activated', 'expired')
  group by m.month_start
  order by m.month_start;
$$;

comment on function public.get_admin_revenue_over_time(int) is 'Get monthly revenue data for chart visualization';
grant execute on function public.get_admin_revenue_over_time(int) to authenticated;

-- Get top organizations by revenue
create or replace function public.get_admin_top_organizations(limit_count int default 5)
returns table(name text, total_revenue bigint)
language sql
security definer
set search_path = ''
as $$
  select
    coalesce(o.organization_name, a.name) as name,
    coalesce(sum(c.price_cents), 0)::bigint as total_revenue
  from public.organization_profiles o
  join public.accounts a on a.id = o.account_id
  left join public.cards c on c.organization_id = o.account_id
    and c.status in ('paid', 'activated', 'expired')
  group by o.account_id, o.organization_name, a.name
  order by total_revenue desc
  limit limit_count;
$$;

comment on function public.get_admin_top_organizations(int) is 'Get top performing organizations by revenue';
grant execute on function public.get_admin_top_organizations(int) to authenticated;

-- Get activities with pagination
create or replace function public.get_admin_activities(
  p_page int default 1,
  p_limit int default 5,
  p_types public.activity_type[] default null
)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_offset int;
  v_total int;
  v_data json;
begin
  v_offset := (p_page - 1) * p_limit;

  -- Get total count
  select count(*) into v_total
  from public.activities
  where (p_types is null or type = any(p_types));

  -- Get paginated data
  select json_agg(row_to_json(t)) into v_data
  from (
    select
      id,
      type,
      message,
      actor_id,
      organization_id,
      entity_type,
      entity_id,
      metadata,
      created_at as timestamp
    from public.activities
    where (p_types is null or type = any(p_types))
    order by created_at desc
    limit p_limit
    offset v_offset
  ) t;

  return json_build_object(
    'data', coalesce(v_data, '[]'::json),
    'count', v_total,
    'page', p_page,
    'limit', p_limit
  );
end;
$$;

comment on function public.get_admin_activities(int, int, public.activity_type[]) is 'Get paginated activities for admin dashboard';
grant execute on function public.get_admin_activities(int, int, public.activity_type[]) to authenticated;

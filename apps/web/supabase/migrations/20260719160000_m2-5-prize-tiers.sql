-- ─────────────────────────────────────────────────────────────────────────────
-- M2.5-a — Prize tier system (competition layer).
--
-- Thresholds + display ONLY (ledger #2, M2.5 §0.1): prize tiers move no money.
-- Thresholds are CARD COUNTS (§0.3), progressed on the paid+activated basis
-- (§0.2) so tier progress can never contradict the leaderboards.
--
-- One flexible table with a `scope` enum (decision #2): build district scope
-- now, add chapter/individual rows later with no rebuild. Prize tiers are
-- district-gated + super-admin managed (decision #3), enabled per district via
-- districts.fundraiser_enabled.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_type where typname = 'prize_scope') then
    create type public.prize_scope as enum ('district', 'chapter', 'individual');
  end if;
end
$$;

alter table public.districts
  add column if not exists fundraiser_enabled boolean not null default false;

comment on column public.districts.fundraiser_enabled is
  'When true, this district runs a district-wide prize-tier fundraiser (M2.5). Super-admin managed.';

create table if not exists public.prize_tiers (
  id uuid primary key default extensions.uuid_generate_v4(),
  scope public.prize_scope not null default 'district',
  -- For district scope, the district this tier belongs to. Chapter/individual
  -- scopes (deferred, decision #12) will add their own ref additively.
  district_id uuid references public.districts(id) on delete cascade,
  threshold_cards integer not null check (threshold_cards >= 0),
  name text not null,
  description text,
  image_url text,
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references auth.users,
  updated_by uuid references auth.users,
  -- District-scoped tiers must name their district.
  constraint prize_tiers_district_ref
    check (scope <> 'district' or district_id is not null)
);

comment on table public.prize_tiers is
  'Competition prize tiers (M2.5): card-count thresholds + display, no payout logic.';

create index if not exists ix_prize_tiers_district
  on public.prize_tiers (district_id, is_active, threshold_cards);

-- Keep updated_at fresh.
create trigger set_prize_tiers_timestamps
  before insert or update on public.prize_tiers
  for each row execute function public.trigger_set_timestamps();

-- RLS: the ladder is public (every chapter + supporter sees the full ladder,
-- §1 "show the dream"); writes are super-admin only.
alter table public.prize_tiers enable row level security;
revoke all on public.prize_tiers from anon, authenticated;
grant select on public.prize_tiers to anon, authenticated;
grant select, insert, update, delete on public.prize_tiers to service_role;

create policy prize_tiers_public_read
  on public.prize_tiers for select
  to anon, authenticated
  using (true);

create policy prize_tiers_superadmin_write
  on public.prize_tiers for all
  to authenticated
  using (public.is_super_admin())
  with check (public.is_super_admin());

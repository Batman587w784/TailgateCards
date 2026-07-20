-- ─────────────────────────────────────────────────────────────────────────────
-- M2.5 §3 — GroupMe integration (text-first).
--
-- One connection per chapter (organization_id, = accounts.id). An org-admin
-- authorizes GroupMe once (implicit OAuth), picks a group, and Tailgate registers
-- a bot in it. Weekly standings drops post via the bot_id alone (no token needed
-- at post time). The GroupMe user token is only needed to (a) create the bot and
-- (b) upload images for a future image drop, so it is encrypted at rest in
-- Supabase Vault and never stored in plaintext — the connection row holds only the
-- vault secret id (an inert pointer), decrypted service-side when required.
--
-- Decisions: #1 (all orgs may connect), #7 (connection persists, token stored
-- once), #10 (one weekly drop, chapter-mutable via weekly_enabled; over-posting →
-- the chapter removes the bot, which we detect and disable).
--
-- Rivalry pings ("[Rival] just passed you") are intentionally NOT here — they are
-- event-driven and belong with M10 push.
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.groupme_connections (
  id uuid primary key default extensions.uuid_generate_v4(),
  -- One connection per chapter. Cascade so a deleted org drops its connection.
  organization_id uuid not null unique references public.accounts(id) on delete cascade,
  -- Bot posting needs only this (POST /v3/bots/post takes bot_id, no user token).
  bot_id text not null,
  group_id text not null,
  group_name text,
  -- Pointer into vault.secrets for the GroupMe user token (never the token itself).
  token_secret_id uuid,
  -- Chapter-mutable cadence switch (#10). Also our kill-switch when a bot is removed.
  weekly_enabled boolean not null default true,
  last_posted_at timestamptz,
  connected_by uuid references auth.users on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.groupme_connections is
  'M2.5 §3 — one GroupMe bot connection per chapter. Token lives in vault; row holds only its secret id.';

create trigger set_groupme_connections_timestamps
  before insert or update on public.groupme_connections
  for each row execute function public.trigger_set_timestamps();

-- The table is managed exclusively by the service-role admin client (the OAuth
-- callback, the connect actions, and the cron worker). Clients never touch it
-- directly — the org-admin UI reads status through the definer RPC below. RLS on
-- with no authenticated grant keeps it locked (service_role bypasses RLS).
alter table public.groupme_connections enable row level security;
revoke all on public.groupme_connections from anon, authenticated;
grant select, insert, update, delete on public.groupme_connections to service_role;

-- ── Vault wrappers (service_role only) ──────────────────────────────────────
-- vault.* is not reachable via PostgREST, so we expose narrow security-definer
-- wrappers. They run as the function owner (postgres) — hence vault access — but
-- are executable only by service_role, i.e. only from the admin client.

create or replace function public.groupme_store_token(p_org_id uuid, p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := 'groupme_token_' || p_org_id::text;
  v_id uuid;
begin
  select id into v_id from vault.secrets where name = v_name;
  if v_id is not null then
    perform vault.update_secret(v_id, p_token, v_name, 'GroupMe user token');
    return v_id;
  end if;
  return vault.create_secret(p_token, v_name, 'GroupMe user token');
end;
$$;

revoke all on function public.groupme_store_token(uuid, text) from public, anon, authenticated;
grant execute on function public.groupme_store_token(uuid, text) to service_role;

create or replace function public.groupme_read_token(p_secret_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text;
begin
  select decrypted_secret into v_token
  from vault.decrypted_secrets where id = p_secret_id;
  return v_token;
end;
$$;

revoke all on function public.groupme_read_token(uuid) from public, anon, authenticated;
grant execute on function public.groupme_read_token(uuid) to service_role;

-- ── Connection status for the org-admin UI (no secrets) ─────────────────────
create or replace function public.get_groupme_connection_status(p_org_id uuid)
returns json
language plpgsql
security definer
set search_path = ''
as $$
declare
  v json;
begin
  if not public.has_role_on_account(p_org_id, 'org_admin')
     and not public.is_super_admin() then
    raise exception 'Not authorized';
  end if;

  select json_build_object(
    'connected', true,
    'group_name', gc.group_name,
    'weekly_enabled', gc.weekly_enabled,
    'last_posted_at', gc.last_posted_at
  )
  into v
  from public.groupme_connections gc
  where gc.organization_id = p_org_id;

  return coalesce(v, json_build_object('connected', false));
end;
$$;

grant execute on function public.get_groupme_connection_status(uuid) to authenticated;

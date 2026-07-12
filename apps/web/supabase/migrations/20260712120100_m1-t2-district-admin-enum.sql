-- Migration: M1 / T2 (part 1) — add 'district_admin' to platform_role enum
--
-- Isolated in its own migration on purpose: a newly-added enum value cannot be
-- USED in the same transaction that adds it. Nothing else runs here, so the
-- value is safely committed before migration 20260712120200 references it.
--
-- UNVERIFIED: not applied against a local DB (Docker/local Supabase unavailable
-- this session). Run `pnpm --filter web supabase migrations up` +
-- `pnpm supabase:web:typegen` locally before merge.

alter type public.platform_role add value if not exists 'district_admin';

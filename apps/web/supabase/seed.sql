-- ============================================================
-- TAILGATE NFC FUNDRAISING PLATFORM - SEED DATA
-- ============================================================
-- This seed creates test users for all Tailgate platform roles:
-- - Super Admin: Platform-wide management
-- - Cardholder: NFC card holders who redeem discounts
-- - Organization Admin: Manages organization and distributors
-- - Distributor: Sells NFC cards for organizations
-- - Merchant Owner: Manages merchant business
-- - Merchant Staff: Validates discounts at POS
--
-- All test users use password: testingpassword
-- ============================================================

-- WEBHOOKS SEED (Development only)
-- These webhooks are only for development purposes.
-- In production, manually create webhooks in the Supabase dashboard.

create trigger "subscriptions_delete"
    after delete
    on "public"."subscriptions"
    for each row
execute function "supabase_functions"."http_request"(
        'http://host.docker.internal:3000/api/db/webhook',
        'POST',
        '{"Content-Type":"application/json", "X-Supabase-Event-Signature":"WEBHOOKSECRET"}',
        '{}',
        '5000'
                 );

-- ============================================================
-- SECTION 1: AUTH USERS
-- ============================================================
-- Password for all users: testingpassword
-- Bcrypt hash generated via PostgreSQL: extensions.crypt('testingpassword', extensions.gen_salt('bf', 10))
-- Hash: $2a$10$iYSx2hhChDXli/QDFXiT.OKGzJgzkoCbF4MliJ0ZrReX4cltbLklO

INSERT INTO "auth"."users" (
    "instance_id", "id", "aud", "role", "email", "encrypted_password",
    "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at",
    "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change",
    "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data",
    "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at",
    "phone_change", "phone_change_token", "phone_change_sent_at", "email_change_token_current",
    "email_change_confirm_status", "banned_until", "reauthentication_token",
    "reauthentication_sent_at", "is_sso_user", "deleted_at", "is_anonymous"
) VALUES
-- Super Admin (platform-wide access)
('00000000-0000-0000-0000-000000000000', 'c5b930c9-0a76-412e-a836-4bc4849a3270', 'authenticated',
 'authenticated', 'super-admin@tailgate.dev',
 '$2a$10$iYSx2hhChDXli/QDFXiT.OKGzJgzkoCbF4MliJ0ZrReX4cltbLklO',
 '2025-11-20 10:00:00+00', NULL, '', NULL, '', NULL, '', '', NULL,
 '2025-11-20 10:00:00+00',
 '{"provider": "email", "providers": ["email"], "role": "super-admin"}',
 '{"sub": "c5b930c9-0a76-412e-a836-4bc4849a3270", "email": "super-admin@tailgate.dev", "email_verified": true, "phone_verified": false}',
 NULL, '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),

-- Cardholder 1 (NFC card holder)
('00000000-0000-0000-0000-000000000000', 'a1b2c3d4-1111-4000-8000-000000000001', 'authenticated',
 'authenticated', 'cardholder@tailgate.dev',
 '$2a$10$iYSx2hhChDXli/QDFXiT.OKGzJgzkoCbF4MliJ0ZrReX4cltbLklO',
 '2025-11-20 10:00:00+00', NULL, '', NULL, '', NULL, '', '', NULL,
 '2025-11-20 10:00:00+00',
 '{"provider": "email", "providers": ["email"]}',
 '{"sub": "a1b2c3d4-1111-4000-8000-000000000001", "email": "cardholder@tailgate.dev", "email_verified": true, "phone_verified": false}',
 NULL, '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),

-- Organization Admin (manages "Tiger Athletics" organization)
('00000000-0000-0000-0000-000000000000', 'b2c3d4e5-2222-4000-8000-000000000002', 'authenticated',
 'authenticated', 'org-admin@tailgate.dev',
 '$2a$10$iYSx2hhChDXli/QDFXiT.OKGzJgzkoCbF4MliJ0ZrReX4cltbLklO',
 '2025-11-20 10:00:00+00', NULL, '', NULL, '', NULL, '', '', NULL,
 '2025-11-20 10:00:00+00',
 '{"provider": "email", "providers": ["email"]}',
 '{"sub": "b2c3d4e5-2222-4000-8000-000000000002", "email": "org-admin@tailgate.dev", "email_verified": true, "phone_verified": false}',
 NULL, '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),

-- Distributor (sells cards for "Tiger Athletics")
('00000000-0000-0000-0000-000000000000', 'c3d4e5f6-3333-4000-8000-000000000003', 'authenticated',
 'authenticated', 'distributor@tailgate.dev',
 '$2a$10$iYSx2hhChDXli/QDFXiT.OKGzJgzkoCbF4MliJ0ZrReX4cltbLklO',
 '2025-11-20 10:00:00+00', NULL, '', NULL, '', NULL, '', '', NULL,
 '2025-11-20 10:00:00+00',
 '{"provider": "email", "providers": ["email"]}',
 '{"sub": "c3d4e5f6-3333-4000-8000-000000000003", "email": "distributor@tailgate.dev", "email_verified": true, "phone_verified": false}',
 NULL, '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),

-- Merchant Owner (owns "GameDay Grill" merchant)
('00000000-0000-0000-0000-000000000000', 'd4e5f6a7-4444-4000-8000-000000000004', 'authenticated',
 'authenticated', 'merchant-owner@tailgate.dev',
 '$2a$10$iYSx2hhChDXli/QDFXiT.OKGzJgzkoCbF4MliJ0ZrReX4cltbLklO',
 '2025-11-20 10:00:00+00', NULL, '', NULL, '', NULL, '', '', NULL,
 '2025-11-20 10:00:00+00',
 '{"provider": "email", "providers": ["email"]}',
 '{"sub": "d4e5f6a7-4444-4000-8000-000000000004", "email": "merchant-owner@tailgate.dev", "email_verified": true, "phone_verified": false}',
 NULL, '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),

-- Merchant Staff (works at "GameDay Grill")
('00000000-0000-0000-0000-000000000000', 'e5f6a7b8-5555-4000-8000-000000000005', 'authenticated',
 'authenticated', 'merchant-staff@tailgate.dev',
 '$2a$10$iYSx2hhChDXli/QDFXiT.OKGzJgzkoCbF4MliJ0ZrReX4cltbLklO',
 '2025-11-20 10:00:00+00', NULL, '', NULL, '', NULL, '', '', NULL,
 '2025-11-20 10:00:00+00',
 '{"provider": "email", "providers": ["email"]}',
 '{"sub": "e5f6a7b8-5555-4000-8000-000000000005", "email": "merchant-staff@tailgate.dev", "email_verified": true, "phone_verified": false}',
 NULL, '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),

-- Additional Cardholders for donut chart data (2-15)
('00000000-0000-0000-0000-000000000000', 'a1b2c3d4-1111-4000-8000-000000000010', 'authenticated',
 'authenticated', 'cardholder2@tailgate.dev',
 '$2a$10$iYSx2hhChDXli/QDFXiT.OKGzJgzkoCbF4MliJ0ZrReX4cltbLklO',
 '2025-11-21 10:00:00+00', NULL, '', NULL, '', NULL, '', '', NULL,
 '2025-11-21 10:00:00+00',
 '{"provider": "email", "providers": ["email"]}',
 '{"sub": "a1b2c3d4-1111-4000-8000-000000000010", "email": "cardholder2@tailgate.dev", "email_verified": true, "phone_verified": false}',
 NULL, '2025-11-21 10:00:00+00', '2025-11-21 10:00:00+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),

('00000000-0000-0000-0000-000000000000', 'a1b2c3d4-1111-4000-8000-000000000011', 'authenticated',
 'authenticated', 'cardholder3@tailgate.dev',
 '$2a$10$iYSx2hhChDXli/QDFXiT.OKGzJgzkoCbF4MliJ0ZrReX4cltbLklO',
 '2025-11-22 10:00:00+00', NULL, '', NULL, '', NULL, '', '', NULL,
 '2025-11-22 10:00:00+00',
 '{"provider": "email", "providers": ["email"]}',
 '{"sub": "a1b2c3d4-1111-4000-8000-000000000011", "email": "cardholder3@tailgate.dev", "email_verified": true, "phone_verified": false}',
 NULL, '2025-11-22 10:00:00+00', '2025-11-22 10:00:00+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),

('00000000-0000-0000-0000-000000000000', 'a1b2c3d4-1111-4000-8000-000000000012', 'authenticated',
 'authenticated', 'cardholder4@tailgate.dev',
 '$2a$10$iYSx2hhChDXli/QDFXiT.OKGzJgzkoCbF4MliJ0ZrReX4cltbLklO',
 '2025-11-23 10:00:00+00', NULL, '', NULL, '', NULL, '', '', NULL,
 '2025-11-23 10:00:00+00',
 '{"provider": "email", "providers": ["email"]}',
 '{"sub": "a1b2c3d4-1111-4000-8000-000000000012", "email": "cardholder4@tailgate.dev", "email_verified": true, "phone_verified": false}',
 NULL, '2025-11-23 10:00:00+00', '2025-11-23 10:00:00+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),

('00000000-0000-0000-0000-000000000000', 'a1b2c3d4-1111-4000-8000-000000000013', 'authenticated',
 'authenticated', 'cardholder5@tailgate.dev',
 '$2a$10$iYSx2hhChDXli/QDFXiT.OKGzJgzkoCbF4MliJ0ZrReX4cltbLklO',
 '2025-11-24 10:00:00+00', NULL, '', NULL, '', NULL, '', '', NULL,
 '2025-11-24 10:00:00+00',
 '{"provider": "email", "providers": ["email"]}',
 '{"sub": "a1b2c3d4-1111-4000-8000-000000000013", "email": "cardholder5@tailgate.dev", "email_verified": true, "phone_verified": false}',
 NULL, '2025-11-24 10:00:00+00', '2025-11-24 10:00:00+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),

('00000000-0000-0000-0000-000000000000', 'a1b2c3d4-1111-4000-8000-000000000014', 'authenticated',
 'authenticated', 'cardholder6@tailgate.dev',
 '$2a$10$iYSx2hhChDXli/QDFXiT.OKGzJgzkoCbF4MliJ0ZrReX4cltbLklO',
 '2025-11-25 10:00:00+00', NULL, '', NULL, '', NULL, '', '', NULL,
 '2025-11-25 10:00:00+00',
 '{"provider": "email", "providers": ["email"]}',
 '{"sub": "a1b2c3d4-1111-4000-8000-000000000014", "email": "cardholder6@tailgate.dev", "email_verified": true, "phone_verified": false}',
 NULL, '2025-11-25 10:00:00+00', '2025-11-25 10:00:00+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),

('00000000-0000-0000-0000-000000000000', 'a1b2c3d4-1111-4000-8000-000000000015', 'authenticated',
 'authenticated', 'cardholder7@tailgate.dev',
 '$2a$10$iYSx2hhChDXli/QDFXiT.OKGzJgzkoCbF4MliJ0ZrReX4cltbLklO',
 '2025-11-26 10:00:00+00', NULL, '', NULL, '', NULL, '', '', NULL,
 '2025-11-26 10:00:00+00',
 '{"provider": "email", "providers": ["email"]}',
 '{"sub": "a1b2c3d4-1111-4000-8000-000000000015", "email": "cardholder7@tailgate.dev", "email_verified": true, "phone_verified": false}',
 NULL, '2025-11-26 10:00:00+00', '2025-11-26 10:00:00+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),

('00000000-0000-0000-0000-000000000000', 'a1b2c3d4-1111-4000-8000-000000000016', 'authenticated',
 'authenticated', 'cardholder8@tailgate.dev',
 '$2a$10$iYSx2hhChDXli/QDFXiT.OKGzJgzkoCbF4MliJ0ZrReX4cltbLklO',
 '2025-11-27 10:00:00+00', NULL, '', NULL, '', NULL, '', '', NULL,
 '2025-11-27 10:00:00+00',
 '{"provider": "email", "providers": ["email"]}',
 '{"sub": "a1b2c3d4-1111-4000-8000-000000000016", "email": "cardholder8@tailgate.dev", "email_verified": true, "phone_verified": false}',
 NULL, '2025-11-27 10:00:00+00', '2025-11-27 10:00:00+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),

('00000000-0000-0000-0000-000000000000', 'a1b2c3d4-1111-4000-8000-000000000017', 'authenticated',
 'authenticated', 'cardholder9@tailgate.dev',
 '$2a$10$iYSx2hhChDXli/QDFXiT.OKGzJgzkoCbF4MliJ0ZrReX4cltbLklO',
 '2025-11-28 10:00:00+00', NULL, '', NULL, '', NULL, '', '', NULL,
 '2025-11-28 10:00:00+00',
 '{"provider": "email", "providers": ["email"]}',
 '{"sub": "a1b2c3d4-1111-4000-8000-000000000017", "email": "cardholder9@tailgate.dev", "email_verified": true, "phone_verified": false}',
 NULL, '2025-11-28 10:00:00+00', '2025-11-28 10:00:00+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),

('00000000-0000-0000-0000-000000000000', 'a1b2c3d4-1111-4000-8000-000000000018', 'authenticated',
 'authenticated', 'cardholder10@tailgate.dev',
 '$2a$10$iYSx2hhChDXli/QDFXiT.OKGzJgzkoCbF4MliJ0ZrReX4cltbLklO',
 '2025-11-29 10:00:00+00', NULL, '', NULL, '', NULL, '', '', NULL,
 '2025-11-29 10:00:00+00',
 '{"provider": "email", "providers": ["email"]}',
 '{"sub": "a1b2c3d4-1111-4000-8000-000000000018", "email": "cardholder10@tailgate.dev", "email_verified": true, "phone_verified": false}',
 NULL, '2025-11-29 10:00:00+00', '2025-11-29 10:00:00+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),

('00000000-0000-0000-0000-000000000000', 'a1b2c3d4-1111-4000-8000-000000000019', 'authenticated',
 'authenticated', 'cardholder11@tailgate.dev',
 '$2a$10$iYSx2hhChDXli/QDFXiT.OKGzJgzkoCbF4MliJ0ZrReX4cltbLklO',
 '2025-11-30 10:00:00+00', NULL, '', NULL, '', NULL, '', '', NULL,
 '2025-11-30 10:00:00+00',
 '{"provider": "email", "providers": ["email"]}',
 '{"sub": "a1b2c3d4-1111-4000-8000-000000000019", "email": "cardholder11@tailgate.dev", "email_verified": true, "phone_verified": false}',
 NULL, '2025-11-30 10:00:00+00', '2025-11-30 10:00:00+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),

('00000000-0000-0000-0000-000000000000', 'a1b2c3d4-1111-4000-8000-000000000020', 'authenticated',
 'authenticated', 'cardholder12@tailgate.dev',
 '$2a$10$iYSx2hhChDXli/QDFXiT.OKGzJgzkoCbF4MliJ0ZrReX4cltbLklO',
 '2025-12-01 10:00:00+00', NULL, '', NULL, '', NULL, '', '', NULL,
 '2025-12-01 10:00:00+00',
 '{"provider": "email", "providers": ["email"]}',
 '{"sub": "a1b2c3d4-1111-4000-8000-000000000020", "email": "cardholder12@tailgate.dev", "email_verified": true, "phone_verified": false}',
 NULL, '2025-12-01 10:00:00+00', '2025-12-01 10:00:00+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),

('00000000-0000-0000-0000-000000000000', 'a1b2c3d4-1111-4000-8000-000000000021', 'authenticated',
 'authenticated', 'cardholder13@tailgate.dev',
 '$2a$10$iYSx2hhChDXli/QDFXiT.OKGzJgzkoCbF4MliJ0ZrReX4cltbLklO',
 '2025-12-02 10:00:00+00', NULL, '', NULL, '', NULL, '', '', NULL,
 '2025-12-02 10:00:00+00',
 '{"provider": "email", "providers": ["email"]}',
 '{"sub": "a1b2c3d4-1111-4000-8000-000000000021", "email": "cardholder13@tailgate.dev", "email_verified": true, "phone_verified": false}',
 NULL, '2025-12-02 10:00:00+00', '2025-12-02 10:00:00+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),

('00000000-0000-0000-0000-000000000000', 'a1b2c3d4-1111-4000-8000-000000000022', 'authenticated',
 'authenticated', 'cardholder14@tailgate.dev',
 '$2a$10$iYSx2hhChDXli/QDFXiT.OKGzJgzkoCbF4MliJ0ZrReX4cltbLklO',
 '2025-12-03 10:00:00+00', NULL, '', NULL, '', NULL, '', '', NULL,
 '2025-12-03 10:00:00+00',
 '{"provider": "email", "providers": ["email"]}',
 '{"sub": "a1b2c3d4-1111-4000-8000-000000000022", "email": "cardholder14@tailgate.dev", "email_verified": true, "phone_verified": false}',
 NULL, '2025-12-03 10:00:00+00', '2025-12-03 10:00:00+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),

-- Digital cardholders (15-17). cards.cardholder_id is unique-per-cardholder,
-- so digital activations need their own personal accounts distinct from the
-- physical cardholders above.
('00000000-0000-0000-0000-000000000000', 'a1b2c3d4-1111-4000-8000-000000000030', 'authenticated',
 'authenticated', 'digital-cardholder1@tailgate.dev',
 '$2a$10$iYSx2hhChDXli/QDFXiT.OKGzJgzkoCbF4MliJ0ZrReX4cltbLklO',
 '2025-12-04 09:30:00+00', NULL, '', NULL, '', NULL, '', '', NULL,
 '2025-12-04 09:30:00+00',
 '{"provider": "email", "providers": ["email"]}',
 '{"sub": "a1b2c3d4-1111-4000-8000-000000000030", "email": "digital-cardholder1@tailgate.dev", "email_verified": true, "phone_verified": false}',
 NULL, '2025-12-04 09:30:00+00', '2025-12-04 09:30:00+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),

('00000000-0000-0000-0000-000000000000', 'a1b2c3d4-1111-4000-8000-000000000031', 'authenticated',
 'authenticated', 'digital-cardholder2@tailgate.dev',
 '$2a$10$iYSx2hhChDXli/QDFXiT.OKGzJgzkoCbF4MliJ0ZrReX4cltbLklO',
 '2025-12-08 11:00:00+00', NULL, '', NULL, '', NULL, '', '', NULL,
 '2025-12-08 11:00:00+00',
 '{"provider": "email", "providers": ["email"]}',
 '{"sub": "a1b2c3d4-1111-4000-8000-000000000031", "email": "digital-cardholder2@tailgate.dev", "email_verified": true, "phone_verified": false}',
 NULL, '2025-12-08 11:00:00+00', '2025-12-08 11:00:00+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),

('00000000-0000-0000-0000-000000000000', 'a1b2c3d4-1111-4000-8000-000000000032', 'authenticated',
 'authenticated', 'digital-cardholder3@tailgate.dev',
 '$2a$10$iYSx2hhChDXli/QDFXiT.OKGzJgzkoCbF4MliJ0ZrReX4cltbLklO',
 '2025-12-09 15:30:00+00', NULL, '', NULL, '', NULL, '', '', NULL,
 '2025-12-09 15:30:00+00',
 '{"provider": "email", "providers": ["email"]}',
 '{"sub": "a1b2c3d4-1111-4000-8000-000000000032", "email": "digital-cardholder3@tailgate.dev", "email_verified": true, "phone_verified": false}',
 NULL, '2025-12-09 15:30:00+00', '2025-12-09 15:30:00+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),

-- Second Organization Admin (for Eagle Foundation)
('00000000-0000-0000-0000-000000000000', 'b2c3d4e5-2222-4000-8000-000000000010', 'authenticated',
 'authenticated', 'org-admin2@tailgate.dev',
 '$2a$10$iYSx2hhChDXli/QDFXiT.OKGzJgzkoCbF4MliJ0ZrReX4cltbLklO',
 '2025-11-20 10:00:00+00', NULL, '', NULL, '', NULL, '', '', NULL,
 '2025-11-20 10:00:00+00',
 '{"provider": "email", "providers": ["email"]}',
 '{"sub": "b2c3d4e5-2222-4000-8000-000000000010", "email": "org-admin2@tailgate.dev", "email_verified": true, "phone_verified": false}',
 NULL, '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false),

-- Second Distributor (for Eagle Foundation)
('00000000-0000-0000-0000-000000000000', 'c3d4e5f6-3333-4000-8000-000000000010', 'authenticated',
 'authenticated', 'distributor2@tailgate.dev',
 '$2a$10$iYSx2hhChDXli/QDFXiT.OKGzJgzkoCbF4MliJ0ZrReX4cltbLklO',
 '2025-11-20 10:00:00+00', NULL, '', NULL, '', NULL, '', '', NULL,
 '2025-11-20 10:00:00+00',
 '{"provider": "email", "providers": ["email"]}',
 '{"sub": "c3d4e5f6-3333-4000-8000-000000000010", "email": "distributor2@tailgate.dev", "email_verified": true, "phone_verified": false}',
 NULL, '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00', NULL, NULL, '', '', NULL, '', 0, NULL, '', NULL, false, NULL, false);

-- ============================================================
-- SECTION 2: AUTH IDENTITIES
-- ============================================================

INSERT INTO "auth"."identities" (
    "provider_id", "user_id", "identity_data", "provider",
    "last_sign_in_at", "created_at", "updated_at", "id"
) VALUES
-- Super Admin
('c5b930c9-0a76-412e-a836-4bc4849a3270', 'c5b930c9-0a76-412e-a836-4bc4849a3270',
 '{"sub": "c5b930c9-0a76-412e-a836-4bc4849a3270", "email": "super-admin@tailgate.dev", "email_verified": true, "phone_verified": false}',
 'email', '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00',
 'c5b930c9-0a76-412e-a836-4bc4849a3270'),

-- Cardholder 1
('a1b2c3d4-1111-4000-8000-000000000001', 'a1b2c3d4-1111-4000-8000-000000000001',
 '{"sub": "a1b2c3d4-1111-4000-8000-000000000001", "email": "cardholder@tailgate.dev", "email_verified": true, "phone_verified": false}',
 'email', '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00',
 'a1b2c3d4-1111-4000-8000-000000000001'),

-- Organization Admin
('b2c3d4e5-2222-4000-8000-000000000002', 'b2c3d4e5-2222-4000-8000-000000000002',
 '{"sub": "b2c3d4e5-2222-4000-8000-000000000002", "email": "org-admin@tailgate.dev", "email_verified": true, "phone_verified": false}',
 'email', '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00',
 'b2c3d4e5-2222-4000-8000-000000000002'),

-- Distributor
('c3d4e5f6-3333-4000-8000-000000000003', 'c3d4e5f6-3333-4000-8000-000000000003',
 '{"sub": "c3d4e5f6-3333-4000-8000-000000000003", "email": "distributor@tailgate.dev", "email_verified": true, "phone_verified": false}',
 'email', '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00',
 'c3d4e5f6-3333-4000-8000-000000000003'),

-- Merchant Owner
('d4e5f6a7-4444-4000-8000-000000000004', 'd4e5f6a7-4444-4000-8000-000000000004',
 '{"sub": "d4e5f6a7-4444-4000-8000-000000000004", "email": "merchant-owner@tailgate.dev", "email_verified": true, "phone_verified": false}',
 'email', '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00',
 'd4e5f6a7-4444-4000-8000-000000000004'),

-- Merchant Staff
('e5f6a7b8-5555-4000-8000-000000000005', 'e5f6a7b8-5555-4000-8000-000000000005',
 '{"sub": "e5f6a7b8-5555-4000-8000-000000000005", "email": "merchant-staff@tailgate.dev", "email_verified": true, "phone_verified": false}',
 'email', '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00',
 'e5f6a7b8-5555-4000-8000-000000000005'),

-- Additional Cardholder identities (2-14)
('a1b2c3d4-1111-4000-8000-000000000010', 'a1b2c3d4-1111-4000-8000-000000000010',
 '{"sub": "a1b2c3d4-1111-4000-8000-000000000010", "email": "cardholder2@tailgate.dev", "email_verified": true, "phone_verified": false}',
 'email', '2025-11-21 10:00:00+00', '2025-11-21 10:00:00+00', '2025-11-21 10:00:00+00',
 'a1b2c3d4-1111-4000-8000-000000000010'),

('a1b2c3d4-1111-4000-8000-000000000011', 'a1b2c3d4-1111-4000-8000-000000000011',
 '{"sub": "a1b2c3d4-1111-4000-8000-000000000011", "email": "cardholder3@tailgate.dev", "email_verified": true, "phone_verified": false}',
 'email', '2025-11-22 10:00:00+00', '2025-11-22 10:00:00+00', '2025-11-22 10:00:00+00',
 'a1b2c3d4-1111-4000-8000-000000000011'),

('a1b2c3d4-1111-4000-8000-000000000012', 'a1b2c3d4-1111-4000-8000-000000000012',
 '{"sub": "a1b2c3d4-1111-4000-8000-000000000012", "email": "cardholder4@tailgate.dev", "email_verified": true, "phone_verified": false}',
 'email', '2025-11-23 10:00:00+00', '2025-11-23 10:00:00+00', '2025-11-23 10:00:00+00',
 'a1b2c3d4-1111-4000-8000-000000000012'),

('a1b2c3d4-1111-4000-8000-000000000013', 'a1b2c3d4-1111-4000-8000-000000000013',
 '{"sub": "a1b2c3d4-1111-4000-8000-000000000013", "email": "cardholder5@tailgate.dev", "email_verified": true, "phone_verified": false}',
 'email', '2025-11-24 10:00:00+00', '2025-11-24 10:00:00+00', '2025-11-24 10:00:00+00',
 'a1b2c3d4-1111-4000-8000-000000000013'),

('a1b2c3d4-1111-4000-8000-000000000014', 'a1b2c3d4-1111-4000-8000-000000000014',
 '{"sub": "a1b2c3d4-1111-4000-8000-000000000014", "email": "cardholder6@tailgate.dev", "email_verified": true, "phone_verified": false}',
 'email', '2025-11-25 10:00:00+00', '2025-11-25 10:00:00+00', '2025-11-25 10:00:00+00',
 'a1b2c3d4-1111-4000-8000-000000000014'),

('a1b2c3d4-1111-4000-8000-000000000015', 'a1b2c3d4-1111-4000-8000-000000000015',
 '{"sub": "a1b2c3d4-1111-4000-8000-000000000015", "email": "cardholder7@tailgate.dev", "email_verified": true, "phone_verified": false}',
 'email', '2025-11-26 10:00:00+00', '2025-11-26 10:00:00+00', '2025-11-26 10:00:00+00',
 'a1b2c3d4-1111-4000-8000-000000000015'),

('a1b2c3d4-1111-4000-8000-000000000016', 'a1b2c3d4-1111-4000-8000-000000000016',
 '{"sub": "a1b2c3d4-1111-4000-8000-000000000016", "email": "cardholder8@tailgate.dev", "email_verified": true, "phone_verified": false}',
 'email', '2025-11-27 10:00:00+00', '2025-11-27 10:00:00+00', '2025-11-27 10:00:00+00',
 'a1b2c3d4-1111-4000-8000-000000000016'),

('a1b2c3d4-1111-4000-8000-000000000017', 'a1b2c3d4-1111-4000-8000-000000000017',
 '{"sub": "a1b2c3d4-1111-4000-8000-000000000017", "email": "cardholder9@tailgate.dev", "email_verified": true, "phone_verified": false}',
 'email', '2025-11-28 10:00:00+00', '2025-11-28 10:00:00+00', '2025-11-28 10:00:00+00',
 'a1b2c3d4-1111-4000-8000-000000000017'),

('a1b2c3d4-1111-4000-8000-000000000018', 'a1b2c3d4-1111-4000-8000-000000000018',
 '{"sub": "a1b2c3d4-1111-4000-8000-000000000018", "email": "cardholder10@tailgate.dev", "email_verified": true, "phone_verified": false}',
 'email', '2025-11-29 10:00:00+00', '2025-11-29 10:00:00+00', '2025-11-29 10:00:00+00',
 'a1b2c3d4-1111-4000-8000-000000000018'),

('a1b2c3d4-1111-4000-8000-000000000019', 'a1b2c3d4-1111-4000-8000-000000000019',
 '{"sub": "a1b2c3d4-1111-4000-8000-000000000019", "email": "cardholder11@tailgate.dev", "email_verified": true, "phone_verified": false}',
 'email', '2025-11-30 10:00:00+00', '2025-11-30 10:00:00+00', '2025-11-30 10:00:00+00',
 'a1b2c3d4-1111-4000-8000-000000000019'),

('a1b2c3d4-1111-4000-8000-000000000020', 'a1b2c3d4-1111-4000-8000-000000000020',
 '{"sub": "a1b2c3d4-1111-4000-8000-000000000020", "email": "cardholder12@tailgate.dev", "email_verified": true, "phone_verified": false}',
 'email', '2025-12-01 10:00:00+00', '2025-12-01 10:00:00+00', '2025-12-01 10:00:00+00',
 'a1b2c3d4-1111-4000-8000-000000000020'),

('a1b2c3d4-1111-4000-8000-000000000021', 'a1b2c3d4-1111-4000-8000-000000000021',
 '{"sub": "a1b2c3d4-1111-4000-8000-000000000021", "email": "cardholder13@tailgate.dev", "email_verified": true, "phone_verified": false}',
 'email', '2025-12-02 10:00:00+00', '2025-12-02 10:00:00+00', '2025-12-02 10:00:00+00',
 'a1b2c3d4-1111-4000-8000-000000000021'),

('a1b2c3d4-1111-4000-8000-000000000022', 'a1b2c3d4-1111-4000-8000-000000000022',
 '{"sub": "a1b2c3d4-1111-4000-8000-000000000022", "email": "cardholder14@tailgate.dev", "email_verified": true, "phone_verified": false}',
 'email', '2025-12-03 10:00:00+00', '2025-12-03 10:00:00+00', '2025-12-03 10:00:00+00',
 'a1b2c3d4-1111-4000-8000-000000000022'),

-- Digital cardholder identities (15-17)
('a1b2c3d4-1111-4000-8000-000000000030', 'a1b2c3d4-1111-4000-8000-000000000030',
 '{"sub": "a1b2c3d4-1111-4000-8000-000000000030", "email": "digital-cardholder1@tailgate.dev", "email_verified": true, "phone_verified": false}',
 'email', '2025-12-04 09:30:00+00', '2025-12-04 09:30:00+00', '2025-12-04 09:30:00+00',
 'a1b2c3d4-1111-4000-8000-000000000030'),

('a1b2c3d4-1111-4000-8000-000000000031', 'a1b2c3d4-1111-4000-8000-000000000031',
 '{"sub": "a1b2c3d4-1111-4000-8000-000000000031", "email": "digital-cardholder2@tailgate.dev", "email_verified": true, "phone_verified": false}',
 'email', '2025-12-08 11:00:00+00', '2025-12-08 11:00:00+00', '2025-12-08 11:00:00+00',
 'a1b2c3d4-1111-4000-8000-000000000031'),

('a1b2c3d4-1111-4000-8000-000000000032', 'a1b2c3d4-1111-4000-8000-000000000032',
 '{"sub": "a1b2c3d4-1111-4000-8000-000000000032", "email": "digital-cardholder3@tailgate.dev", "email_verified": true, "phone_verified": false}',
 'email', '2025-12-09 15:30:00+00', '2025-12-09 15:30:00+00', '2025-12-09 15:30:00+00',
 'a1b2c3d4-1111-4000-8000-000000000032'),

-- Second Org Admin Identity
('b2c3d4e5-2222-4000-8000-000000000010', 'b2c3d4e5-2222-4000-8000-000000000010',
 '{"sub": "b2c3d4e5-2222-4000-8000-000000000010", "email": "org-admin2@tailgate.dev", "email_verified": true, "phone_verified": false}',
 'email', '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00',
 'b2c3d4e5-2222-4000-8000-000000000010'),

-- Second Distributor Identity
('c3d4e5f6-3333-4000-8000-000000000010', 'c3d4e5f6-3333-4000-8000-000000000010',
 '{"sub": "c3d4e5f6-3333-4000-8000-000000000010", "email": "distributor2@tailgate.dev", "email_verified": true, "phone_verified": false}',
 'email', '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00',
 'c3d4e5f6-3333-4000-8000-000000000010');

-- ============================================================
-- SECTION 2.4: MFA FACTORS FOR SUPER ADMIN
-- ============================================================
-- Super admin requires MFA (AAL2) to access admin features.
-- We seed a verified TOTP factor so they can complete MFA challenge.
-- TOTP Secret: NHOHJVGPO3R3LKVPRMNIYLCDMBHUM2SE (use in authenticator app)

INSERT INTO "auth"."mfa_factors" (
    "id", "user_id", "friendly_name", "factor_type", "status",
    "created_at", "updated_at", "secret"
) VALUES (
    'f0f0f0f0-0000-4000-8000-000000000001',
    'c5b930c9-0a76-412e-a836-4bc4849a3270',
    'Authenticator App',
    'totp',
    'verified',
    '2025-11-20 10:00:00+00',
    '2025-11-20 10:00:00+00',
    'NHOHJVGPO3R3LKVPRMNIYLCDMBHUM2SE'
);


-- ============================================================
-- SECTION 3: TEAM ACCOUNTS (Organizations & Merchants)
-- ============================================================
-- Personal accounts are auto-created by triggers when users sign up.
-- Here we create team accounts for organizations and merchants.

INSERT INTO "public"."accounts" (
    "id", "primary_owner_user_id", "name", "slug", "email",
    "is_personal_account", "updated_at", "created_at", "created_by",
    "updated_by", "picture_url", "public_data"
) VALUES
-- Tiger Athletics Organization (team account)
('11111111-1111-4000-8000-000000000001', 'b2c3d4e5-2222-4000-8000-000000000002',
 'Tiger Athletics', 'tiger-athletics', 'info@tiger-athletics.dev',
 false, '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00', NULL, NULL, NULL, '{}'),

-- Eagle Foundation Organization (second team account)
('11111111-1111-4000-8000-000000000002', 'b2c3d4e5-2222-4000-8000-000000000010',
 'Eagle Foundation', 'eagle-foundation', 'info@eagle-foundation.dev',
 false, '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00', NULL, NULL, NULL, '{}'),

-- GameDay Grill Merchant (team account)
('22222222-2222-4000-8000-000000000002', 'd4e5f6a7-4444-4000-8000-000000000004',
 'GameDay Grill', 'gameday-grill', 'info@gameday-grill.dev',
 false, '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00', NULL, NULL, NULL, '{}'),

-- Orlando Coffee House Merchant (team account - different city, tests partnership-only visibility)
('22222222-2222-4000-8000-000000000003', 'd4e5f6a7-4444-4000-8000-000000000004',
 'Orlando Coffee House', 'orlando-coffee', 'info@orlando-coffee.dev',
 false, '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00', NULL, NULL, NULL, '{}'),

-- Miami Sports Bar (same city as orgs but NO partnership - tests hidden: no partnership)
('22222222-2222-4000-8000-000000000004', 'd4e5f6a7-4444-4000-8000-000000000004',
 'Miami Sports Bar', 'miami-sports-bar', 'info@miami-sports-bar.dev',
 false, '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00', NULL, NULL, NULL, '{}'),

-- Sunset Smoothies (partnered with Tiger Athletics but discount expired - tests hidden: expired)
('22222222-2222-4000-8000-000000000005', 'd4e5f6a7-4444-4000-8000-000000000004',
 'Sunset Smoothies', 'sunset-smoothies', 'info@sunset-smoothies.dev',
 false, '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00', NULL, NULL, NULL, '{}'),

-- Campus Bookstore (partnered with Tiger Athletics but discount inactive - tests hidden: deactivated)
('22222222-2222-4000-8000-000000000006', 'd4e5f6a7-4444-4000-8000-000000000004',
 'Campus Bookstore', 'campus-bookstore', 'info@campus-bookstore.dev',
 false, '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00', NULL, NULL, NULL, '{}');

-- ============================================================
-- SECTION 4: ACCOUNT MEMBERSHIPS
-- ============================================================
-- Link users to team accounts with their roles

-- Distributor rows pre-set share_slug to deterministic values so /activate/d/<slug>
-- has stable URLs for local dev. The trigger generate_distributor_share_slug only
-- fires when share_slug IS NULL, so explicit values pass through unchanged.
-- Memberships are immutable after insert (kit.prevent_memberships_update), so
-- this can't be done as a follow-up UPDATE.
INSERT INTO "public"."accounts_memberships" (
    "user_id", "account_id", "account_role", "share_slug",
    "created_at", "updated_at", "created_by", "updated_by"
) VALUES
-- Organization Admin owns Tiger Athletics
('b2c3d4e5-2222-4000-8000-000000000002', '11111111-1111-4000-8000-000000000001', 'org_admin', NULL,
 '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00', NULL, NULL),

-- Distributor is member of Tiger Athletics
('c3d4e5f6-3333-4000-8000-000000000003', '11111111-1111-4000-8000-000000000001', 'distributor', 'tiger-distributor',
 '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00', NULL, NULL),

-- Second Org Admin owns Eagle Foundation
('b2c3d4e5-2222-4000-8000-000000000010', '11111111-1111-4000-8000-000000000002', 'org_admin', NULL,
 '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00', NULL, NULL),

-- Second Distributor is member of Eagle Foundation
('c3d4e5f6-3333-4000-8000-000000000010', '11111111-1111-4000-8000-000000000002', 'distributor', 'eagle-distributor',
 '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00', NULL, NULL),

-- Merchant Owner owns GameDay Grill
('d4e5f6a7-4444-4000-8000-000000000004', '22222222-2222-4000-8000-000000000002', 'merchant', NULL,
 '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00', NULL, NULL),

-- Merchant Staff works at GameDay Grill (now also uses 'merchant' role)
('e5f6a7b8-5555-4000-8000-000000000005', '22222222-2222-4000-8000-000000000002', 'merchant', NULL,
 '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00', NULL, NULL),

-- Merchant Owner also owns Orlando Coffee House
('d4e5f6a7-4444-4000-8000-000000000004', '22222222-2222-4000-8000-000000000003', 'merchant', NULL,
 '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00', NULL, NULL),

-- Merchant Owner also owns Miami Sports Bar
('d4e5f6a7-4444-4000-8000-000000000004', '22222222-2222-4000-8000-000000000004', 'merchant', NULL,
 '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00', NULL, NULL),

-- Merchant Owner also owns Sunset Smoothies
('d4e5f6a7-4444-4000-8000-000000000004', '22222222-2222-4000-8000-000000000005', 'merchant', NULL,
 '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00', NULL, NULL),

-- Merchant Owner also owns Campus Bookstore
('d4e5f6a7-4444-4000-8000-000000000004', '22222222-2222-4000-8000-000000000006', 'merchant', NULL,
 '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00', NULL, NULL);

-- ============================================================
-- SECTION 5: ORGANIZATION PROFILES
-- ============================================================

INSERT INTO "public"."organization_profiles" (
    "id", "account_id", "organization_name", "organization_type",
    "contact_phone", "address", "state", "city", "cash_payments_enabled", "card_price_cents",
    "created_at", "updated_at", "created_by", "updated_by"
) VALUES
('33333333-3333-4000-8000-000000000001', '11111111-1111-4000-8000-000000000001',
 'Tiger Athletics Booster Club', 'sports_team',
 '+1-555-123-4567', '123 Stadium Drive, Miami, FL 33101', 'Florida', 'Miami', true, 2500,
 '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00',
 'b2c3d4e5-2222-4000-8000-000000000002', 'b2c3d4e5-2222-4000-8000-000000000002'),

('33333333-3333-4000-8000-000000000002', '11111111-1111-4000-8000-000000000002',
 'Eagle Foundation Charity', 'charity',
 '+1-555-987-1234', '456 Charity Lane, Miami, FL 33102', 'Florida', 'Miami', true, 3000,
 '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00',
 'b2c3d4e5-2222-4000-8000-000000000010', 'b2c3d4e5-2222-4000-8000-000000000010');

-- ============================================================
-- SECTION 6: MERCHANT PROFILES
-- ============================================================

INSERT INTO "public"."merchant_profiles" (
    "id", "account_id", "business_name", "business_type",
    "contact_phone", "address", "state", "city", "dashboard_passcode_hash",
    "stripe_account_id", "created_at", "updated_at", "created_by", "updated_by"
) VALUES
('44444444-4444-4000-8000-000000000001', '22222222-2222-4000-8000-000000000002',
 'GameDay Grill & Sports Bar', 'restaurant',
 '+1-555-987-6543', '456 Main Street, Miami, FL 33101', 'Florida', 'Miami',
 -- Dashboard passcode is "1234" (for testing)
 '$2a$10$iYSx2hhChDXli/QDFXiT.OKGzJgzkoCbF4MliJ0ZrReX4cltbLklO',
 NULL, '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00',
 'd4e5f6a7-4444-4000-8000-000000000004', 'd4e5f6a7-4444-4000-8000-000000000004'),

-- Second merchant in Orlando (different city - tests partnership-only visibility)
('44444444-4444-4000-8000-000000000002', '22222222-2222-4000-8000-000000000003',
 'Orlando Coffee House', 'cafe',
 '+1-555-321-9876', '789 Theme Park Blvd, Orlando, FL 32819', 'Florida', 'Orlando',
 '$2a$10$iYSx2hhChDXli/QDFXiT.OKGzJgzkoCbF4MliJ0ZrReX4cltbLklO',
 NULL, '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00',
 'd4e5f6a7-4444-4000-8000-000000000004', 'd4e5f6a7-4444-4000-8000-000000000004'),

-- Miami Sports Bar (SAME city as orgs, NO partnership - must be HIDDEN)
('44444444-4444-4000-8000-000000000003', '22222222-2222-4000-8000-000000000004',
 'Miami Sports Bar', 'bar',
 '+1-555-444-1111', '100 Ocean Drive, Miami, FL 33139', 'Florida', 'Miami',
 '$2a$10$iYSx2hhChDXli/QDFXiT.OKGzJgzkoCbF4MliJ0ZrReX4cltbLklO',
 NULL, '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00',
 'd4e5f6a7-4444-4000-8000-000000000004', 'd4e5f6a7-4444-4000-8000-000000000004'),

-- Sunset Smoothies (Miami, partnered but discount expired)
('44444444-4444-4000-8000-000000000004', '22222222-2222-4000-8000-000000000005',
 'Sunset Smoothies', 'cafe',
 '+1-555-444-2222', '200 Sunset Blvd, Miami, FL 33139', 'Florida', 'Miami',
 '$2a$10$iYSx2hhChDXli/QDFXiT.OKGzJgzkoCbF4MliJ0ZrReX4cltbLklO',
 NULL, '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00',
 'd4e5f6a7-4444-4000-8000-000000000004', 'd4e5f6a7-4444-4000-8000-000000000004'),

-- Campus Bookstore (Miami, partnered but discount inactive)
('44444444-4444-4000-8000-000000000005', '22222222-2222-4000-8000-000000000006',
 'Campus Bookstore', 'retail',
 '+1-555-444-3333', '300 University Ave, Miami, FL 33146', 'Florida', 'Miami',
 '$2a$10$iYSx2hhChDXli/QDFXiT.OKGzJgzkoCbF4MliJ0ZrReX4cltbLklO',
 NULL, '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00',
 'd4e5f6a7-4444-4000-8000-000000000004', 'd4e5f6a7-4444-4000-8000-000000000004');

-- ============================================================
-- SECTION 7: CARDHOLDER PROFILES
-- ============================================================
-- Note: Cardholder profiles are linked to personal accounts (auto-created)
-- We need to get the personal account ID for the cardholder user
-- Personal accounts have id = user_id for personal accounts

INSERT INTO "public"."cardholder_profiles" (
    "id", "account_id", "stripe_customer_id",
    "apple_wallet_added_at", "google_wallet_added_at",
    "created_at", "updated_at", "created_by", "updated_by"
) VALUES
-- Primary test cardholder: no wallet added → wallet-warning banner shows on dashboard
('55555555-5555-4000-8000-000000000001', 'a1b2c3d4-1111-4000-8000-000000000001',
 NULL, NULL, NULL, '2025-11-20 10:00:00+00', '2025-11-20 10:00:00+00',
 'a1b2c3d4-1111-4000-8000-000000000001', 'a1b2c3d4-1111-4000-8000-000000000001'),

-- Additional cardholder profiles (2-14) — mix of wallet states for variety
('55555555-5555-4000-8000-000000000010', 'a1b2c3d4-1111-4000-8000-000000000010',
 NULL, NULL, NULL, '2025-11-21 10:00:00+00', '2025-11-21 10:00:00+00',
 'a1b2c3d4-1111-4000-8000-000000000010', 'a1b2c3d4-1111-4000-8000-000000000010'),

('55555555-5555-4000-8000-000000000011', 'a1b2c3d4-1111-4000-8000-000000000011',
 NULL, NULL, NULL, '2025-11-22 10:00:00+00', '2025-11-22 10:00:00+00',
 'a1b2c3d4-1111-4000-8000-000000000011', 'a1b2c3d4-1111-4000-8000-000000000011'),

-- Has Apple Wallet only → banner hidden
('55555555-5555-4000-8000-000000000012', 'a1b2c3d4-1111-4000-8000-000000000012',
 NULL, '2025-11-23 12:00:00+00', NULL, '2025-11-23 10:00:00+00', '2025-11-23 12:00:00+00',
 'a1b2c3d4-1111-4000-8000-000000000012', 'a1b2c3d4-1111-4000-8000-000000000012'),

-- Has Google Wallet only → banner hidden
('55555555-5555-4000-8000-000000000013', 'a1b2c3d4-1111-4000-8000-000000000013',
 NULL, NULL, '2025-11-24 12:00:00+00', '2025-11-24 10:00:00+00', '2025-11-24 12:00:00+00',
 'a1b2c3d4-1111-4000-8000-000000000013', 'a1b2c3d4-1111-4000-8000-000000000013'),

-- Has both wallets → banner hidden
('55555555-5555-4000-8000-000000000014', 'a1b2c3d4-1111-4000-8000-000000000014',
 NULL, '2025-11-25 12:00:00+00', '2025-11-25 12:30:00+00', '2025-11-25 10:00:00+00', '2025-11-25 12:30:00+00',
 'a1b2c3d4-1111-4000-8000-000000000014', 'a1b2c3d4-1111-4000-8000-000000000014'),

('55555555-5555-4000-8000-000000000015', 'a1b2c3d4-1111-4000-8000-000000000015',
 NULL, NULL, NULL, '2025-11-26 10:00:00+00', '2025-11-26 10:00:00+00',
 'a1b2c3d4-1111-4000-8000-000000000015', 'a1b2c3d4-1111-4000-8000-000000000015'),

('55555555-5555-4000-8000-000000000016', 'a1b2c3d4-1111-4000-8000-000000000016',
 NULL, NULL, NULL, '2025-11-27 10:00:00+00', '2025-11-27 10:00:00+00',
 'a1b2c3d4-1111-4000-8000-000000000016', 'a1b2c3d4-1111-4000-8000-000000000016'),

('55555555-5555-4000-8000-000000000017', 'a1b2c3d4-1111-4000-8000-000000000017',
 NULL, NULL, NULL, '2025-11-28 10:00:00+00', '2025-11-28 10:00:00+00',
 'a1b2c3d4-1111-4000-8000-000000000017', 'a1b2c3d4-1111-4000-8000-000000000017'),

('55555555-5555-4000-8000-000000000018', 'a1b2c3d4-1111-4000-8000-000000000018',
 NULL, NULL, NULL, '2025-11-29 10:00:00+00', '2025-11-29 10:00:00+00',
 'a1b2c3d4-1111-4000-8000-000000000018', 'a1b2c3d4-1111-4000-8000-000000000018'),

('55555555-5555-4000-8000-000000000019', 'a1b2c3d4-1111-4000-8000-000000000019',
 NULL, NULL, NULL, '2025-11-30 10:00:00+00', '2025-11-30 10:00:00+00',
 'a1b2c3d4-1111-4000-8000-000000000019', 'a1b2c3d4-1111-4000-8000-000000000019'),

('55555555-5555-4000-8000-000000000020', 'a1b2c3d4-1111-4000-8000-000000000020',
 NULL, NULL, NULL, '2025-12-01 10:00:00+00', '2025-12-01 10:00:00+00',
 'a1b2c3d4-1111-4000-8000-000000000020', 'a1b2c3d4-1111-4000-8000-000000000020'),

('55555555-5555-4000-8000-000000000021', 'a1b2c3d4-1111-4000-8000-000000000021',
 NULL, NULL, NULL, '2025-12-02 10:00:00+00', '2025-12-02 10:00:00+00',
 'a1b2c3d4-1111-4000-8000-000000000021', 'a1b2c3d4-1111-4000-8000-000000000021'),

('55555555-5555-4000-8000-000000000022', 'a1b2c3d4-1111-4000-8000-000000000022',
 NULL, NULL, NULL, '2025-12-03 10:00:00+00', '2025-12-03 10:00:00+00',
 'a1b2c3d4-1111-4000-8000-000000000022', 'a1b2c3d4-1111-4000-8000-000000000022'),

-- Digital cardholder profiles (15-17) — has Apple wallet (typical iOS digital flow)
('55555555-5555-4000-8000-000000000030', 'a1b2c3d4-1111-4000-8000-000000000030',
 NULL, '2025-12-04 10:00:00+00', NULL, '2025-12-04 09:30:00+00', '2025-12-04 10:00:00+00',
 'a1b2c3d4-1111-4000-8000-000000000030', 'a1b2c3d4-1111-4000-8000-000000000030'),

('55555555-5555-4000-8000-000000000031', 'a1b2c3d4-1111-4000-8000-000000000031',
 NULL, NULL, NULL, '2025-12-08 11:00:00+00', '2025-12-08 11:00:00+00',
 'a1b2c3d4-1111-4000-8000-000000000031', 'a1b2c3d4-1111-4000-8000-000000000031'),

('55555555-5555-4000-8000-000000000032', 'a1b2c3d4-1111-4000-8000-000000000032',
 NULL, NULL, '2025-12-09 16:00:00+00', '2025-12-09 15:30:00+00', '2025-12-09 16:00:00+00',
 'a1b2c3d4-1111-4000-8000-000000000032', 'a1b2c3d4-1111-4000-8000-000000000032');

-- ============================================================
-- SECTION 8: SEQUENCE RESETS
-- ============================================================

SELECT pg_catalog.setval('"auth"."refresh_tokens_id_seq"', 10, true);
SELECT pg_catalog.setval('"public"."billing_customers_id_seq"', 1, false);
SELECT pg_catalog.setval('"public"."invitations_id_seq"', 1, false);
SELECT pg_catalog.setval('"public"."role_permissions_id_seq"', 20, true);
SELECT pg_catalog.setval('"supabase_functions"."hooks_id_seq"', 1, true);

-- ============================================================
-- SECTION 8.5: BATCHES
-- ============================================================
-- Create card batches for organizations before inserting cards

-- Set card prefixes for organizations
UPDATE "public"."accounts"
SET "card_prefix" = 'TIGER'
WHERE "id" = '11111111-1111-4000-8000-000000000001';

UPDATE "public"."accounts"
SET "card_prefix" = 'EAGLE'
WHERE "id" = '11111111-1111-4000-8000-000000000002';

-- Create batches for Tiger Athletics
INSERT INTO "public"."batches" (
    "id", "name", "prefix", "organization_id", "created_at", "created_by"
) VALUES
('bbbbbbbb-0001-4000-8000-000000000001', 'Fall 2025 Batch', 'TIGER1', '11111111-1111-4000-8000-000000000001',
 '2025-11-01 10:00:00+00', 'b2c3d4e5-2222-4000-8000-000000000002'),
('bbbbbbbb-0001-4000-8000-000000000002', 'Winter 2025 Batch', 'TIGER2', '11111111-1111-4000-8000-000000000001',
 '2025-12-01 10:00:00+00', 'b2c3d4e5-2222-4000-8000-000000000002'),

-- Create batches for Eagle Foundation
('bbbbbbbb-0002-4000-8000-000000000001', 'Charity Drive 2025', 'EAGLE1', '11111111-1111-4000-8000-000000000002',
 '2025-11-15 10:00:00+00', 'b2c3d4e5-2222-4000-8000-000000000010'),
('bbbbbbbb-0002-4000-8000-000000000002', 'Holiday Campaign', 'EAGLE2', '11111111-1111-4000-8000-000000000002',
 '2025-12-05 10:00:00+00', 'b2c3d4e5-2222-4000-8000-000000000010');

-- ============================================================
-- SECTION 9: CARDS
-- ============================================================
-- Cards with varied usage patterns for donut chart:
-- - no_usage: Cards 5-7, 11-14, 18-20 (10 cards) = ~34%
-- - used_1_time: Cards 2, 8, 15 (3 cards) = ~10%
-- - used_2_times: Cards 3, 9, 16 (3 cards) = ~10%
-- - used_3_times: Cards 4, 10, 17 (3 cards) = ~10%
-- - used_4_plus_times: Cards 1 (1 card with 8 redemptions) = ~3%
-- Additional pending/cancelled cards for variety

INSERT INTO "public"."cards" (
    "id", "card_number", "status", "organization_id", "distributor_id", "cardholder_id",
    "price_cents", "payment_type", "stripe_payment_intent_id", "activated_at", "expires_at",
    "paid_at", "batch_id", "created_at", "updated_at", "created_by", "updated_by"
) VALUES
-- ============================================================
-- TIGER ATHLETICS CARDS (Organization 1)
-- ============================================================
-- Spread payments over 6 months for revenue chart (Jul-Dec 2025)

-- Card 1: 4+ redemptions (heavy user) - Paid in July
('cccccccc-0001-4000-8000-000000000001', 1, 'activated',
 '11111111-1111-4000-8000-000000000001', 'c3d4e5f6-3333-4000-8000-000000000003',
 'a1b2c3d4-1111-4000-8000-000000000001', 2500, 'stripe', 'pi_test_001',
 '2025-11-20 10:00:00+00', '2026-11-20 10:00:00+00',
 '2025-07-15 10:00:00+00',
 'bbbbbbbb-0001-4000-8000-000000000001',
 '2025-11-15 10:00:00+00', '2025-11-20 10:00:00+00',
 'c3d4e5f6-3333-4000-8000-000000000003', 'a1b2c3d4-1111-4000-8000-000000000001'),

-- Card 2: 1 redemption - Paid in August
('cccccccc-0001-4000-8000-000000000002', 2, 'activated',
 '11111111-1111-4000-8000-000000000001', 'c3d4e5f6-3333-4000-8000-000000000003',
 'a1b2c3d4-1111-4000-8000-000000000010', 2500, 'stripe', 'pi_test_002',
 '2025-11-21 10:00:00+00', '2026-11-21 10:00:00+00',
 '2025-08-10 10:00:00+00',
 'bbbbbbbb-0001-4000-8000-000000000001',
 '2025-11-16 10:00:00+00', '2025-11-21 10:00:00+00',
 'c3d4e5f6-3333-4000-8000-000000000003', 'a1b2c3d4-1111-4000-8000-000000000010'),

-- Card 3: 2 redemptions - Paid in August
('cccccccc-0001-4000-8000-000000000003', 3, 'activated',
 '11111111-1111-4000-8000-000000000001', 'c3d4e5f6-3333-4000-8000-000000000003',
 'a1b2c3d4-1111-4000-8000-000000000011', 2500, 'stripe', 'pi_test_003',
 '2025-11-22 10:00:00+00', '2026-11-22 10:00:00+00',
 '2025-08-20 10:00:00+00',
 'bbbbbbbb-0001-4000-8000-000000000001',
 '2025-11-17 10:00:00+00', '2025-11-22 10:00:00+00',
 'c3d4e5f6-3333-4000-8000-000000000003', 'a1b2c3d4-1111-4000-8000-000000000011'),

-- Card 4: 3 redemptions - Paid in September
('cccccccc-0001-4000-8000-000000000004', 4, 'activated',
 '11111111-1111-4000-8000-000000000001', 'c3d4e5f6-3333-4000-8000-000000000003',
 'a1b2c3d4-1111-4000-8000-000000000012', 2500, 'stripe', 'pi_test_004',
 '2025-11-23 10:00:00+00', '2026-11-23 10:00:00+00',
 '2025-09-05 10:00:00+00',
 'bbbbbbbb-0001-4000-8000-000000000001',
 '2025-11-18 10:00:00+00', '2025-11-23 10:00:00+00',
 'c3d4e5f6-3333-4000-8000-000000000003', 'a1b2c3d4-1111-4000-8000-000000000012'),

-- Cards 5-7: No usage (0 redemptions) - Paid in October
('cccccccc-0001-4000-8000-000000000005', 5, 'activated',
 '11111111-1111-4000-8000-000000000001', 'c3d4e5f6-3333-4000-8000-000000000003',
 'a1b2c3d4-1111-4000-8000-000000000013', 2500, 'stripe', 'pi_test_005',
 '2025-11-24 10:00:00+00', '2026-11-24 10:00:00+00',
 '2025-10-12 10:00:00+00',
 'bbbbbbbb-0001-4000-8000-000000000001',
 '2025-11-19 10:00:00+00', '2025-11-24 10:00:00+00',
 'c3d4e5f6-3333-4000-8000-000000000003', 'a1b2c3d4-1111-4000-8000-000000000013'),

('cccccccc-0001-4000-8000-000000000006', 6, 'activated',
 '11111111-1111-4000-8000-000000000001', 'c3d4e5f6-3333-4000-8000-000000000003',
 'a1b2c3d4-1111-4000-8000-000000000014', 2500, 'stripe', 'pi_test_006',
 '2025-11-25 10:00:00+00', '2026-11-25 10:00:00+00',
 '2025-10-18 10:00:00+00',
 'bbbbbbbb-0001-4000-8000-000000000001',
 '2025-11-20 10:00:00+00', '2025-11-25 10:00:00+00',
 'c3d4e5f6-3333-4000-8000-000000000003', 'a1b2c3d4-1111-4000-8000-000000000014'),

('cccccccc-0001-4000-8000-000000000007', 7, 'activated',
 '11111111-1111-4000-8000-000000000001', 'c3d4e5f6-3333-4000-8000-000000000003',
 'a1b2c3d4-1111-4000-8000-000000000015', 2500, 'stripe', 'pi_test_007',
 '2025-11-26 10:00:00+00', '2026-11-26 10:00:00+00',
 '2025-11-03 10:00:00+00',
 'bbbbbbbb-0001-4000-8000-000000000002',
 '2025-11-21 10:00:00+00', '2025-11-26 10:00:00+00',
 'c3d4e5f6-3333-4000-8000-000000000003', 'a1b2c3d4-1111-4000-8000-000000000015'),

-- Pending cards (Tiger Athletics - Winter Batch) - No paid_at
('cccccccc-0001-4000-8000-000000000008', 8, 'pending',
 '11111111-1111-4000-8000-000000000001', 'c3d4e5f6-3333-4000-8000-000000000003',
 NULL, 2500, 'stripe', 'pi_test_008',
 NULL, NULL, NULL,
 'bbbbbbbb-0001-4000-8000-000000000002',
 '2025-12-01 10:00:00+00', '2025-12-01 10:00:00+00',
 'c3d4e5f6-3333-4000-8000-000000000003', 'c3d4e5f6-3333-4000-8000-000000000003'),

('cccccccc-0001-4000-8000-000000000009', 9, 'pending',
 '11111111-1111-4000-8000-000000000001', 'c3d4e5f6-3333-4000-8000-000000000003',
 NULL, 2500, 'stripe', 'pi_test_009',
 NULL, NULL, NULL,
 'bbbbbbbb-0001-4000-8000-000000000002',
 '2025-12-01 10:00:00+00', '2025-12-01 10:00:00+00',
 'c3d4e5f6-3333-4000-8000-000000000003', 'c3d4e5f6-3333-4000-8000-000000000003'),

-- Cancelled card - No paid_at
('cccccccc-0001-4000-8000-000000000010', 10, 'cancelled',
 '11111111-1111-4000-8000-000000000001', NULL,
 NULL, 0, 'stripe', NULL,
 NULL, NULL, NULL,
 'bbbbbbbb-0001-4000-8000-000000000001',
 '2025-11-01 10:00:00+00', '2025-11-05 10:00:00+00',
 'b2c3d4e5-2222-4000-8000-000000000002', 'b2c3d4e5-2222-4000-8000-000000000002'),

-- ============================================================
-- EAGLE FOUNDATION CARDS (Organization 2)
-- ============================================================
-- Spread payments over months for revenue chart

-- Card 11: 1 redemption - Paid in September
('cccccccc-0002-4000-8000-000000000001', 1, 'activated',
 '11111111-1111-4000-8000-000000000002', 'c3d4e5f6-3333-4000-8000-000000000010',
 'a1b2c3d4-1111-4000-8000-000000000016', 3000, 'stripe', 'pi_test_011',
 '2025-11-27 10:00:00+00', '2026-11-27 10:00:00+00',
 '2025-09-15 10:00:00+00',
 'bbbbbbbb-0002-4000-8000-000000000001',
 '2025-11-22 10:00:00+00', '2025-11-27 10:00:00+00',
 'c3d4e5f6-3333-4000-8000-000000000010', 'a1b2c3d4-1111-4000-8000-000000000016'),

-- Card 12: 2 redemptions - Paid in October
('cccccccc-0002-4000-8000-000000000002', 2, 'activated',
 '11111111-1111-4000-8000-000000000002', 'c3d4e5f6-3333-4000-8000-000000000010',
 'a1b2c3d4-1111-4000-8000-000000000017', 3000, 'stripe', 'pi_test_012',
 '2025-11-28 10:00:00+00', '2026-11-28 10:00:00+00',
 '2025-10-08 10:00:00+00',
 'bbbbbbbb-0002-4000-8000-000000000001',
 '2025-11-23 10:00:00+00', '2025-11-28 10:00:00+00',
 'c3d4e5f6-3333-4000-8000-000000000010', 'a1b2c3d4-1111-4000-8000-000000000017'),

-- Card 13: 3 redemptions - Paid in November
('cccccccc-0002-4000-8000-000000000003', 3, 'activated',
 '11111111-1111-4000-8000-000000000002', 'c3d4e5f6-3333-4000-8000-000000000010',
 'a1b2c3d4-1111-4000-8000-000000000018', 3000, 'stripe', 'pi_test_013',
 '2025-11-29 10:00:00+00', '2026-11-29 10:00:00+00',
 '2025-11-12 10:00:00+00',
 'bbbbbbbb-0002-4000-8000-000000000001',
 '2025-11-24 10:00:00+00', '2025-11-29 10:00:00+00',
 'c3d4e5f6-3333-4000-8000-000000000010', 'a1b2c3d4-1111-4000-8000-000000000018'),

-- Cards 14-17: No usage - Paid in November and December
('cccccccc-0002-4000-8000-000000000004', 4, 'activated',
 '11111111-1111-4000-8000-000000000002', 'c3d4e5f6-3333-4000-8000-000000000010',
 'a1b2c3d4-1111-4000-8000-000000000019', 3000, 'stripe', 'pi_test_014',
 '2025-11-30 10:00:00+00', '2026-11-30 10:00:00+00',
 '2025-11-20 10:00:00+00',
 'bbbbbbbb-0002-4000-8000-000000000001',
 '2025-11-25 10:00:00+00', '2025-11-30 10:00:00+00',
 'c3d4e5f6-3333-4000-8000-000000000010', 'a1b2c3d4-1111-4000-8000-000000000019'),

('cccccccc-0002-4000-8000-000000000005', 5, 'activated',
 '11111111-1111-4000-8000-000000000002', 'c3d4e5f6-3333-4000-8000-000000000010',
 'a1b2c3d4-1111-4000-8000-000000000020', 3000, 'stripe', 'pi_test_015',
 '2025-12-01 10:00:00+00', '2026-12-01 10:00:00+00',
 '2025-11-25 10:00:00+00',
 'bbbbbbbb-0002-4000-8000-000000000002',
 '2025-11-26 10:00:00+00', '2025-12-01 10:00:00+00',
 'c3d4e5f6-3333-4000-8000-000000000010', 'a1b2c3d4-1111-4000-8000-000000000020'),

('cccccccc-0002-4000-8000-000000000006', 6, 'activated',
 '11111111-1111-4000-8000-000000000002', 'c3d4e5f6-3333-4000-8000-000000000010',
 'a1b2c3d4-1111-4000-8000-000000000021', 3000, 'stripe', 'pi_test_016',
 '2025-12-02 10:00:00+00', '2026-12-02 10:00:00+00',
 '2025-12-01 10:00:00+00',
 'bbbbbbbb-0002-4000-8000-000000000002',
 '2025-11-27 10:00:00+00', '2025-12-02 10:00:00+00',
 'c3d4e5f6-3333-4000-8000-000000000010', 'a1b2c3d4-1111-4000-8000-000000000021'),

('cccccccc-0002-4000-8000-000000000007', 7, 'activated',
 '11111111-1111-4000-8000-000000000002', 'c3d4e5f6-3333-4000-8000-000000000010',
 'a1b2c3d4-1111-4000-8000-000000000022', 3000, 'stripe', 'pi_test_017',
 '2025-12-03 10:00:00+00', '2026-12-03 10:00:00+00',
 '2025-12-05 10:00:00+00',
 'bbbbbbbb-0002-4000-8000-000000000002',
 '2025-11-28 10:00:00+00', '2025-12-03 10:00:00+00',
 'c3d4e5f6-3333-4000-8000-000000000010', 'a1b2c3d4-1111-4000-8000-000000000022'),

-- Pending cards (Eagle Foundation) - No paid_at
('cccccccc-0002-4000-8000-000000000008', 8, 'pending',
 '11111111-1111-4000-8000-000000000002', 'c3d4e5f6-3333-4000-8000-000000000010',
 NULL, 3000, 'stripe', 'pi_test_018',
 NULL, NULL, NULL,
 'bbbbbbbb-0002-4000-8000-000000000002',
 '2025-12-05 10:00:00+00', '2025-12-05 10:00:00+00',
 'c3d4e5f6-3333-4000-8000-000000000010', 'c3d4e5f6-3333-4000-8000-000000000010'),

('cccccccc-0002-4000-8000-000000000009', 9, 'pending',
 '11111111-1111-4000-8000-000000000002', 'c3d4e5f6-3333-4000-8000-000000000010',
 NULL, 3000, 'stripe', 'pi_test_019',
 NULL, NULL, NULL,
 'bbbbbbbb-0002-4000-8000-000000000002',
 '2025-12-05 10:00:00+00', '2025-12-05 10:00:00+00',
 'c3d4e5f6-3333-4000-8000-000000000010', 'c3d4e5f6-3333-4000-8000-000000000010');

-- ============================================================
-- SECTION 9.5: DIGITAL CARDS
-- ============================================================
-- Digital cards mirror the physical line but live without batch_id /
-- card_number. They are bought via /activate/d/<distributor-slug>, paid
-- through Stripe, and claimed via claim_token at /activate/<token>.
--
-- Constraints from 20260508100446_m6-digital-cards.sql:
--   * card_type='digital' requires claim_token, digital_card_number, and
--     batch_id IS NULL.
--   * digital_card_number is unique per (organization_id) for digital cards.

INSERT INTO "public"."cards" (
    "id", "card_number", "status", "organization_id", "distributor_id", "cardholder_id",
    "price_cents", "payment_type", "stripe_payment_intent_id", "activated_at", "expires_at",
    "paid_at", "purchased_at", "batch_id",
    "card_type", "claim_token", "digital_card_number", "buyer_email",
    "created_at", "updated_at", "created_by", "updated_by"
) VALUES
-- Tiger Athletics digital #1 — activated by digital-cardholder1.
('cccccccc-0d01-4000-8000-000000000001', NULL, 'activated',
 '11111111-1111-4000-8000-000000000001', 'c3d4e5f6-3333-4000-8000-000000000003',
 'a1b2c3d4-1111-4000-8000-000000000030', 2500, 'stripe', 'pi_test_d001',
 '2025-12-04 09:30:00+00', '2026-12-04 09:30:00+00',
 '2025-12-04 09:25:00+00', '2025-12-04 09:25:00+00', NULL,
 'digital', 'seed-tiger-d1', 1, 'digital-cardholder1@tailgate.dev',
 '2025-12-04 09:25:00+00', '2025-12-04 09:30:00+00',
 'c3d4e5f6-3333-4000-8000-000000000003', 'a1b2c3d4-1111-4000-8000-000000000030'),

-- Tiger Athletics digital #2 — activated by digital-cardholder2.
('cccccccc-0d01-4000-8000-000000000002', NULL, 'activated',
 '11111111-1111-4000-8000-000000000001', 'c3d4e5f6-3333-4000-8000-000000000003',
 'a1b2c3d4-1111-4000-8000-000000000031', 2500, 'stripe', 'pi_test_d002',
 '2025-12-08 11:00:00+00', '2026-12-08 11:00:00+00',
 '2025-12-08 10:55:00+00', '2025-12-08 10:55:00+00', NULL,
 'digital', 'seed-tiger-d2', 2, 'digital-cardholder2@tailgate.dev',
 '2025-12-08 10:55:00+00', '2025-12-08 11:00:00+00',
 'c3d4e5f6-3333-4000-8000-000000000003', 'a1b2c3d4-1111-4000-8000-000000000031'),

-- Tiger Athletics digital #3 — paid but unclaimed (exercises /activate/<token>).
('cccccccc-0d01-4000-8000-000000000003', NULL, 'paid',
 '11111111-1111-4000-8000-000000000001', 'c3d4e5f6-3333-4000-8000-000000000003',
 NULL, 2500, 'stripe', 'pi_test_d003',
 NULL, NULL,
 '2025-12-10 14:20:00+00', '2025-12-10 14:20:00+00', NULL,
 'digital', 'seed-tiger-d3', 3, 'unclaimed-buyer@example.dev',
 '2025-12-10 14:20:00+00', '2025-12-10 14:20:00+00',
 'c3d4e5f6-3333-4000-8000-000000000003', 'c3d4e5f6-3333-4000-8000-000000000003'),

-- Eagle Foundation digital #1 — activated by digital-cardholder3, drives the second-org distributor revenue tile.
('cccccccc-0d02-4000-8000-000000000001', NULL, 'activated',
 '11111111-1111-4000-8000-000000000002', 'c3d4e5f6-3333-4000-8000-000000000010',
 'a1b2c3d4-1111-4000-8000-000000000032', 3000, 'stripe', 'pi_test_d004',
 '2025-12-09 15:30:00+00', '2026-12-09 15:30:00+00',
 '2025-12-09 15:25:00+00', '2025-12-09 15:25:00+00', NULL,
 'digital', 'seed-eagle-d1', 1, 'digital-cardholder3@tailgate.dev',
 '2025-12-09 15:25:00+00', '2025-12-09 15:30:00+00',
 'c3d4e5f6-3333-4000-8000-000000000010', 'a1b2c3d4-1111-4000-8000-000000000032');

-- ============================================================
-- SECTION 9.6: DIGITAL CARD COUNTERS
-- ============================================================
-- next_digital_card_number(p_org) returns the value stored here and
-- increments. Set per-org so subsequent create_digital_card calls keep
-- numbering monotonically after the seeded digital cards above.

INSERT INTO "public"."organization_digital_card_counters" (
    "organization_id", "next_number", "updated_at"
) VALUES
('11111111-1111-4000-8000-000000000001', 4, '2025-12-10 14:20:00+00'),
('11111111-1111-4000-8000-000000000002', 2, '2025-12-09 15:30:00+00');

-- ============================================================
-- SECTION 10: DISCOUNTS
-- ============================================================
-- Discounts are created by merchants. Visibility to cardholders is determined
-- EXCLUSIVELY by organization_merchant_partnerships (admin-paired).
-- City matching is NOT used. Only one active discount per merchant.
--
-- VISIBILITY TEST MATRIX (for cardholder@tailgate.dev / Tiger Athletics):
-- | Merchant           | Partnership | Discount State | Result              |
-- |--------------------|-------------|----------------|---------------------|
-- | GameDay Grill      | YES         | Active         | VISIBLE             |
-- | Orlando Coffee     | YES         | Active         | VISIBLE             |
-- | Miami Sports Bar   | NO          | Active         | HIDDEN (no partner) |
-- | Sunset Smoothies   | YES         | Expired        | HIDDEN (expired)    |
-- | Campus Bookstore   | YES         | Inactive       | HIDDEN (deactivated)|
--
-- For Eagle Foundation cardholders:
-- | Merchant           | Partnership | Discount State | Result              |
-- |--------------------|-------------|----------------|---------------------|
-- | GameDay Grill      | YES         | Active         | VISIBLE             |
-- | Orlando Coffee     | NO          | Active         | HIDDEN (no partner) |
-- | Miami Sports Bar   | NO          | Active         | HIDDEN (no partner) |
-- | Sunset Smoothies   | NO          | Expired        | HIDDEN (both)       |
-- | Campus Bookstore   | NO          | Inactive       | HIDDEN (both)       |

INSERT INTO "public"."discounts" (
    "id", "merchant_id", "title", "description", "terms",
    "valid_from", "valid_until",
    "category", "tags", "is_active",
    "created_at", "updated_at", "created_by", "updated_by"
) VALUES
-- GameDay Grill discount — active, partnered with Tiger + Eagle → VISIBLE to both
('dddddddd-0001-4000-8000-000000000001', '22222222-2222-4000-8000-000000000002',
 '20% Off All Food', 'Get 20% off your entire food order at GameDay Grill!',
 'Valid on food items only. Cannot be combined with other offers. Dine-in only.',
 '2025-11-01 00:00:00+00', '2026-12-31 23:59:59+00',
 'Food & Drink', ARRAY['food', 'discount', 'dining'], true,
 '2025-11-01 10:00:00+00', '2025-11-01 10:00:00+00',
 'd4e5f6a7-4444-4000-8000-000000000004', 'd4e5f6a7-4444-4000-8000-000000000004'),

-- Orlando Coffee House discount — active, partnered with Tiger only → VISIBLE to Tiger, HIDDEN from Eagle
('dddddddd-0001-4000-8000-000000000002', '22222222-2222-4000-8000-000000000003',
 '15% Off All Drinks', 'Get 15% off any beverage at Orlando Coffee House!',
 'Valid on all drinks. Cannot be combined with other offers.',
 '2025-11-01 00:00:00+00', '2026-12-31 23:59:59+00',
 'Food & Drink', ARRAY['coffee', 'drinks', 'discount'], true,
 '2025-11-01 10:00:00+00', '2025-11-01 10:00:00+00',
 'd4e5f6a7-4444-4000-8000-000000000004', 'd4e5f6a7-4444-4000-8000-000000000004'),

-- Miami Sports Bar discount — active, NO partnership → HIDDEN (same city but no partnership)
('dddddddd-0001-4000-8000-000000000003', '22222222-2222-4000-8000-000000000004',
 'Happy Hour 2-for-1', 'Buy one get one free on all appetizers during happy hour!',
 'Valid Mon-Fri 4-7pm only. Dine-in only.',
 '2025-11-01 00:00:00+00', '2026-12-31 23:59:59+00',
 'Food & Drink', ARRAY['happy-hour', 'bar', 'appetizers'], true,
 '2025-11-01 10:00:00+00', '2025-11-01 10:00:00+00',
 'd4e5f6a7-4444-4000-8000-000000000004', 'd4e5f6a7-4444-4000-8000-000000000004'),

-- Sunset Smoothies discount — EXPIRED, partnered with Tiger → HIDDEN (expired despite partnership)
('dddddddd-0001-4000-8000-000000000004', '22222222-2222-4000-8000-000000000005',
 '10% Off Smoothies', 'Get 10% off any smoothie at Sunset Smoothies!',
 'Valid on all smoothies. One per visit.',
 '2025-08-01 00:00:00+00', '2025-10-31 23:59:59+00',
 'Food & Drink', ARRAY['smoothies', 'drinks', 'healthy'], true,
 '2025-08-01 10:00:00+00', '2025-08-01 10:00:00+00',
 'd4e5f6a7-4444-4000-8000-000000000004', 'd4e5f6a7-4444-4000-8000-000000000004'),

-- Campus Bookstore discount — INACTIVE (is_active=false), partnered with Tiger → HIDDEN (deactivated)
('dddddddd-0001-4000-8000-000000000005', '22222222-2222-4000-8000-000000000006',
 '15% Off School Supplies', 'Get 15% off all school supplies at Campus Bookstore!',
 'Valid on school supplies only. Cannot be combined with other offers.',
 '2025-11-01 00:00:00+00', '2026-12-31 23:59:59+00',
 'Shopping', ARRAY['books', 'supplies', 'school'], false,
 '2025-11-01 10:00:00+00', '2025-11-01 10:00:00+00',
 'd4e5f6a7-4444-4000-8000-000000000004', 'd4e5f6a7-4444-4000-8000-000000000004');

-- ============================================================
-- SECTION 10.5: ORGANIZATION-MERCHANT PARTNERSHIPS
-- ============================================================
-- Partnerships are the ONLY mechanism that controls discount visibility.
-- Super admins manually pair merchants with organizations.
-- City matching is NOT used — same-city merchants without a partnership row are hidden.
--
-- NOT PAIRED (intentionally):
--   - Miami Sports Bar ↔ any org (tests: same city, no partnership → hidden)
--   - Orlando Coffee House ↔ Eagle Foundation (tests: no partnership → hidden)

INSERT INTO "public"."organization_merchant_partnerships" (
    "id", "organization_id", "merchant_id", "created_at", "created_by"
) VALUES
-- Tiger Athletics ↔ GameDay Grill
('eeeeeeee-0001-4000-8000-000000000001', '11111111-1111-4000-8000-000000000001', '22222222-2222-4000-8000-000000000002',
 '2025-11-20 10:00:00+00', 'b2c3d4e5-2222-4000-8000-000000000002'),

-- Tiger Athletics ↔ Orlando Coffee House
('eeeeeeee-0001-4000-8000-000000000002', '11111111-1111-4000-8000-000000000001', '22222222-2222-4000-8000-000000000003',
 '2025-11-20 10:00:00+00', 'b2c3d4e5-2222-4000-8000-000000000002'),

-- Tiger Athletics ↔ Sunset Smoothies (discount is expired but partnership exists)
('eeeeeeee-0001-4000-8000-000000000004', '11111111-1111-4000-8000-000000000001', '22222222-2222-4000-8000-000000000005',
 '2025-11-20 10:00:00+00', 'b2c3d4e5-2222-4000-8000-000000000002'),

-- Tiger Athletics ↔ Campus Bookstore (discount is inactive but partnership exists)
('eeeeeeee-0001-4000-8000-000000000005', '11111111-1111-4000-8000-000000000001', '22222222-2222-4000-8000-000000000006',
 '2025-11-20 10:00:00+00', 'b2c3d4e5-2222-4000-8000-000000000002'),

-- Eagle Foundation ↔ GameDay Grill
('eeeeeeee-0001-4000-8000-000000000003', '11111111-1111-4000-8000-000000000002', '22222222-2222-4000-8000-000000000002',
 '2025-11-20 10:00:00+00', 'b2c3d4e5-2222-4000-8000-000000000010');

-- ============================================================
-- SECTION 11: REDEMPTIONS
-- ============================================================
-- Redemptions track when cardholders use discounts at merchants.
-- Distribution designed to create varied donut chart:
-- - Card 1: 5 redemptions (4+ category)
-- - Card 2: 1 redemption
-- - Card 3: 2 redemptions
-- - Card 4: 3 redemptions
-- - Cards 5-7: 0 redemptions (no_usage)
-- - Card 11 (Eagle): 1 redemption
-- - Card 12 (Eagle): 2 redemptions
-- - Card 13 (Eagle): 3 redemptions
-- - Cards 14-17 (Eagle): 0 redemptions (no_usage)

INSERT INTO "public"."redemptions" (
    "id", "card_id", "discount_id", "merchant_id", "validated_by",
    "status", "redeemed_at", "refunded_at", "refund_reason",
    "created_at", "updated_at", "created_by", "updated_by"
) VALUES
-- ============================================================
-- CARD 1 REDEMPTIONS (5 completed = 4+ category)
-- ============================================================
('eeeeeeee-0001-4000-8000-000000000001', 'cccccccc-0001-4000-8000-000000000001',
 'dddddddd-0001-4000-8000-000000000001', '22222222-2222-4000-8000-000000000002',
 'e5f6a7b8-5555-4000-8000-000000000005', 'completed',
 '2025-11-22 14:30:00+00', NULL, NULL,
 '2025-11-22 14:30:00+00', '2025-11-22 14:30:00+00',
 'e5f6a7b8-5555-4000-8000-000000000005', 'e5f6a7b8-5555-4000-8000-000000000005'),

('eeeeeeee-0001-4000-8000-000000000002', 'cccccccc-0001-4000-8000-000000000001',
 'dddddddd-0001-4000-8000-000000000001', '22222222-2222-4000-8000-000000000002',
 'e5f6a7b8-5555-4000-8000-000000000005', 'completed',
 '2025-11-23 12:15:00+00', NULL, NULL,
 '2025-11-23 12:15:00+00', '2025-11-23 12:15:00+00',
 'e5f6a7b8-5555-4000-8000-000000000005', 'e5f6a7b8-5555-4000-8000-000000000005'),

('eeeeeeee-0001-4000-8000-000000000003', 'cccccccc-0001-4000-8000-000000000001',
 'dddddddd-0001-4000-8000-000000000001', '22222222-2222-4000-8000-000000000002',
 'd4e5f6a7-4444-4000-8000-000000000004', 'completed',
 '2025-11-24 18:45:00+00', NULL, NULL,
 '2025-11-24 18:45:00+00', '2025-11-24 18:45:00+00',
 'd4e5f6a7-4444-4000-8000-000000000004', 'd4e5f6a7-4444-4000-8000-000000000004'),

('eeeeeeee-0001-4000-8000-000000000004', 'cccccccc-0001-4000-8000-000000000001',
 'dddddddd-0001-4000-8000-000000000001', '22222222-2222-4000-8000-000000000002',
 'e5f6a7b8-5555-4000-8000-000000000005', 'completed',
 '2025-11-25 19:30:00+00', NULL, NULL,
 '2025-11-25 19:30:00+00', '2025-11-25 19:30:00+00',
 'e5f6a7b8-5555-4000-8000-000000000005', 'e5f6a7b8-5555-4000-8000-000000000005'),

('eeeeeeee-0001-4000-8000-000000000005', 'cccccccc-0001-4000-8000-000000000001',
 'dddddddd-0001-4000-8000-000000000001', '22222222-2222-4000-8000-000000000002',
 'e5f6a7b8-5555-4000-8000-000000000005', 'completed',
 '2025-11-26 17:00:00+00', NULL, NULL,
 '2025-11-26 17:00:00+00', '2025-11-26 17:00:00+00',
 'e5f6a7b8-5555-4000-8000-000000000005', 'e5f6a7b8-5555-4000-8000-000000000005'),

-- ============================================================
-- CARD 2 REDEMPTIONS (1 = used_1_time category)
-- ============================================================
('eeeeeeee-0002-4000-8000-000000000001', 'cccccccc-0001-4000-8000-000000000002',
 'dddddddd-0001-4000-8000-000000000001', '22222222-2222-4000-8000-000000000002',
 'e5f6a7b8-5555-4000-8000-000000000005', 'completed',
 '2025-11-22 15:00:00+00', NULL, NULL,
 '2025-11-22 15:00:00+00', '2025-11-22 15:00:00+00',
 'e5f6a7b8-5555-4000-8000-000000000005', 'e5f6a7b8-5555-4000-8000-000000000005'),

-- ============================================================
-- CARD 3 REDEMPTIONS (2 = used_2_times category)
-- ============================================================
('eeeeeeee-0003-4000-8000-000000000001', 'cccccccc-0001-4000-8000-000000000003',
 'dddddddd-0001-4000-8000-000000000001', '22222222-2222-4000-8000-000000000002',
 'd4e5f6a7-4444-4000-8000-000000000004', 'completed',
 '2025-11-23 13:00:00+00', NULL, NULL,
 '2025-11-23 13:00:00+00', '2025-11-23 13:00:00+00',
 'd4e5f6a7-4444-4000-8000-000000000004', 'd4e5f6a7-4444-4000-8000-000000000004'),

('eeeeeeee-0003-4000-8000-000000000002', 'cccccccc-0001-4000-8000-000000000003',
 'dddddddd-0001-4000-8000-000000000001', '22222222-2222-4000-8000-000000000002',
 'e5f6a7b8-5555-4000-8000-000000000005', 'completed',
 '2025-11-25 16:30:00+00', NULL, NULL,
 '2025-11-25 16:30:00+00', '2025-11-25 16:30:00+00',
 'e5f6a7b8-5555-4000-8000-000000000005', 'e5f6a7b8-5555-4000-8000-000000000005'),

-- ============================================================
-- CARD 4 REDEMPTIONS (3 = used_3_times category)
-- ============================================================
('eeeeeeee-0004-4000-8000-000000000001', 'cccccccc-0001-4000-8000-000000000004',
 'dddddddd-0001-4000-8000-000000000001', '22222222-2222-4000-8000-000000000002',
 'd4e5f6a7-4444-4000-8000-000000000004', 'completed',
 '2025-11-24 12:00:00+00', NULL, NULL,
 '2025-11-24 12:00:00+00', '2025-11-24 12:00:00+00',
 'd4e5f6a7-4444-4000-8000-000000000004', 'd4e5f6a7-4444-4000-8000-000000000004'),

('eeeeeeee-0004-4000-8000-000000000002', 'cccccccc-0001-4000-8000-000000000004',
 'dddddddd-0001-4000-8000-000000000001', '22222222-2222-4000-8000-000000000002',
 'e5f6a7b8-5555-4000-8000-000000000005', 'completed',
 '2025-11-26 19:15:00+00', NULL, NULL,
 '2025-11-26 19:15:00+00', '2025-11-26 19:15:00+00',
 'e5f6a7b8-5555-4000-8000-000000000005', 'e5f6a7b8-5555-4000-8000-000000000005'),

('eeeeeeee-0004-4000-8000-000000000003', 'cccccccc-0001-4000-8000-000000000004',
 'dddddddd-0001-4000-8000-000000000001', '22222222-2222-4000-8000-000000000002',
 'd4e5f6a7-4444-4000-8000-000000000004', 'completed',
 '2025-11-28 20:00:00+00', NULL, NULL,
 '2025-11-28 20:00:00+00', '2025-11-28 20:00:00+00',
 'd4e5f6a7-4444-4000-8000-000000000004', 'd4e5f6a7-4444-4000-8000-000000000004'),

-- ============================================================
-- EAGLE FOUNDATION CARD REDEMPTIONS
-- ============================================================
-- Card 11 (Eagle): 1 redemption
('eeeeeeee-0011-4000-8000-000000000001', 'cccccccc-0002-4000-8000-000000000001',
 'dddddddd-0001-4000-8000-000000000001', '22222222-2222-4000-8000-000000000002',
 'e5f6a7b8-5555-4000-8000-000000000005', 'completed',
 '2025-11-28 14:00:00+00', NULL, NULL,
 '2025-11-28 14:00:00+00', '2025-11-28 14:00:00+00',
 'e5f6a7b8-5555-4000-8000-000000000005', 'e5f6a7b8-5555-4000-8000-000000000005'),

-- Card 12 (Eagle): 2 redemptions
('eeeeeeee-0012-4000-8000-000000000001', 'cccccccc-0002-4000-8000-000000000002',
 'dddddddd-0001-4000-8000-000000000001', '22222222-2222-4000-8000-000000000002',
 'd4e5f6a7-4444-4000-8000-000000000004', 'completed',
 '2025-11-29 11:00:00+00', NULL, NULL,
 '2025-11-29 11:00:00+00', '2025-11-29 11:00:00+00',
 'd4e5f6a7-4444-4000-8000-000000000004', 'd4e5f6a7-4444-4000-8000-000000000004'),

('eeeeeeee-0012-4000-8000-000000000002', 'cccccccc-0002-4000-8000-000000000002',
 'dddddddd-0001-4000-8000-000000000001', '22222222-2222-4000-8000-000000000002',
 'e5f6a7b8-5555-4000-8000-000000000005', 'completed',
 '2025-11-30 15:30:00+00', NULL, NULL,
 '2025-11-30 15:30:00+00', '2025-11-30 15:30:00+00',
 'e5f6a7b8-5555-4000-8000-000000000005', 'e5f6a7b8-5555-4000-8000-000000000005'),

-- Card 13 (Eagle): 3 redemptions
('eeeeeeee-0013-4000-8000-000000000001', 'cccccccc-0002-4000-8000-000000000003',
 'dddddddd-0001-4000-8000-000000000001', '22222222-2222-4000-8000-000000000002',
 'd4e5f6a7-4444-4000-8000-000000000004', 'completed',
 '2025-11-30 12:00:00+00', NULL, NULL,
 '2025-11-30 12:00:00+00', '2025-11-30 12:00:00+00',
 'd4e5f6a7-4444-4000-8000-000000000004', 'd4e5f6a7-4444-4000-8000-000000000004'),

('eeeeeeee-0013-4000-8000-000000000002', 'cccccccc-0002-4000-8000-000000000003',
 'dddddddd-0001-4000-8000-000000000001', '22222222-2222-4000-8000-000000000002',
 'e5f6a7b8-5555-4000-8000-000000000005', 'completed',
 '2025-12-01 14:00:00+00', NULL, NULL,
 '2025-12-01 14:00:00+00', '2025-12-01 14:00:00+00',
 'e5f6a7b8-5555-4000-8000-000000000005', 'e5f6a7b8-5555-4000-8000-000000000005'),

('eeeeeeee-0013-4000-8000-000000000003', 'cccccccc-0002-4000-8000-000000000003',
 'dddddddd-0001-4000-8000-000000000001', '22222222-2222-4000-8000-000000000002',
 'd4e5f6a7-4444-4000-8000-000000000004', 'completed',
 '2025-12-02 18:30:00+00', NULL, NULL,
 '2025-12-02 18:30:00+00', '2025-12-02 18:30:00+00',
 'd4e5f6a7-4444-4000-8000-000000000004', 'd4e5f6a7-4444-4000-8000-000000000004');

-- ============================================================
-- TEST USERS SUMMARY
-- ============================================================
-- All users use password: testingpassword
--
-- | Email                          | Role            | Team Account      |
-- |--------------------------------|-----------------|-------------------|
-- | super-admin@tailgate.dev       | Super Admin     | (Platform-wide)   |
-- | cardholder@tailgate.dev        | Cardholder      | (Personal only)   |
-- | cardholder2-14@tailgate.dev    | Cardholders     | (Personal only)   |
-- | org-admin@tailgate.dev         | Org Admin       | Tiger Athletics   |
-- | org-admin2@tailgate.dev        | Org Admin       | Eagle Foundation  |
-- | distributor@tailgate.dev       | Distributor     | Tiger Athletics   |
-- | distributor2@tailgate.dev      | Distributor     | Eagle Foundation  |
-- | merchant-owner@tailgate.dev    | Merchant Owner  | GameDay Grill, Orlando Coffee, Miami Sports Bar, Sunset Smoothies, Campus Bookstore |
-- | merchant-staff@tailgate.dev    | Merchant Staff  | GameDay Grill     |
--
-- SEED DATA:
-- | Entity        | Count | Notes                                           |
-- |---------------|-------|--------------------------------------------------|
-- | Organizations | 2     | Tiger Athletics, Eagle Foundation                |
-- | Batches       | 4     | 2 per organization                               |
-- | Cards         | 19    | 14 activated, 4 pending, 1 cancelled             |
-- | Cardholders   | 14    | Each with activated card                         |
-- | Merchants     | 5     | GameDay Grill, Orlando Coffee, Miami Sports Bar, Sunset Smoothies, Campus Bookstore |
-- | Discounts     | 5     | 2 active+partnered, 1 active+no-partner, 1 expired, 1 inactive |
-- | Redemptions   | 19    | Varied distribution for donut chart              |
--
-- CARD USAGE DISTRIBUTION (for donut chart):
-- | Category       | Cards                          | Count |
-- |----------------|--------------------------------|-------|
-- | No Usage       | 5, 6, 7, 14, 15, 16, 17        | 7     |
-- | Used 1 Time    | 2, 11                          | 2     |
-- | Used 2 Times   | 3, 12                          | 2     |
-- | Used 3 Times   | 4, 13                          | 2     |
-- | Used 4+ Times  | 1                              | 1     |
--
-- MFA FOR SUPER ADMIN:
-- The super admin has MFA enabled with TOTP.
-- TOTP Secret: NHOHJVGPO3R3LKVPRMNIYLCDMBHUM2SE
-- Add this secret to your authenticator app (Google Authenticator, Authy, etc.)
-- to generate the 6-digit code for MFA verification at /auth/verify
-- ============================================================

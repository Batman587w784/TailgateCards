# Cardholder Account Settings Page - Implementation Plan

## Overview

Create a dedicated Account Settings page for cardholders with:
- Basic Information (first name, last name)
- Email Address
- Phone
- Password change (with current password verification)
- Delete Account (danger zone)

## Current State Analysis

### Existing Database Schema

**`accounts` table** (`supabase/schemas/03-accounts.sql`):
- `id`, `name` (single field), `email`, `picture_url`, `public_data` (jsonb)
- No separate first_name/last_name fields
- No phone field

**`cardholder_profiles` table** (`migrations/20251125203946_tailgate-platform-roles.sql`):
```sql
create table if not exists public.cardholder_profiles (
  id uuid unique not null default extensions.uuid_generate_v4(),
  account_id uuid references public.accounts(id) on delete cascade not null,
  stripe_customer_id varchar(255),
  created_at timestamptz,
  updated_at timestamptz,
  created_by uuid references auth.users,
  updated_by uuid references auth.users,
  primary key (id),
  unique (account_id)
);
```

**Related profile tables pattern:**
- `organization_profiles` has: `organization_name`, `contact_phone`, `address`
- `merchant_profiles` has: `business_name`, `contact_phone`, `address`

### Existing Settings Page

Location: `apps/web/app/dashboard/(user)/settings/page.tsx`

Uses `PersonalAccountSettingsContainer` from `@kit/accounts/personal-account-settings` which includes:
- Account Image
- Display Name (single field)
- Language Selector
- Email Update
- Password Update (new + confirm only, no current password verification)
- MFA Setup
- Linked Accounts
- Account Deletion (with OTP verification)

**Problem**: Too many features not needed for cardholders per PRD.

---

## Design Decisions

### 1. Name Storage → Add to `cardholder_profiles`

**Decision**: Add `first_name` and `last_name` columns to `cardholder_profiles` table

**Rationale**:
- Follows existing pattern (`organization_profiles.organization_name`, `merchant_profiles.business_name`)
- Keeps cardholder-specific data together
- Clean, normalized design
- Doesn't pollute generic `accounts` table used by all account types

### 2. Phone Storage → Add to `cardholder_profiles`

**Decision**: Add `phone` column to `cardholder_profiles` table

**Rationale**:
- Both `organization_profiles` and `merchant_profiles` already have `contact_phone`
- Consistent pattern across all profile types
- Cardholder-specific data stays in cardholder table

### 3. Route Location → New dedicated route

**Decision**: Create new route at `/dashboard/(user)/account-settings`

**Rationale**:
- Existing settings page has MFA, linked accounts, language selector - not in PRD for cardholders
- Simpler UX matches PRD cardholder user flow: "Change account info (email) or log in (optional)"
- Cleaner interface for primary consumer-facing user type
- Can coexist with existing settings if needed for other user types

### 4. Password Flow → Implement current password verification

**Decision**: Require current password verification before allowing password change

**Rationale**:
- Matches the Figma design (3 fields shown)
- Better security practice
- Custom implementation using Supabase re-authentication

**Implementation approach**:
1. Re-authenticate user with `supabase.auth.signInWithPassword({ email, password: currentPassword })`
2. If successful, update password using `supabase.auth.updateUser({ password: newPassword })`
3. This ensures user knows current password before changing

---

## Database Migration

### New Migration: `cardholder-profiles-fields.sql`

```sql
/*
 * Migration: Add cardholder profile fields
 * Adds first_name, last_name, and phone to cardholder_profiles table
 */

-- Add columns to cardholder_profiles
ALTER TABLE public.cardholder_profiles
ADD COLUMN IF NOT EXISTS first_name varchar(100),
ADD COLUMN IF NOT EXISTS last_name varchar(100),
ADD COLUMN IF NOT EXISTS phone varchar(50);

-- Add comments for documentation
COMMENT ON COLUMN public.cardholder_profiles.first_name IS 'Cardholder first name';
COMMENT ON COLUMN public.cardholder_profiles.last_name IS 'Cardholder last name';
COMMENT ON COLUMN public.cardholder_profiles.phone IS 'Cardholder phone number';

-- Index for name searches (optional, for future admin search functionality)
CREATE INDEX IF NOT EXISTS ix_cardholder_profiles_name
ON public.cardholder_profiles (last_name, first_name)
WHERE last_name IS NOT NULL;
```

---

## File Structure

```
apps/web/app/dashboard/(user)/account-settings/
├── page.tsx                              # Main settings page (RSC)
├── layout.tsx                            # Layout with header/breadcrumbs
├── _components/
│   ├── account-settings-container.tsx    # Main client container
│   ├── basic-info-form.tsx               # First name, Last name form
│   ├── email-form.tsx                    # Email update form
│   ├── phone-form.tsx                    # Phone update form
│   ├── change-password-form.tsx          # Password change with verification
│   └── delete-account-section.tsx        # Danger zone with delete
└── _lib/
    ├── server/
    │   ├── account-settings.loader.ts    # Data loader function
    │   └── account-settings-actions.ts   # Server actions
    └── schemas/
        └── account-settings.schema.ts    # Zod validation schemas
```

---

## Component Specifications

### 1. Basic Information Form

**Fields**:
- First Name (text, required, 2-100 chars)
- Last Name (text, required, 2-100 chars)

**Layout**: Side-by-side inputs on desktop, stacked on mobile

**Server Action**: `updateBasicInfo(firstName, lastName)`

### 2. Email Form

**Fields**:
- Email (email input)

**Behavior**:
- Reuse existing Supabase auth email update pattern
- Sends verification email to new address
- Updates after confirmation

**Server Action**: Uses existing `useUpdateUser` hook from `@kit/supabase/hooks/use-update-user-mutation`

### 3. Phone Form

**Fields**:
- Phone (tel input, optional)

**Server Action**: `updatePhone(phone)`

### 4. Change Password Form

**Fields**:
- Verify current password (password input, required)
- New password (password input, required, min 8 chars)
- Confirm password (password input, required, must match)

**Server Action**: `changePasswordWithVerification(currentPassword, newPassword)`

**Flow**:
1. Validate current password via re-authentication
2. If valid, update to new password
3. Show success/error toast

### 5. Delete Account Section

**Layout**:
- Card with `border-destructive` class
- Header: "Delete account"
- Description: "This will permanently delete your Personal Account. Please note that this action is irreversible, so proceed with caution."
- Footer with red background:
  - Text: "This action cannot be undone!" (in red)
  - Button: "Delete account" (destructive variant)

**Behavior**:
- Opens AlertDialog modal
- Requires OTP verification (reuse existing `VerifyOtpForm`)
- Calls existing `deletePersonalAccountAction`

---

## UI Layout Reference

```
┌─────────────────────────────────────────────────────────────┐
│ 📋 Account Settings                                         │
│ Account Settings                                            │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Basic information                                       │ │
│ │ View and update your account information.               │ │
│ │                                                         │ │
│ │ First Name              Last Name                       │ │
│ │ ┌─────────────────┐    ┌─────────────────┐             │ │
│ │ │ Nora            │    │ Haverhill       │             │ │
│ │ └─────────────────┘    └─────────────────┘             │ │
│ │                                              [Save]     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Email Address                                           │ │
│ │ Update the email address associated with your account.  │ │
│ │ You will need to verify your new email.                 │ │
│ │                                                         │ │
│ │ Email                                                   │ │
│ │ ┌───────────────────────────────────────────┐          │ │
│ │ │ nora@gmail.com                            │          │ │
│ │ └───────────────────────────────────────────┘          │ │
│ │                                              [Save]     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Phone                                                   │ │
│ │ Update the phone number associated with your account.   │ │
│ │                                                         │ │
│ │ Phone                                                   │ │
│ │ ┌───────────────────────────────────────────┐          │ │
│ │ │ (305) 555-1287                            │          │ │
│ │ └───────────────────────────────────────────┘          │ │
│ │                                              [Save]     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Change Password                                         │ │
│ │ Update your password to    │ Verify current password    │ │
│ │ keep your account secure.  │ ┌───────────────────────┐  │ │
│ │                            │ │ ************          │  │ │
│ │                            │ └───────────────────────┘  │ │
│ │                            │ New password               │ │
│ │                            │ ┌───────────────────────┐  │ │
│ │                            │ │ ************          │  │ │
│ │                            │ └───────────────────────┘  │ │
│ │                            │ Confirm password           │ │
│ │                            │ ┌───────────────────────┐  │ │
│ │                            │ │ ************          │  │ │
│ │                            │ └───────────────────────┘  │ │
│ │                                              [Save]     │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Delete account                         (red border)     │ │
│ │ This will permanently delete your Personal Account.     │ │
│ │ Please note that this action is irreversible, so        │ │
│ │ proceed with caution.                                   │ │
│ │ ┌─────────────────────────────────────────────────────┐ │ │
│ │ │ This action cannot be undone!    [Delete account]   │ │ │
│ │ │ (red text)                       (red button)       │ │ │
│ │ └─────────────────────────────────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Server Actions

### `account-settings-actions.ts`

```typescript
'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

// Update basic info (first name, last name)
export const updateBasicInfoAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { error } = await client
      .from('cardholder_profiles')
      .update({
        first_name: data.firstName,
        last_name: data.lastName,
      })
      .eq('account_id', user.id);

    if (error) throw error;
    return { success: true };
  },
  { schema: BasicInfoSchema }
);

// Update phone
export const updatePhoneAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    const { error } = await client
      .from('cardholder_profiles')
      .update({ phone: data.phone })
      .eq('account_id', user.id);

    if (error) throw error;
    return { success: true };
  },
  { schema: PhoneSchema }
);

// Change password with current password verification
export const changePasswordAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();

    // Re-authenticate with current password
    const { error: authError } = await client.auth.signInWithPassword({
      email: user.email!,
      password: data.currentPassword,
    });

    if (authError) {
      throw new Error('Current password is incorrect');
    }

    // Update to new password
    const { error: updateError } = await client.auth.updateUser({
      password: data.newPassword,
    });

    if (updateError) throw updateError;
    return { success: true };
  },
  { schema: ChangePasswordSchema }
);
```

---

## Zod Schemas

### `account-settings.schema.ts`

```typescript
import { z } from 'zod';

export const BasicInfoSchema = z.object({
  firstName: z.string().min(2, 'First name must be at least 2 characters').max(100),
  lastName: z.string().min(2, 'Last name must be at least 2 characters').max(100),
});

export const PhoneSchema = z.object({
  phone: z.string().optional(),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(8, 'Password must be at least 8 characters').max(99),
  confirmPassword: z.string().min(8).max(99),
}).refine(
  (data) => data.newPassword === data.confirmPassword,
  {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  }
);

export type BasicInfoFormData = z.infer<typeof BasicInfoSchema>;
export type PhoneFormData = z.infer<typeof PhoneSchema>;
export type ChangePasswordFormData = z.infer<typeof ChangePasswordSchema>;
```

---

## Data Loader

### `account-settings.loader.ts`

```typescript
import 'server-only';

import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '~/lib/database.types';

export async function loadCardholderSettings(
  client: SupabaseClient<Database>,
  userId: string
) {
  // Get account data
  const { data: account, error: accountError } = await client
    .from('accounts')
    .select('id, email')
    .eq('primary_owner_user_id', userId)
    .eq('is_personal_account', true)
    .single();

  if (accountError) throw accountError;

  // Get cardholder profile
  const { data: profile, error: profileError } = await client
    .from('cardholder_profiles')
    .select('first_name, last_name, phone')
    .eq('account_id', account.id)
    .single();

  // Profile might not exist yet
  return {
    accountId: account.id,
    email: account.email,
    firstName: profile?.first_name ?? '',
    lastName: profile?.last_name ?? '',
    phone: profile?.phone ?? '',
  };
}
```

---

## Navigation Updates

### `config/paths.config.ts`

Add:
```typescript
app: {
  // ... existing paths
  cardholderSettings: '/dashboard/account-settings',
}
```

### `config/personal-account-navigation.config.tsx`

Add menu item:
```typescript
{
  label: 'common:accountSettings',
  path: pathsConfig.app.cardholderSettings,
  Icon: <Settings className="w-4" />,
}
```

---

## Translations

### `public/locales/en/account.json`

Add keys:
```json
{
  "accountSettings": "Account Settings",
  "basicInfo": "Basic information",
  "basicInfoDescription": "View and update your account information.",
  "firstName": "First Name",
  "lastName": "Last Name",
  "phone": "Phone",
  "phoneDescription": "Update the phone number associated with your account.",
  "changePassword": "Change Password",
  "changePasswordDescription": "Update your password to keep your account secure.",
  "verifyCurrentPassword": "Verify current password",
  "newPassword": "New password",
  "confirmPassword": "Confirm password",
  "deleteAccountWarning": "This will permanently delete your Personal Account. Please note that this action is irreversible, so proceed with caution.",
  "deleteAccountCannotUndo": "This action cannot be undone!",
  "currentPasswordIncorrect": "Current password is incorrect",
  "passwordsDoNotMatch": "Passwords do not match"
}
```

---

## Implementation Order

1. **Database migration** - Add columns to cardholder_profiles
2. **Run typegen** - `pnpm supabase:web:typegen`
3. **Create schemas** - Zod validation schemas
4. **Create loader** - Data fetching function
5. **Create server actions** - Update functions
6. **Create components** - Forms and UI components
7. **Create page & layout** - Main settings page
8. **Update navigation** - Add menu link
9. **Add translations** - i18n keys
10. **Verification** - `pnpm typecheck && pnpm lint:fix`

---

## Reference Files

| Purpose | File Path |
|---------|-----------|
| Existing settings page | `apps/web/app/dashboard/(user)/settings/page.tsx` |
| Settings container | `packages/features/accounts/src/components/personal-account-settings/account-settings-container.tsx` |
| Delete account pattern | `packages/features/accounts/src/components/personal-account-settings/account-danger-zone.tsx` |
| Password form pattern | `packages/features/accounts/src/components/personal-account-settings/password/update-password-form.tsx` |
| Email form pattern | `packages/features/accounts/src/components/personal-account-settings/email/update-email-form.tsx` |
| Cardholder profiles table | `apps/web/supabase/migrations/20251125203946_tailgate-platform-roles.sql` |
| Accounts schema | `apps/web/supabase/schemas/03-accounts.sql` |
| Existing cardholder loader | `apps/web/app/dashboard/(user)/_lib/server/cardholder-page.loader.ts` |

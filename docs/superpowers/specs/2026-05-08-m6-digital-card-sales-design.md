# M6 — Digital Card Sales — Design

**Date:** 2026-05-08
**Effort target:** 25 hours
**Author:** brainstorm session

## 1. Goal

Add digital cards as a parallel issuance line to physical cards. Each distributor gets a unique, shareable sales link. Visiting that link drops the buyer into the existing `/activate` flow — they pay via Stripe, the platform creates the digital card on payment success, the buyer claims/activates it on their account, and from that point on it behaves identically to a physical card for redemption, RLS, and revenue.

Hard constraints from the brief:

- Digital cards are numbered in a separate line from physical cards.
- Each distributor has a unique digital sales link, shown in their dashboard.
- Each distributor has unlimited digital cards to sell (no batches, no inventory).
- Cardholders claim and activate via secure link.
- Merchants can validate and redeem digital cards through the existing cashier flow.
- Super-admin and org-admin dashboards track digital cards alongside physical.

## 2. Locked decisions

| Decision | Choice |
|---|---|
| Purchase flow | Pay-then-claim. Distributor link enters existing `/activate` flow at the activation step. |
| Schema | Single `cards` table, new `card_type` enum (`physical`, `digital`). |
| Pricing | Reuse the platform-wide Stripe SKU (`STRIPE_CARD_PRODUCT_ID`). No per-org or per-distributor digital price in M6. |
| Revenue | Reuse `organization_profiles.share_per_card_cents`. No new revenue table or RPC. |
| Numbering | Per-org monotonic sequence with `D` segment: `{accounts.card_prefix}-D-{NNNNNN}`. |
| Claim recovery | Webhook emails buyer the claim URL on Stripe success. |
| Distributor link | `/activate/d/{accounts.slug}`. Reuses existing `accounts.slug`. |
| Multi-buy | One card per checkout in M6. |
| Expiration | 365 days from activation, same RPC as physical. |
| Refunds | `charge.refunded` webhook auto-cancels the card. |

Out of scope for M6: multi-card cart, per-org/per-distributor digital pricing, unclaimed-card forfeiture, Wallet pass on purchase (M7), distributor link revocation/rotation.

## 3. End-to-end flow

```
[Distributor] copies /activate/d/acme-jane from their dashboard
                │
                ▼
[Buyer] opens /activate/d/acme-jane
                │
                ▼
ActivateCardFlow renders with initialStep=1 and a synthetic
"digital" cardData payload (no card row yet)
                │
                ▼
StepActivation in digital mode → Stripe Checkout Session
   metadata = { kind: 'digital_card', distributor_id, organization_id }
                │
   (Stripe webhook on charge.succeeded — server side)
                │
   ├─ rpc.create_digital_card(...)  → cards row inserted with
   │    card_type='digital', status='pending', claim_token,
   │    digital_card_number, payment_intent_id, buyer_email
   │
   └─ send transactional email to buyer_email containing
        /activate/{claim_token}?payment=success
                │
                ▼
Stripe redirects buyer to /activate/{claim_token}?payment=success
                │
                ▼
loadCardByCodeOrToken finds the card by claim_token
                │
                ▼
ActivateCardFlow continues into StepCompleteProfile
                │
                ▼
activate_card(claim_token) — assigns cardholder_id, sets
status='activated', activated_at, expires_at = now()+365d
                │
                ▼
Card now usable at any merchant /validate, identically to physical.
```

If the buyer abandons the redirect tab, the same `/activate/{claim_token}` URL arrives by email and resumes the flow. If the payment is refunded later, the `charge.refunded` webhook flips the card's `status` to `cancelled`; merchant validation already rejects cancelled cards.

## 4. Database changes

One migration. Strictly additive — no destructive changes to existing physical-card data.

```sql
-- Enum
CREATE TYPE card_type AS ENUM ('physical', 'digital');

-- Cards table additions
ALTER TABLE cards ADD COLUMN card_type card_type NOT NULL DEFAULT 'physical';
ALTER TABLE cards ADD COLUMN claim_token text UNIQUE;
ALTER TABLE cards ADD COLUMN digital_card_number int;
ALTER TABLE cards ADD COLUMN buyer_email text;
ALTER TABLE cards ADD COLUMN purchased_at timestamptz;

-- Constraints
ALTER TABLE cards ADD CONSTRAINT cards_digital_has_claim_token
  CHECK (card_type = 'physical' OR claim_token IS NOT NULL);
ALTER TABLE cards ADD CONSTRAINT cards_digital_has_number
  CHECK (card_type = 'physical' OR digital_card_number IS NOT NULL);

-- Per-org digital uniqueness
CREATE UNIQUE INDEX cards_org_digital_number_uniq
  ON cards (organization_id, digital_card_number)
  WHERE card_type = 'digital';

-- Per-org counter for digital card numbers
CREATE TABLE organization_digital_card_counters (
  organization_id uuid PRIMARY KEY REFERENCES accounts(id) ON DELETE CASCADE,
  next_number int NOT NULL DEFAULT 1,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Function: claim the next digital card number for an org under a row lock
CREATE FUNCTION public.next_digital_card_number(p_organization_id uuid)
RETURNS int LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_next int;
BEGIN
  INSERT INTO organization_digital_card_counters (organization_id, next_number)
  VALUES (p_organization_id, 1)
  ON CONFLICT (organization_id) DO NOTHING;

  UPDATE organization_digital_card_counters
  SET next_number = next_number + 1, updated_at = now()
  WHERE organization_id = p_organization_id
  RETURNING next_number - 1 INTO v_next;

  RETURN v_next;
END;
$$;

-- Function: create a digital card from a Stripe success webhook
CREATE FUNCTION public.create_digital_card(
  p_organization_id uuid,
  p_distributor_id uuid,
  p_payment_intent_id text,
  p_buyer_email text,
  p_price_cents int
) RETURNS TABLE (card_id uuid, claim_token text)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_card_id uuid;
  v_token text;
  v_number int;
BEGIN
  -- Idempotency
  SELECT id INTO v_card_id FROM cards
   WHERE stripe_payment_intent_id = p_payment_intent_id;
  IF v_card_id IS NOT NULL THEN
    RETURN QUERY SELECT v_card_id, claim_token FROM cards WHERE id = v_card_id;
    RETURN;
  END IF;

  v_token  := encode(gen_random_bytes(24), 'base64');
  v_token  := replace(replace(replace(v_token, '+','-'), '/','_'), '=','');
  v_number := public.next_digital_card_number(p_organization_id);

  INSERT INTO cards (
    organization_id, distributor_id, card_type, status,
    claim_token, digital_card_number, buyer_email, purchased_at,
    price_cents, payment_type, stripe_payment_intent_id
  ) VALUES (
    p_organization_id, p_distributor_id, 'digital', 'pending',
    v_token, v_number, p_buyer_email, now(),
    p_price_cents, 'stripe', p_payment_intent_id
  ) RETURNING id INTO v_card_id;

  RETURN QUERY SELECT v_card_id, v_token;
END;
$$;
```

**Display code helper.** Wherever physical cards display `{org_prefix}-{batch_prefix}-{card_number}`, the helper additionally returns `{org_prefix}-D-{lpad(digital_card_number, 6, '0')}` for digital cards. Update the existing display helper rather than introducing a new one.

**`activate_card` RPC.** Extend to accept either `card_code` or `claim_token`. Internally it looks up the row by whichever column matches and proceeds with the existing assignment + status update logic. No new RPC.

**RLS additions.**

- `cards`: a new policy that allows `anon` to `SELECT` exactly one row by `claim_token` when `card_type = 'digital'` and `cardholder_id IS NULL`. Tightly scoped — does not expose any other columns to anon beyond what the activate flow already needs.
- A new `SECURITY DEFINER` RPC `get_distributor_buy_page(p_slug text)` returns the display-safe payload for `/activate/d/{slug}`: org name, org logo, distributor display name, digital price. The buy page calls this RPC instead of opening anon `SELECT` on `accounts` and `organization_profiles`.

## 5. Application changes

### 5.1 New route — `/activate/d/[slug]/page.tsx`

Server component, anon-accessible. ~50 lines.

1. Read `params.slug`. Call `get_distributor_buy_page(slug)`. 404 if no result.
2. Build a synthetic `cardData` that satisfies the existing `CardActivationData` shape, extended with two new optional fields (`card_type`, `distributor_id`) that the digital branch of `StepActivation` consumes:
   ```ts
   {
     found: true,
     card: {
       id: null,                          // no card row yet
       display_code: null,
       status: 'pending',
       price_cents,
       card_type: 'digital',              // new optional field
       distributor_id,                    // new optional field
       organization: { id, name, logo_url }
     }
   }
   ```
   Update the `CardData` / `CardActivationData` interfaces in `activate-card-flow.tsx` and `card-activation.loader.ts` to include the two new optional fields. Physical cards leave them undefined.
3. Fetch the org's discount preview (reuse `getOrganizationDiscountPreview`).
4. Render `<ActivateCardFlow cardData={...} initialStep={1} discounts={...} />`.

### 5.2 `ActivateCardFlow` — small additions

- Continue to render the existing 3-step progress timeline (Verification → Activation → Complete Profile). The labels stay the same in the digital path; we just start with `currentStep = 1`.
- The existing error-state handling (`expired`, `cancelled`, `activated`) keeps working; for digital it kicks in when the buyer follows their email link to a card that has already been claimed or refunded.

### 5.3 `StepActivation` — digital branch

Today this component:
1. Renders the Stripe payment form for `card.id`.
2. On payment success, calls `activate_card(card.code)`.
3. Calls `onActivated`.

Add a digital branch (gated by `card.card_type === 'digital'`):

1. Skip the per-card Stripe intent path. Instead call a new server action `createDigitalCardCheckoutSession({ distributorAccountId })` which creates a Stripe Checkout Session with:
   - `metadata: { kind: 'digital_card', distributor_id, organization_id }`
   - `customer_email` capture enabled
   - `success_url`: `https://{appUrl}/activate/finalize?payment=success&session_id={CHECKOUT_SESSION_ID}` (the `finalize` segment is a static placeholder; the real claim token replaces it after the webhook completes — see "Success URL handoff" below).
2. Redirect the browser to the Stripe Checkout URL (`window.location.assign(...)`).
3. The buyer pays. Webhook (server side) creates the card and emails the claim link.
4. Stripe sends the buyer back to the success URL. We resolve the real claim token there and redirect.

**Success URL handoff.** Two simple options; we'll pick (a) for M6:
- **(a) Resolve at success URL.** A tiny `/activate/finalize/page.tsx` server component reads `session_id`, looks up the matching card by Stripe session/payment-intent metadata, and `redirect()`s to `/activate/{claim_token}?payment=success`. If the card hasn't landed yet (webhook race), it polls/retries up to a short ceiling and otherwise tells the buyer "we've emailed you the link" with a link to check email.
- (b) Pre-allocate the claim_token before redirecting to Stripe and embed it in `success_url` directly. Adds bookkeeping (an unfinished card row before payment) — rejected for M6.

### 5.4 Loader change — `loadCardByCodeOrToken`

`apps/web/app/activate/_lib/server/card-activation.loader.ts` — rename or extend `loadCardByCode` to `loadCardByCodeOrToken`. Try `card_code` first; if no match, try `claim_token`. Return the same `CardActivationData` shape so callers don't change.

### 5.5 Webhook — `app/api/cards/webhook/route.ts`

Add two branches:

- `checkout.session.completed` (or `charge.succeeded` — pick whichever the existing handler standardises on) where `metadata.kind = 'digital_card'`:
  1. Extract `distributor_id`, `organization_id`, `payment_intent_id`, `customer_email`, `amount_total`.
  2. Call `create_digital_card(...)`. The RPC is idempotent on `payment_intent_id`.
  3. On success, send a transactional email to `customer_email` containing `/activate/{claim_token}?payment=success`.
- `charge.refunded`: look up `cards` by `stripe_payment_intent_id`. If found and not already `cancelled`, set `status = 'cancelled'`. Existing redemption RLS already rejects non-`activated` cards, so refunds immediately stop accepting redemptions. (If a `cancelled_at` audit column is desired, add it as part of this migration; not strictly required for M6.)

### 5.6 Distributor dashboard

Add a "Your digital sales link" widget to the distributor home (and/or sales page). Shows the URL `/activate/d/{my_slug}` with a copy button and a native share affordance on mobile. Source the slug from `accounts.slug` for the current distributor account.

Extend the existing sales list (`/dashboard/(user)/sales`):
- Add a `card_type` filter chip (`All` / `Physical` / `Digital`).
- Add a `card_type` column to the table.
- Loader: add `card_type` to the existing select; otherwise unchanged.

### 5.7 Org-admin and super-admin dashboards

- `get_org_admin_card_stats` and `get_org_admin_cards_distribution` accept an optional `card_type` filter parameter. Existing dashboards continue to show combined totals; add a "Digital / Physical" split tile to the org-admin and super-admin overview pages.
- `get_org_admin_revenue_stats` and `get_org_admin_sales_over_time` need no change — they already key off `status='activated'` and `share_per_card_cents`.
- Super-admin platform cards page gets a `card_type` column and filter.

### 5.8 Merchant validation

No changes. `cards` rows look identical from the merchant's side once activated; redemption RLS already keys off card status and merchant-discount linkage.

## 6. Testing strategy

- **Unit / pgTAP**: `next_digital_card_number` increments correctly under contention; `create_digital_card` is idempotent on the same `payment_intent_id`; the new `cards` RLS policy lets anon `SELECT` only by `claim_token` and only for unclaimed digital cards; `activate_card` works with either `card_code` or `claim_token`.
- **Server actions**: `createDigitalCardCheckoutSession` validates the slug resolves to an active distributor; rejects unknown / non-distributor slugs.
- **Webhook**: replay the same Stripe payload twice and verify only one card row exists; refund payload flips status to `cancelled`.
- **E2E (Playwright)**: distributor copies link from dashboard; buyer visits the link, pays via Stripe test card, lands on `/activate/{claim_token}?payment=success`, completes profile, lands on cardholder dashboard with the card visible. Second test: buyer abandons after payment, follows the email link, completes the same flow.
- **Merchant E2E**: merchant validates a freshly-activated digital card and applies a discount. No new test infrastructure — extends the existing `/validate` test.

## 7. Effort estimate

| Block | Hours |
|---|---|
| Migration: enum, columns, counter, function, RLS | 4 |
| `/activate/d/[slug]/page.tsx` + `get_distributor_buy_page` RPC | 2 |
| `StepActivation` digital branch + `createDigitalCardCheckoutSession` | 4 |
| Stripe webhook digital-card branch + idempotency | 3 |
| Refund webhook auto-cancel | 1 |
| Loader extension (claim_token lookup) + `activate_card` overload | 2 |
| Transactional email template + send | 2 |
| Distributor dashboard "share link" widget + sales-page card_type filter | 2 |
| Org-admin / super-admin card_type splits and filter | 2 |
| Tests (pgTAP + Playwright) | 3 |
| **Total** | **25** |

## 8. Risks and mitigations

- **Webhook race vs success-URL redirect.** Mitigated by the `/activate/finalize` resolver page that retries briefly and falls back to "check your email." Worst case the buyer waits a few seconds or uses the email link.
- **Stripe Checkout email mismatch.** Buyer can use any email at Stripe; that email may not match an existing Tailgate user. Existing activate flow already handles "sign up or sign in" at the profile step; no new logic needed.
- **Concurrent claims of the same `claim_token`.** Prevented by `activate_card` already locking the row and rejecting non-pending statuses.
- **Per-org counter contention.** Counter is a tiny single-row update behind a row lock; well within Postgres throughput for the platform's traffic profile.
- **Refund after activation.** Cancelling an activated card is a customer-impact event. Auto-cancel on refund is the safest default; org-admin can be given a "reverse cancel" affordance later if needed (out of scope).

## 9. Migration / rollout

- Migration is strictly additive. Existing physical cards default to `card_type='physical'` via the `NOT NULL DEFAULT` clause. No data backfill needed beyond the default.
- Feature can be soft-launched per org by simply not surfacing the share-link widget to distributors until the org is ready. The route `/activate/d/{slug}` is open by default; an org-level feature flag is **not** part of M6 scope but the design doesn't preclude one.
- Reset on local: `pnpm supabase:web:reset` then `pnpm supabase:web:typegen`. Promote test → prod via the existing `./scripts/sb test db push` flow per the db-environment-workflow skill.

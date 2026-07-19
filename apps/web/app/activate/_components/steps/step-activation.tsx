'use client';

import type { DiscountPreview } from '../../_lib/server/card-activation.loader';
import { CardInfoDisplay } from '../card-info-display';
import { DigitalClaimForm } from '../digital-claim-form';
import {
  DigitalPaymentForm,
  type DigitalPaymentLink,
} from '../digital-payment-form';
import type { ActivationResult } from '../shared-payment-form';
import { StripePaymentForm } from '../stripe-payment-form';

interface CardData {
  id: string | null;
  display_code: string | null;
  status: string;
  price_cents: number;
  organization: {
    id: string;
    name: string;
    picture_url?: string | null;
    city?: string | null;
    state?: string | null;
  };
  card_type?: 'physical' | 'digital';
  claim_token?: string;
  distributor_id?: string | null;
  distributor_name?: string | null;
  distributor_slug?: string;
  organization_slug?: string;
  buyer_email?: string | null;
}

interface StepActivationProps {
  card: CardData;
  onActivated: (result: ActivationResult) => void;
  discounts: DiscountPreview[];
}

export function StepActivation({
  card,
  onActivated,
  discounts,
}: StepActivationProps) {
  // Digital — pre-payment (buyer arrived at /activate/d/{slug} or
  // /activate/o/{slug}). Inline Stripe Elements flow, identical UX to physical
  // cards but without an existing card row.
  if (card.card_type === 'digital' && !card.claim_token) {
    const link: DigitalPaymentLink | null = card.distributor_slug
      ? { type: 'distributor', slug: card.distributor_slug }
      : card.organization_slug
        ? { type: 'organization', slug: card.organization_slug }
        : null;

    if (!link) {
      return (
        <div className="text-muted-foreground p-4 text-center text-sm">
          This sales link is incomplete. Please reload the page.
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-6">
        {/* Title "Activate your digital card" now shares the header row with the
            compact 3-step indicator in ActivateCardFlow (variant 3b, #19). */}
        <CardInfoDisplay
          card={{ display_code: null, organization: card.organization }}
          discounts={discounts}
        />

        <DigitalPaymentForm
          link={link}
          orgName={card.organization.name}
          onActivated={onActivated}
        />
      </div>
    );
  }

  // Digital — post-payment recovery via emailed claim link.
  if (card.card_type === 'digital' && card.claim_token) {
    return (
      <DigitalClaimForm
        claimToken={card.claim_token}
        card={{
          display_code: card.display_code ?? 'D',
          organization: card.organization,
        }}
        defaultEmail={card.buyer_email}
        discounts={discounts}
        onActivated={onActivated}
      />
    );
  }

  // Physical — inline Stripe Elements flow.
  if (card.id && card.display_code) {
    return (
      <div className="flex flex-col gap-6">
        <CardInfoDisplay
          card={{
            display_code: card.display_code,
            organization: card.organization,
          }}
          discounts={discounts}
        />

        <StripePaymentForm
          card={{
            id: card.id,
            display_code: card.display_code,
            status: card.status,
            price_cents: card.price_cents,
            organization: card.organization,
          }}
          onActivated={onActivated}
        />
      </div>
    );
  }

  return (
    <div className="text-muted-foreground p-4 text-center text-sm">
      Card data is missing. Please refresh the page.
    </div>
  );
}

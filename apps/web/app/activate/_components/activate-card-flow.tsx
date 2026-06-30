'use client';

import { useEffect, useState } from 'react';

import Image from 'next/image';

import { AlertCircle, Check } from 'lucide-react';

import { Heading } from '@kit/ui/heading';
import { cn } from '@kit/ui/utils';

import type { ClientPlatform } from '../_lib/detect-platform';
import { getOrganizationDiscountPreview } from '../_lib/server/card-activation.actions';
import type {
  CardActivationData,
  DiscountPreview,
} from '../_lib/server/card-activation.loader';
import { StepActivation } from './steps/step-activation';
import { StepVerification } from './steps/step-verification';
import { StepWallet } from './steps/step-wallet';

interface CardData {
  id: string | null;
  display_code: string | null;
  status: string;
  price_cents: number;
  organization: {
    id: string;
    name: string;
    picture_url?: string | null;
  };
  card_type?: 'physical' | 'digital';
  claim_token?: string;
  distributor_id?: string | null;
  distributor_slug?: string;
  organization_slug?: string;
  buyer_email?: string | null;
}

interface ActivatedCardData {
  accountId: string;
  cardCode: string;
  email: string;
  temporaryPasswordSent?: boolean;
}

interface ActivateCardFlowProps {
  cardData: CardActivationData & {
    activatedCard?: ActivatedCardData | null;
  };
  initialStep: number;
  discounts: DiscountPreview[];
  platform: ClientPlatform;
}

const STEPS = [
  { label: 'Verification', key: 'verification' },
  { label: 'Card Activation', key: 'activation' },
  { label: ['Add to', 'Wallet'], key: 'wallet' },
];

export function ActivateCardFlow({
  cardData,
  initialStep,
  discounts: initialDiscounts,
  platform,
}: ActivateCardFlowProps) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [verifiedCard, setVerifiedCard] = useState<CardData | null>(
    cardData.card as CardData | null,
  );
  const [activatedCard, setActivatedCard] = useState<ActivatedCardData | null>(
    cardData.activatedCard ?? null,
  );
  const [discounts, setDiscounts] =
    useState<DiscountPreview[]>(initialDiscounts);

  // Once the card is activated, replace the URL with the canonical wallet
  // deep-link (`/activate/[cardCode]?step=wallet`). This makes the wallet step
  // survive reload, browser-back, and Apple/Google Wallet handoff failures.
  useEffect(() => {
    if (currentStep === 2 && activatedCard && typeof window !== 'undefined') {
      const target = `/activate/${encodeURIComponent(activatedCard.cardCode)}?step=wallet`;
      const current = `${window.location.pathname}${window.location.search}`;
      if (current !== target) {
        window.history.replaceState(null, '', target);
      }
    }
  }, [currentStep, activatedCard]);

  // Handle card not found when code was provided
  if (initialStep > 0 && !cardData.found) {
    return (
      <div className="flex w-full max-w-md flex-col gap-6">
        <ErrorState
          title="Card Not Found"
          message={
            cardData.error ?? 'The card code is invalid or does not exist.'
          }
        />
      </div>
    );
  }

  // Handle expired or cancelled cards
  if (verifiedCard?.status === 'expired') {
    return (
      <div className="flex w-full max-w-md flex-col gap-6">
        <ErrorState
          title="Card Expired"
          message="This card has expired and can no longer be used."
        />
      </div>
    );
  }

  if (verifiedCard?.status === 'cancelled') {
    return (
      <div className="flex w-full max-w-md flex-col gap-6">
        <ErrorState
          title="Card Cancelled"
          message="This card has been cancelled and is no longer valid."
        />
      </div>
    );
  }

  // Card already activated. If we have an activatedCard payload (server-loaded
  // for the wallet step) we render the wallet view; otherwise fall back to the
  // "already activated, please sign in" message.
  if (verifiedCard?.status === 'activated' && !activatedCard) {
    return (
      <div className="flex w-full max-w-md flex-col gap-6">
        <ErrorState
          title="Card Already Activated"
          message="This card has already been activated. Please sign in to access your account."
        />
      </div>
    );
  }

  const handleCardVerified = async (card: CardData) => {
    setVerifiedCard(card);
    setCurrentStep(1);

    try {
      const result = await getOrganizationDiscountPreview({
        organizationId: card.organization.id,
      });

      if (result.success && result.discounts) {
        setDiscounts(result.discounts);
      }
    } catch (error) {
      // The discount preview is a non-critical enhancement, so we don't block
      // the flow — but never swallow the failure silently: surface it to the
      // console (and thus the browser's error reporting) for diagnosis.
      console.error('Failed to load discount preview', error);
    }
  };

  const handleCardActivated = (result: ActivatedCardData) => {
    setActivatedCard(result);
    setCurrentStep(2);
  };

  const isWalletStep = currentStep === 2;

  return (
    <div className="flex w-full flex-col gap-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <Image
          src="/images/cards/card.png"
          alt="Tailgate Card"
          width={64}
          height={40}
          className="drop-shadow-lg"
          priority
        />
        <div>
          <Heading level={2} className="mb-1">
            {isWalletStep
              ? 'Add Your Card to a Wallet'
              : verifiedCard?.card_type === 'digital'
                ? 'Activate My Digital Card'
                : 'Activate My Card'}
          </Heading>
          <p className="text-muted-foreground text-sm">
            {isWalletStep
              ? 'Your card is activated. Save it to your wallet so you have it on hand.'
              : 'Please complete payment to activate your card.'}
          </p>
        </div>
      </div>

      <ProgressTimeline steps={STEPS} currentStep={currentStep} />

      {currentStep === 0 && (
        <StepVerification onVerified={handleCardVerified} />
      )}

      {currentStep === 1 && verifiedCard && (
        <StepActivation
          card={verifiedCard}
          onActivated={handleCardActivated}
          discounts={discounts}
        />
      )}

      {currentStep === 2 && activatedCard && (
        <StepWallet
          cardCode={activatedCard.cardCode}
          email={activatedCard.email}
          platform={platform}
          temporaryPasswordSent={activatedCard.temporaryPasswordSent ?? true}
        />
      )}
    </div>
  );
}

function ProgressTimeline({
  steps,
  currentStep,
}: {
  steps: { label: string | string[]; key: string }[];
  currentStep: number;
}) {
  return (
    <div className="relative flex items-start justify-between">
      {/* Connector line */}
      <div className="absolute top-3 right-[calc(16.67%)] left-[calc(16.67%)] h-[2px] bg-slate-200">
        <div
          className="bg-brand h-full transition-all duration-300"
          style={{
            width:
              currentStep === 0 ? '0%' : currentStep === 1 ? '50%' : '100%',
          }}
        />
      </div>

      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isComplete = index < currentStep;

        return (
          <div
            key={step.key}
            className="relative z-10 flex flex-1 flex-col items-center"
          >
            <div
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors',
                isComplete && 'border-brand bg-brand',
                isActive && 'border-brand bg-white',
                !isActive && !isComplete && 'border-slate-300 bg-white',
              )}
            >
              {isComplete && <Check className="h-3.5 w-3.5 text-white" />}
              {isActive && <div className="bg-brand h-2 w-2 rounded-full" />}
            </div>
            <span
              className={cn(
                'mt-2 text-center text-xs leading-tight font-medium',
                (isActive || isComplete) && 'text-brand',
                !isActive && !isComplete && 'text-muted-foreground',
              )}
            >
              {Array.isArray(step.label) ? (
                <>
                  {step.label[0]}
                  <br />
                  {step.label[1]}
                </>
              ) : (
                step.label
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function ErrorState({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex flex-col items-center gap-4 py-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
        <AlertCircle className="h-8 w-8 text-red-600" />
      </div>
      <div>
        <Heading level={4} className="mb-2">
          {title}
        </Heading>
        <p className="text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}

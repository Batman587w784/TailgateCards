'use client';

import { useEffect, useState } from 'react';

import { AlertCircle, Check } from 'lucide-react';

import { Heading } from '@kit/ui/heading';
import { cn } from '@kit/ui/utils';

import type { ClientPlatform } from '../_lib/detect-platform';
import { getOrganizationDiscountPreview } from '../_lib/server/card-activation.actions';
import type {
  CardActivationData,
  DiscountPreview,
} from '../_lib/server/card-activation.loader';
import { GiftCardsShare } from './gift-cards-share';
import { GoalHeader } from './goal-header';
import type { ActivationResult, GiftCard } from './shared-payment-form';
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
    city?: string | null;
    state?: string | null;
  };
  district?: {
    id: string;
    name: string;
    type: string | null;
    picture_url?: string | null;
    city?: string | null;
    state?: string | null;
  } | null;
  card_type?: 'physical' | 'digital';
  claim_token?: string;
  distributor_id?: string | null;
  distributor_name?: string | null;
  distributor_slug?: string;
  organization_slug?: string;
  buyer_email?: string | null;
}

interface ActivatedCardData {
  accountId: string;
  cardCode: string;
  email: string;
  temporaryPasswordSent?: boolean;
  quantity?: number;
  giftCards?: GiftCard[];
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

  const handleCardActivated = (result: ActivationResult) => {
    setActivatedCard(result);
    setCurrentStep(2);
  };

  // Digital purchase page: lead with the chapter goal header, above the
  // progress indicator, so discounts sit near the top of the page.
  const showGoalHeader =
    currentStep === 1 &&
    verifiedCard?.card_type === 'digital' &&
    !verifiedCard.claim_token;

  return (
    <div className="flex w-full flex-col gap-6">
      {showGoalHeader && verifiedCard ? (
        // Variant 3b (ledger #19): goal header, then "Activate your digital
        // card" sharing one row with a compact 3-step indicator.
        <div className="flex flex-col gap-5">
          <GoalHeader
            orgId={verifiedCard.organization.id}
            orgName={verifiedCard.organization.name}
            city={verifiedCard.organization.city}
            state={verifiedCard.organization.state}
            logoUrl={verifiedCard.organization.picture_url}
            district={verifiedCard.district}
            distributorId={verifiedCard.distributor_id}
            distributorName={verifiedCard.distributor_name}
          />
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
            <h2 className="text-lg font-bold">Activate your digital card</h2>
            <MiniStepIndicator currentStep={currentStep} />
          </div>
        </div>
      ) : (
        <ProgressTimeline steps={STEPS} currentStep={currentStep} />
      )}

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
        <>
          {activatedCard.giftCards && activatedCard.giftCards.length > 0 && (
            <GiftCardsShare giftCards={activatedCard.giftCards} />
          )}
          <StepWallet
            cardCode={activatedCard.cardCode}
            email={activatedCard.email}
            platform={platform}
            temporaryPasswordSent={activatedCard.temporaryPasswordSent ?? true}
          />
        </>
      )}
    </div>
  );
}

/** Compact 3-step indicator that shares a row with the purchase title (3b). */
function MiniStepIndicator({ currentStep }: { currentStep: number }) {
  const labels = ['Verify', 'Activate', 'Wallet'];

  return (
    <div className="flex shrink-0 items-center gap-2">
      {labels.map((label, index) => {
        const isComplete = index < currentStep;
        const isActive = index === currentStep;

        return (
          <div key={label} className="flex items-center gap-1">
            <span
              className={cn(
                'flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold',
                isComplete && 'bg-brand text-white',
                isActive && 'border-brand text-brand border-2',
                !isComplete &&
                  !isActive &&
                  'border-muted-foreground/30 text-muted-foreground border',
              )}
            >
              {isComplete ? <Check className="h-3 w-3" /> : index + 1}
            </span>
            <span
              className={cn(
                'text-[11px] font-medium',
                isComplete || isActive
                  ? 'text-brand'
                  : 'text-muted-foreground',
              )}
            >
              {label}
            </span>
          </div>
        );
      })}
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

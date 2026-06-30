import type { Metadata } from 'next';

import { AlertCircle } from 'lucide-react';

import { Alert, AlertDescription, AlertTitle } from '@kit/ui/alert';
import { Heading } from '@kit/ui/heading';

import { withI18n } from '~/lib/i18n/with-i18n';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { MerchantSelector } from './_components/merchant-selector';
import { ValidationResult } from './_components/validation-result';
import {
  loadCardForValidation,
  loadCardForValidationById,
  loadMerchantDiscounts,
  loadUserMerchantAccounts,
} from './_lib/server/card-validation.loader';

export const metadata: Metadata = {
  title: 'Validate Card',
  description: 'Validate a Tailgate NFC card and apply discounts.',
};

interface PageProps {
  searchParams: Promise<{
    code?: string;
    card_id?: string;
    merchant?: string;
  }>;
}

async function ValidatePage({ searchParams }: PageProps) {
  // Require authentication
  await requireUserInServerComponent();

  const { code, card_id: cardId, merchant: merchantId } = await searchParams;

  // Load user's merchant accounts
  const merchantAccounts = await loadUserMerchantAccounts();

  // User has no merchant access
  if (merchantAccounts.length === 0) {
    return (
      <div className="flex w-full max-w-md flex-col gap-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You don&apos;t have access to any merchant accounts. Please contact
            your administrator.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // No card identifier provided - show scan instructions
  if (!code && !cardId) {
    return (
      <div className="flex w-full max-w-md flex-col items-center gap-6 text-center">
        <Heading level={3}>Validate a Card</Heading>
        <p className="text-muted-foreground">
          Scan an NFC card or enter a card code to validate and apply discounts.
        </p>
        <CardCodeInput merchantId={merchantAccounts[0]?.id} />
      </div>
    );
  }

  // Multiple merchants and none selected - show selector
  if (merchantAccounts.length > 1 && !merchantId) {
    return (
      <div className="flex w-full max-w-md flex-col gap-6">
        <MerchantSelector
          merchants={merchantAccounts}
          cardCode={code}
          cardId={cardId}
        />
      </div>
    );
  }

  // Determine which merchant to use
  const selectedMerchantId = merchantId ?? merchantAccounts[0]?.id;

  if (!selectedMerchantId) {
    return (
      <div className="flex w-full max-w-md flex-col gap-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>No merchant account found.</AlertDescription>
        </Alert>
      </div>
    );
  }

  // Verify user has access to selected merchant
  const hasMerchantAccess = merchantAccounts.some(
    (m) => m.id === selectedMerchantId,
  );

  if (!hasMerchantAccess) {
    return (
      <div className="flex w-full max-w-md flex-col gap-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You don&apos;t have access to this merchant account.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Load card data and discounts. Prefer the UUID path (QR scan) when present;
  // fall back to display-code parsing for manual entry and pre-existing
  // physical-card QRs already in the wild.
  const [cardData, discounts] = await Promise.all([
    cardId
      ? loadCardForValidationById(cardId)
      : loadCardForValidation(code ?? ''),
    loadMerchantDiscounts(selectedMerchantId),
  ]);

  return (
    <div className="flex w-full max-w-md flex-col gap-6">
      <ValidationResult
        cardData={cardData}
        discounts={discounts}
        merchantId={selectedMerchantId}
      />
    </div>
  );
}

// Simple card code input component
function CardCodeInput({ merchantId }: { merchantId?: string }) {
  return (
    <form
      action="/validate"
      method="GET"
      className="flex w-full flex-col gap-3"
    >
      <input
        type="text"
        name="code"
        placeholder="Enter card code (e.g., TG-2024-1234567)"
        className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        autoFocus
      />
      {merchantId && <input type="hidden" name="merchant" value={merchantId} />}
      <button
        type="submit"
        className="bg-primary text-primary-foreground hover:bg-primary/90 inline-flex h-10 items-center justify-center rounded-md px-4 py-2 text-sm font-medium"
      >
        Validate Card
      </button>
    </form>
  );
}

export default withI18n(ValidatePage);

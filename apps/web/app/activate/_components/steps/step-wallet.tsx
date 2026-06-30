'use client';

import { AlertCircle, CreditCard } from 'lucide-react';

import type { ClientPlatform } from '../../_lib/detect-platform';
import { SaveToWallet } from '../save-to-wallet';

interface StepWalletProps {
  cardCode: string;
  email?: string;
  platform: ClientPlatform;
  temporaryPasswordSent: boolean;
}

export function StepWallet({
  cardCode,
  email,
  platform,
  temporaryPasswordSent,
}: StepWalletProps) {
  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-red-700">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
        <div className="text-sm">
          <p className="font-semibold">
            Important: Add Your Card to a Wallet Now!
          </p>
          <p>
            To avoid losing access to your card and discounts, please add it to
            your wallet now. If not added, you may lose access to both the card
            and its discounts.
          </p>
        </div>
      </div>

      <div className="flex flex-col items-center gap-1 text-center">
        <h3 className="text-lg font-semibold text-green-600">
          Congratz! Your card is activated.
        </h3>
        <p className="text-sm text-green-500">The payment is successful.</p>
      </div>

      <div className="space-y-1 text-center text-sm text-slate-500">
        {temporaryPasswordSent ? (
          <p data-test="temp-password-sent-note">
            We&apos;ve sent your temporary password
            {email ? (
              <>
                {' '}
                to <span className="font-medium text-slate-700">{email}</span>
              </>
            ) : (
              ' to your email'
            )}
            .
          </p>
        ) : null}
        <p>Please complete your profile information to get started.</p>
      </div>

      <div className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
        <CreditCard className="h-5 w-5 text-slate-400" />
        <div className="flex flex-col">
          <span className="text-xs text-slate-500">Card code</span>
          <span
            className="font-mono font-semibold text-slate-900"
            data-test="activated-card-code"
          >
            {cardCode}
          </span>
        </div>
      </div>

      <SaveToWallet cardCode={cardCode} platform={platform} />
    </div>
  );
}

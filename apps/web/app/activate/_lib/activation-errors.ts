/**
 * Error codes + user-facing messages for the cardholder activation flow
 * (physical + digital). Pure data (no server-only or client-only imports) so the
 * server actions and the client components can share one source of truth.
 *
 * Per the activation-flow design decision, messages are intentionally specific:
 * these are anonymous endpoints but the product accepts the enumeration trade-off
 * in exchange for clear UX (rate-limiting is handled separately). Internal faults
 * still map to a neutral message but carry a `reference` for support.
 */

export type VerifyCardErrorCode =
  | 'INVALID_CODE_FORMAT'
  | 'CARD_NOT_FOUND'
  | 'CARD_ALREADY_ACTIVATED'
  | 'CARD_EXPIRED'
  | 'CARD_CANCELLED';

export type ValidateEmailErrorCode = 'EMAIL_HAS_CARD';

export type CreatePaymentIntentErrorCode =
  | 'INVALID_CODE_FORMAT'
  | 'CARD_NOT_FOUND'
  | 'CARD_NOT_PURCHASABLE'
  | 'PAYMENT_INTENT_FAILED';

export type CreateDigitalPaymentIntentErrorCode =
  | 'ORGANIZATION_LINK_NOT_FOUND'
  | 'DISTRIBUTOR_LINK_NOT_FOUND'
  | 'PAYMENT_INTENT_FAILED';

export type ConfirmActivationErrorCode =
  | 'INVALID_CODE_FORMAT'
  | 'CARD_NOT_FOUND'
  | 'CARD_NOT_ACTIVATABLE'
  | 'CARD_ALREADY_ACTIVATED'
  | 'CARD_EXPIRED'
  | 'CARD_CANCELLED'
  | 'PAYMENT_NOT_SUCCEEDED'
  | 'PAYMENT_VERIFICATION_FAILED'
  | 'EMAIL_HAS_CARD'
  | 'ORGANIZATION_LINK_NOT_FOUND'
  | 'DISTRIBUTOR_LINK_NOT_FOUND'
  | 'ACCOUNT_SETUP_INCOMPLETE'
  | 'ACCOUNT_CREATION_FAILED'
  | 'CARD_CREATION_FAILED'
  | 'ACTIVATION_FAILED';

const VERIFY_CARD_MESSAGES: Record<VerifyCardErrorCode, string> = {
  INVALID_CODE_FORMAT: 'That card code is not in a recognised format.',
  CARD_NOT_FOUND: 'No card matches that code.',
  CARD_ALREADY_ACTIVATED: 'This card has already been activated.',
  CARD_EXPIRED: 'This card has expired.',
  CARD_CANCELLED: 'This card has been cancelled.',
};

const VALIDATE_EMAIL_MESSAGES: Record<ValidateEmailErrorCode, string> = {
  EMAIL_HAS_CARD:
    'This email is already associated with a card. Please sign in to your existing account.',
};

const CREATE_PAYMENT_INTENT_MESSAGES: Record<
  CreatePaymentIntentErrorCode,
  string
> = {
  INVALID_CODE_FORMAT: 'That card code is not in a recognised format.',
  CARD_NOT_FOUND: 'No card matches that code.',
  CARD_NOT_PURCHASABLE: 'This card cannot be purchased.',
  PAYMENT_INTENT_FAILED: 'We could not start the payment. Please try again.',
};

const CREATE_DIGITAL_PAYMENT_INTENT_MESSAGES: Record<
  CreateDigitalPaymentIntentErrorCode,
  string
> = {
  ORGANIZATION_LINK_NOT_FOUND: 'This organization link could not be found.',
  DISTRIBUTOR_LINK_NOT_FOUND: 'This distributor link could not be found.',
  PAYMENT_INTENT_FAILED: 'We could not start the payment. Please try again.',
};

const CONFIRM_ACTIVATION_MESSAGES: Record<ConfirmActivationErrorCode, string> =
  {
    INVALID_CODE_FORMAT: 'That card code is not in a recognised format.',
    CARD_NOT_FOUND: 'No card matches that code.',
    CARD_NOT_ACTIVATABLE: 'This card cannot be activated.',
    CARD_ALREADY_ACTIVATED: 'This card has already been activated.',
    CARD_EXPIRED: 'This card has expired.',
    CARD_CANCELLED: 'This card has been cancelled.',
    PAYMENT_NOT_SUCCEEDED: 'Your payment was not completed.',
    PAYMENT_VERIFICATION_FAILED: 'We could not verify your payment.',
    EMAIL_HAS_CARD:
      'This email address is already associated with a card. Please sign in to your existing account.',
    ORGANIZATION_LINK_NOT_FOUND: 'This organization link could not be found.',
    DISTRIBUTOR_LINK_NOT_FOUND: 'This distributor link could not be found.',
    ACCOUNT_SETUP_INCOMPLETE:
      'Your account setup is incomplete. Please contact support.',
    ACCOUNT_CREATION_FAILED:
      'We could not finish setting up your account. Please try again.',
    CARD_CREATION_FAILED: 'We could not create your card. Please try again.',
    ACTIVATION_FAILED: 'We could not activate your card. Please try again.',
  };

export function verifyCardErrorMessage(code: VerifyCardErrorCode): string {
  return VERIFY_CARD_MESSAGES[code] ?? VERIFY_CARD_MESSAGES.CARD_NOT_FOUND;
}

export function validateEmailErrorMessage(
  code: ValidateEmailErrorCode,
): string {
  return (
    VALIDATE_EMAIL_MESSAGES[code] ?? VALIDATE_EMAIL_MESSAGES.EMAIL_HAS_CARD
  );
}

export function createPaymentIntentErrorMessage(
  code: CreatePaymentIntentErrorCode,
): string {
  return (
    CREATE_PAYMENT_INTENT_MESSAGES[code] ??
    CREATE_PAYMENT_INTENT_MESSAGES.PAYMENT_INTENT_FAILED
  );
}

export function createDigitalPaymentIntentErrorMessage(
  code: CreateDigitalPaymentIntentErrorCode,
): string {
  return (
    CREATE_DIGITAL_PAYMENT_INTENT_MESSAGES[code] ??
    CREATE_DIGITAL_PAYMENT_INTENT_MESSAGES.PAYMENT_INTENT_FAILED
  );
}

export function confirmActivationErrorMessage(
  code: ConfirmActivationErrorCode,
): string {
  return (
    CONFIRM_ACTIVATION_MESSAGES[code] ??
    CONFIRM_ACTIVATION_MESSAGES.ACTIVATION_FAILED
  );
}

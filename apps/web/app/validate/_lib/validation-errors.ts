/**
 * Error codes + user-facing messages for the merchant validation/redemption
 * flow. Pure data (no server-only or client-only imports) so the server action
 * and the client component can share one source of truth.
 *
 * Messages are intentionally specific — this is an authenticated merchant flow,
 * so there is no card-enumeration concern. Internal faults (e.g. a failed insert)
 * map to a neutral message but still carry a `reference` for support.
 */

export type RedemptionErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'MERCHANT_ACCESS_DENIED'
  | 'CARD_NOT_FOUND'
  | 'CARD_NOT_REDEEMABLE'
  | 'DISCOUNT_NOT_FOUND'
  | 'DISCOUNT_MERCHANT_MISMATCH'
  | 'DISCOUNT_INACTIVE'
  | 'REDEMPTION_FAILED';

export type ValidateCardErrorCode =
  | 'NOT_AUTHENTICATED'
  | 'MERCHANT_ACCESS_DENIED'
  | 'INVALID_CODE_FORMAT'
  | 'CARD_NOT_FOUND';

const REDEMPTION_MESSAGES: Record<RedemptionErrorCode, string> = {
  NOT_AUTHENTICATED: 'Your session has expired. Please sign in and try again.',
  MERCHANT_ACCESS_DENIED: 'You do not have access to this merchant account.',
  CARD_NOT_FOUND: 'No card matches that code.',
  CARD_NOT_REDEEMABLE:
    'This card has expired or is not active, so it can’t be used.',
  DISCOUNT_NOT_FOUND: 'This discount could not be found.',
  DISCOUNT_MERCHANT_MISMATCH: 'This discount does not belong to your business.',
  DISCOUNT_INACTIVE: 'This discount is no longer active.',
  REDEMPTION_FAILED: 'We could not record this redemption. Please try again.',
};

const VALIDATE_CARD_MESSAGES: Record<ValidateCardErrorCode, string> = {
  NOT_AUTHENTICATED: 'Your session has expired. Please sign in and try again.',
  MERCHANT_ACCESS_DENIED: 'You do not have access to this merchant account.',
  INVALID_CODE_FORMAT: 'That card code is not in a recognised format.',
  CARD_NOT_FOUND: 'No card matches that code.',
};

export function redemptionErrorMessage(code: RedemptionErrorCode): string {
  return REDEMPTION_MESSAGES[code] ?? REDEMPTION_MESSAGES.REDEMPTION_FAILED;
}

export function validateCardErrorMessage(code: ValidateCardErrorCode): string {
  return VALIDATE_CARD_MESSAGES[code] ?? VALIDATE_CARD_MESSAGES.CARD_NOT_FOUND;
}

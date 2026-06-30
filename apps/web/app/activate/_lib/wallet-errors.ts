/**
 * Error codes + user-facing messages for the Apple/Google Wallet save flow.
 * Pure data (no server-only or client-only imports) so the server action, the
 * Apple route handler, and the client components can share one source of truth.
 *
 * The wallet pass is cosmetic — it grants no entitlement (the merchant validates
 * redemption against the DB at point of sale), so there is no enumeration concern
 * and messages can be specific. Every failure still carries a `reference` for
 * support to trace the matching server log + Sentry event.
 */

export type WalletErrorCode =
  | 'WALLET_NOT_CONFIGURED'
  | 'WALLET_GENERATION_FAILED'
  | 'CARD_NOT_FOUND'
  | 'WALLET_SYNC_FAILED'
  | 'WALLET_REGISTRATION_INVALID'
  | 'WALLET_PASS_AUTH_FAILED';

const WALLET_MESSAGES: Record<WalletErrorCode, string> = {
  WALLET_NOT_CONFIGURED:
    'Wallet is temporarily unavailable. Please try again later.',
  WALLET_GENERATION_FAILED:
    "We couldn't generate your wallet pass. Please try again.",
  CARD_NOT_FOUND: 'We could not find a card matching that code.',
  WALLET_SYNC_FAILED: 'We could not sync your wallet pass. Please try again.',
  WALLET_REGISTRATION_INVALID: 'This wallet pass registration is not valid.',
  WALLET_PASS_AUTH_FAILED: 'This wallet pass could not be authenticated.',
};

export function walletErrorMessage(code: WalletErrorCode): string {
  return WALLET_MESSAGES[code] ?? WALLET_MESSAGES.WALLET_GENERATION_FAILED;
}

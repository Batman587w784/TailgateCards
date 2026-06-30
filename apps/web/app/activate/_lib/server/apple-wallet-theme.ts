import 'server-only';

/** Core Tailgate navy — lifted slightly for Wallet legibility while staying on-brand. */
export const WALLET_BRAND_RGB = { r: 16, g: 32, b: 96 } as const;

/** Mid-tone band for the merchant strip gradient. */
export const WALLET_STRIP_RGB = { r: 32, g: 58, b: 130 } as const;

/** Warm accent suggesting savings / ready-to-redeem value. */
export const WALLET_ACCENT_RGB = { r: 212, g: 175, b: 55 } as const;

export const WALLET_LOGO_PLATE_RGB = { r: 255, g: 255, b: 255, alpha: 1 } as const;

export const WALLET_PASS_COLORS = {
  background: 'rgb(16, 32, 96)',
  foreground: 'rgb(255, 255, 255)',
  label: 'rgb(186, 198, 218)',
} as const;

export const FRONT_CHECKOUT_ACTION = 'Show this card at checkout';
export const FRONT_DISCOUNTS_HINT = 'Tap ⋯ then ⓘ to see all your discounts';

export const BACK_DISCOUNTS_INTRO =
  'Show this card at checkout. Your offers are listed below.';

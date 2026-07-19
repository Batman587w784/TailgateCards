import 'server-only';

import { SignJWT, importPKCS8 } from 'jose';

import { getLogger } from '@kit/shared/logger';

import type { ResolvedDiscount } from './resolve-card';

const SAVE_URL_PREFIX = 'https://pay.google.com/gp/v/save/';
const JWT_AUDIENCE = 'google';
const JWT_TYPE = 'savetowallet';

// Google renders at most 10 text modules from the object (extras are silently
// dropped). The curated front modules (card_code, expires, offers, batch) take
// up to 4 of those, so the offer list fills the remaining slots; any overflow
// is silent and summarised by the "N offers" module above.
const MAX_OBJECT_TEXT_MODULES = 10;

export interface BuildSaveUrlInput {
  cardCode: string;
  cardType: 'physical' | 'digital';
  organizationName: string;
  batchName: string | null;
  expiresAt: string | null;
  discountCount: number;
  discounts: ResolvedDiscount[];
}

const LOGO_PATH = '/wallet/tailgate-icon.png';
const APP_PATH = '/dashboard';
const CARD_BACKGROUND_HEX = '#000456';

export interface WalletConfig {
  issuerId: string;
  classId: string;
  saEmail: string;
  privateKeyPem: string;
  logoUrl: string;
  appUrl: string;
}

export function readConfig(): WalletConfig {
  const issuerId = process.env.GOOGLE_WALLET_ISSUER_ID;
  const classId = process.env.GOOGLE_WALLET_CLASS_ID;
  const saEmail = process.env.GOOGLE_WALLET_SA_EMAIL;
  const rawKey = process.env.GOOGLE_WALLET_SA_PRIVATE_KEY;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  // Google fetches the logo server-side, so it must be a publicly reachable
  // HTTPS URL. In local dev `NEXT_PUBLIC_SITE_URL` points at localhost, which
  // Google can't reach — set GOOGLE_WALLET_LOGO_URL to a hosted asset instead.
  const logoOverride = process.env.GOOGLE_WALLET_LOGO_URL;

  if (!issuerId || !classId || !saEmail || !rawKey || !siteUrl) {
    throw new Error('WALLET_NOT_CONFIGURED');
  }

  return {
    issuerId,
    classId,
    saEmail,
    privateKeyPem: rawKey.replace(/\\n/g, '\n'),
    logoUrl: logoOverride ?? new URL(LOGO_PATH, siteUrl).toString(),
    appUrl: new URL(APP_PATH, siteUrl).toString(),
  };
}

function formatExpires(expiresAt: string | null): string | null {
  if (!expiresAt) return null;
  const d = new Date(expiresAt);
  if (isNaN(d.getTime())) return null;
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${month} / ${d.getUTCFullYear()}`;
}

function buildGenericClass(config: WalletConfig) {
  return {
    id: config.classId,
    classTemplateInfo: {
      cardTemplateOverride: {
        cardRowTemplateInfos: [
          {
            twoItems: {
              startItem: {
                firstValue: {
                  fields: [
                    { fieldPath: "object.textModulesData['card_code']" },
                  ],
                },
              },
              endItem: {
                firstValue: {
                  fields: [{ fieldPath: "object.textModulesData['expires']" }],
                },
              },
            },
          },
          {
            twoItems: {
              startItem: {
                firstValue: {
                  fields: [{ fieldPath: "object.textModulesData['offers']" }],
                },
              },
              endItem: {
                firstValue: {
                  fields: [{ fieldPath: "object.textModulesData['batch']" }],
                },
              },
            },
          },
        ],
      },
    },
  };
}

export function buildTextModules(input: BuildSaveUrlInput) {
  const modules: Array<{ id: string; header: string; body: string }> = [
    { id: 'card_code', header: 'Card', body: input.cardCode },
  ];

  const expires = formatExpires(input.expiresAt);
  if (expires) {
    modules.push({ id: 'expires', header: 'Expires', body: expires });
  }

  if (input.discountCount > 0) {
    const noun = input.discountCount === 1 ? 'offer' : 'offers';
    modules.push({
      id: 'offers',
      header: 'Offers',
      body: `${input.discountCount} ${noun}`,
    });
  }

  if (input.cardType === 'physical' && input.batchName) {
    modules.push({ id: 'batch', header: 'Batch', body: input.batchName });
  }

  // Offer list: one module per discount (merchant name as header, offer title
  // as body). These ids aren't referenced by the class card template, so Google
  // surfaces them in the expanded "Pass Details" view below the QR rather than
  // on the card face. Capped at the remaining object-module budget.
  const remainingSlots = MAX_OBJECT_TEXT_MODULES - modules.length;
  if (remainingSlots > 0) {
    input.discounts.slice(0, remainingSlots).forEach((discount, index) => {
      modules.push({
        id: `discount_${index}`,
        header: discount.merchantName,
        body: discount.title,
      });
    });
  }

  return modules;
}

export function buildGenericObject(
  config: WalletConfig,
  input: BuildSaveUrlInput,
) {
  return {
    id: `${config.issuerId}.${input.cardCode}`,
    classId: config.classId,
    state: 'ACTIVE',
    // R0 — native expiry so Google Wallet greys the pass once the card lapses,
    // with no server push. Extensions re-issue with a later end date.
    ...(input.expiresAt
      ? {
          validTimeInterval: {
            end: { date: new Date(input.expiresAt).toISOString() },
          },
        }
      : {}),
    logo: {
      sourceUri: { uri: config.logoUrl },
      contentDescription: {
        defaultValue: { language: 'en-US', value: 'Tailgate logo' },
      },
    },
    hexBackgroundColor: CARD_BACKGROUND_HEX,
    cardTitle: {
      defaultValue: { language: 'en-US', value: 'Tailgate Discount' },
    },
    header: {
      defaultValue: { language: 'en-US', value: input.organizationName },
    },
    textModulesData: buildTextModules(input),
    linksModuleData: {
      uris: [
        {
          id: 'app_home',
          uri: config.appUrl,
          description: 'Open Tailgate',
        },
      ],
    },
    barcode: {
      type: 'QR_CODE',
      value: input.cardCode,
      alternateText: input.cardCode,
    },
  };
}

/**
 * Signs a Google Wallet save-to-wallet JWT and returns the pay.google.com URL
 * that, when opened, prompts the user to add the pass.
 *
 * The GenericClass is inlined in the payload so Google creates (or upserts) it
 * on the first save — no separate bootstrap is required.
 *
 * Throws 'WALLET_NOT_CONFIGURED' if any required env var is missing.
 */
export async function buildSaveUrlForCard(
  input: BuildSaveUrlInput,
): Promise<string> {
  const config = readConfig();
  const logger = await getLogger();

  try {
    const privateKey = await importPKCS8(config.privateKeyPem, 'RS256');

    const payload = {
      iss: config.saEmail,
      aud: JWT_AUDIENCE,
      typ: JWT_TYPE,
      iat: Math.floor(Date.now() / 1000),
      payload: {
        genericClasses: [buildGenericClass(config)],
        genericObjects: [buildGenericObject(config, input)],
      },
    };

    const jwt = await new SignJWT(payload)
      .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
      .sign(privateKey);

    return `${SAVE_URL_PREFIX}${jwt}`;
  } catch (err) {
    logger.error(
      { err, cardCode: input.cardCode },
      'Failed to sign Google Wallet JWT',
    );
    throw new Error('WALLET_GENERATION_FAILED');
  }
}

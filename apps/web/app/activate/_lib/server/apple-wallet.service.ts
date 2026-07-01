import 'server-only';

import { PKPass } from 'passkit-generator';

import { getLogger } from '@kit/shared/logger';

import { appleWalletAssetBuffers } from './apple-wallet-assets';
import { buildPassLogoBuffers } from './apple-wallet-logo.service';
import { buildMerchantStripBuffers } from './apple-wallet-strip.service';
import {
  FRONT_DISCOUNTS_HINT,
  WALLET_PASS_COLORS,
} from './apple-wallet-theme';
import { generatePassAuthToken } from './pass-auth-token';
import type { ResolvedDiscount } from './resolve-card';

interface BuildPassInput {
  cardCode: string;
  cardType?: 'physical' | 'digital';
  organizationName?: string;
  organizationLogoUrl?: string | null;
  batchName?: string | null;
  expiresAt?: string | null;
  discountCount?: number;
  discounts?: ResolvedDiscount[];
}

function formatExpires(expiresAt: string | null | undefined): string | null {
  if (!expiresAt) return null;
  const d = new Date(expiresAt);
  if (isNaN(d.getTime())) return null;
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${month} / ${d.getUTCFullYear()}`;
}

const PASS_DESCRIPTION = 'Tailgate Discount Card';
const APP_PATH = '/dashboard';

interface AppleWalletConfig {
  passTypeIdentifier: string;
  teamIdentifier: string;
  organizationName: string;
  signerCert: string;
  signerKey: string;
  signerKeyPassphrase?: string;
  wwdr: string;
}

function readConfig(): AppleWalletConfig {
  const passTypeIdentifier = process.env.APPLE_WALLET_PASS_TYPE_ID;
  const teamIdentifier = process.env.APPLE_WALLET_TEAM_ID;
  const organizationName = process.env.APPLE_WALLET_ORGANIZATION_NAME;
  const signerCertRaw = process.env.APPLE_WALLET_SIGNER_CERT_PEM;
  const signerKeyRaw = process.env.APPLE_WALLET_SIGNER_KEY_PEM;
  const wwdrRaw = process.env.APPLE_WALLET_WWDR_CERT_PEM;
  const signerKeyPassphrase = process.env.APPLE_WALLET_SIGNER_KEY_PASSPHRASE;

  if (
    !passTypeIdentifier ||
    !teamIdentifier ||
    !organizationName ||
    !signerCertRaw ||
    !signerKeyRaw ||
    !wwdrRaw
  ) {
    throw new Error('WALLET_NOT_CONFIGURED');
  }

  const unescape = (s: string) => s.replace(/\\n/g, '\n');

  return {
    passTypeIdentifier,
    teamIdentifier,
    organizationName,
    signerCert: unescape(signerCertRaw),
    signerKey: unescape(signerKeyRaw),
    signerKeyPassphrase: signerKeyPassphrase || undefined,
    wwdr: unescape(wwdrRaw),
  };
}

async function attachDynamicAssets(
  pass: PKPass,
  discounts: ResolvedDiscount[] | undefined,
) {
  const logoBuffers = await buildPassLogoBuffers();
  for (const [filename, buffer] of Object.entries(logoBuffers)) {
    pass.addBuffer(filename, buffer);
  }

  if (discounts && discounts.length > 0) {
    const stripBuffers = await buildMerchantStripBuffers(discounts);
    if (stripBuffers) {
      for (const [filename, buffer] of Object.entries(stripBuffers)) {
        pass.addBuffer(filename, buffer);
      }
    }
  }
}

/**
 * Generates a signed .pkpass binary for the given card.
 *
 * The pass is designed for the primary cardholder flow: show the pass at a
 * merchant without scanning. The front highlights active discounts and merchant
 * logos (strip image); the card code and QR remain for merchants who scan. The
 * full offer list lives on the back. An unresolved card falls back to a minimal
 * code-only pass.
 *
 * Throws 'WALLET_NOT_CONFIGURED' if any required env var is missing,
 * 'WALLET_GENERATION_FAILED' for any signing/IO error.
 */
export async function buildPassForCard({
  cardCode,
  cardType,
  organizationName,
  batchName,
  expiresAt,
  discountCount,
  discounts,
}: BuildPassInput): Promise<Buffer> {
  const config = readConfig();
  const logger = await getLogger();

  const siteUrlForService = process.env.NEXT_PUBLIC_SITE_URL;
  const canUpdate = Boolean(
    siteUrlForService && process.env.WALLET_PASS_AUTH_SECRET,
  );

  const offerCount = discountCount ?? discounts?.length ?? 0;

  try {
    const pass = new PKPass(
      appleWalletAssetBuffers,
      {
        wwdr: config.wwdr,
        signerCert: config.signerCert,
        signerKey: config.signerKey,
        signerKeyPassphrase: config.signerKeyPassphrase,
      },
      {
        formatVersion: 1,
        passTypeIdentifier: config.passTypeIdentifier,
        teamIdentifier: config.teamIdentifier,
        organizationName: config.organizationName,
        serialNumber: cardCode,
        description: PASS_DESCRIPTION,
        backgroundColor: WALLET_PASS_COLORS.background,
        foregroundColor: WALLET_PASS_COLORS.foreground,
        labelColor: WALLET_PASS_COLORS.label,
        ...(canUpdate
          ? {
              webServiceURL: new URL(
                '/api/wallet/apple',
                siteUrlForService,
              ).toString(),
              authenticationToken: generatePassAuthToken(cardCode),
            }
          : {}),
      },
    );

    pass.type = 'storeCard';

    pass.headerFields.push({
      key: 'header',
      label: 'Tailgate',
      value: organizationName ?? 'Discount Card',
    });

    if (offerCount > 0 && discounts && discounts.length > 0) {
      // Banner shows the merchant logos on its own — no text stamped over them.
      pass.secondaryFields.push({
        key: 'more_offers',
        label: '',
        value: FRONT_DISCOUNTS_HINT,
      });
    } else {
      pass.primaryFields.push({
        key: 'card_code',
        label: 'Card number',
        value: cardCode,
      });
    }

    const expires = formatExpires(expiresAt);
    pass.auxiliaryFields.push({
      key: 'card_code',
      label: 'Card number',
      value: cardCode,
    });

    if (expires) {
      pass.auxiliaryFields.push({
        key: 'expires',
        label: 'Expires',
        value: expires,
      });
    } else if (cardType === 'physical' && batchName) {
      pass.auxiliaryFields.push({
        key: 'batch',
        label: 'Batch',
        value: batchName,
      });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
    if (siteUrl) {
      const shareUrl = new URL(
        `/share/${encodeURIComponent(cardCode)}`,
        siteUrl,
      ).toString();
      pass.backFields.push({
        key: 'share',
        label: 'Share',
        value: shareUrl,
        attributedValue: `<a href="${shareUrl}">Share with friends</a>`,
      });

      const appUrl = new URL(APP_PATH, siteUrl).toString();
      pass.backFields.push({
        key: 'app_link',
        label: 'Tailgate',
        value: appUrl,
        attributedValue: `<a href="${appUrl}">View all discounts in Tailgate</a>`,
      });
    }

    await attachDynamicAssets(pass, discounts);

    if (expiresAt) {
      const expiryDate = new Date(expiresAt);
      if (!isNaN(expiryDate.getTime())) {
        pass.setExpirationDate(expiryDate);
      }
    }

    pass.setBarcodes({
      format: 'PKBarcodeFormatQR',
      message: cardCode,
      altText: cardCode,
      messageEncoding: 'iso-8859-1',
    });

    return pass.getAsBuffer();
  } catch (err) {
    logger.error({ err, cardCode }, 'Failed to sign Apple Wallet pass');
    throw new Error('WALLET_GENERATION_FAILED');
  }
}

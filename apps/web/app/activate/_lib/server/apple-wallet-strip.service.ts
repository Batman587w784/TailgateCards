import 'server-only';

import sharp from 'sharp';

import { getLogger } from '@kit/shared/logger';

import { fetchTrustedImageBuffer } from './fetch-trusted-image';
import { WALLET_ACCENT_RGB, WALLET_BRAND_RGB, WALLET_STRIP_RGB } from './apple-wallet-theme';
import type { ResolvedDiscount } from './resolve-card';

const STRIP_BASE_WIDTH = 375;
const STRIP_BASE_HEIGHT = 123;
const MAX_VISIBLE_MERCHANTS = 5;
const LOGO_DIAMETER = 40;
const LOGO_GAP = 12;
const LOGO_BOTTOM_INSET = 10;

const AVATAR_RING = `rgb(${WALLET_ACCENT_RGB.r}, ${WALLET_ACCENT_RGB.g}, ${WALLET_ACCENT_RGB.b})`;
const AVATAR_FILL = `rgb(${WALLET_STRIP_RGB.r}, ${WALLET_STRIP_RGB.g}, ${WALLET_STRIP_RGB.b})`;

interface MerchantVisual {
  merchantName: string;
  logoUrl: string | null;
}

function uniqueMerchants(discounts: ResolvedDiscount[]): MerchantVisual[] {
  const seen = new Set<string>();
  const merchants: MerchantVisual[] = [];

  for (const discount of discounts) {
    if (seen.has(discount.merchantName)) continue;
    seen.add(discount.merchantName);
    merchants.push({
      merchantName: discount.merchantName,
      logoUrl: discount.logoUrl,
    });
  }

  return merchants;
}

async function makeStripBackground(
  width: number,
  height: number,
): Promise<Buffer> {
  // Match the pass background exactly so the strip reads as one seamless
  // surface — no muddy gradient band. Only the merchant chips stand out.
  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: { ...WALLET_BRAND_RGB, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

async function makeInitialAvatar(letter: string, size: number): Promise<Buffer> {
  const safeLetter =
    letter.replace(/[^A-Za-z0-9]/g, '').slice(0, 1).toUpperCase() || '?';
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="#ffffff"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="${AVATAR_FILL}"/>
    <text x="50%" y="54%" text-anchor="middle" fill="#ffffff" font-size="${Math.round(size * 0.42)}" font-family="system-ui, -apple-system, sans-serif" font-weight="600">${safeLetter}</text>
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function makeCircularLogo(source: Buffer, size: number): Promise<Buffer> {
  const mask = Buffer.from(
    `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/>
    </svg>`,
  );

  return sharp(source)
    .resize(size, size, { fit: 'cover' })
    .png()
    .composite([{ input: mask, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

async function resolveMerchantLogo(
  merchant: MerchantVisual,
  size: number,
): Promise<Buffer> {
  if (merchant.logoUrl) {
    const remote = await fetchTrustedImageBuffer(merchant.logoUrl);
    if (remote) {
      try {
        return await makeCircularLogo(remote, size);
      } catch {
        // Fall through to the initial avatar.
      }
    }
  }

  return makeInitialAvatar(merchant.merchantName, size);
}

async function makeOverflowBadge(count: number, size: number): Promise<Buffer> {
  const label = `+${count}`;
  const svg = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="${AVATAR_RING}"/>
    <text x="50%" y="54%" text-anchor="middle" fill="#ffffff" font-size="${Math.round(size * 0.34)}" font-family="system-ui, -apple-system, sans-serif" font-weight="600">${label}</text>
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}

async function buildStripAtScale(
  merchants: MerchantVisual[],
  scale: number,
): Promise<Buffer> {
  const width = STRIP_BASE_WIDTH * scale;
  const height = STRIP_BASE_HEIGHT * scale;
  const logoSize = LOGO_DIAMETER * scale;
  const gap = LOGO_GAP * scale;
  const bottomInset = LOGO_BOTTOM_INSET * scale;

  const visible = merchants.slice(0, MAX_VISIBLE_MERCHANTS);
  const overflow = merchants.length - visible.length;
  const slotCount = visible.length + (overflow > 0 ? 1 : 0);
  const rowWidth = slotCount * logoSize + Math.max(0, slotCount - 1) * gap;
  const startX = Math.max(0, Math.round((width - rowWidth) / 2));
  const logoY = height - logoSize - bottomInset;

  const logos = await Promise.all(
    visible.map((merchant) => resolveMerchantLogo(merchant, logoSize)),
  );

  const composites: sharp.OverlayOptions[] = logos.map((logo, index) => ({
    input: logo,
    left: startX + index * (logoSize + gap),
    top: logoY,
  }));

  if (overflow > 0) {
    const badge = await makeOverflowBadge(overflow, logoSize);
    composites.push({
      input: badge,
      left: startX + visible.length * (logoSize + gap),
      top: logoY,
    });
  }

  const background = await makeStripBackground(width, height);

  return sharp(background).composite(composites).png().toBuffer();
}

/**
 * Builds Apple Wallet strip images showing merchant logos along the lower band.
 * The upper area blends with the pass background so primary text stays clear.
 */
export async function buildMerchantStripBuffers(
  discounts: ResolvedDiscount[],
): Promise<Record<string, Buffer> | null> {
  const merchants = uniqueMerchants(discounts);
  if (merchants.length === 0) return null;

  try {
    const [strip, strip2x, strip3x] = await Promise.all([
      buildStripAtScale(merchants, 1),
      buildStripAtScale(merchants, 2),
      buildStripAtScale(merchants, 3),
    ]);

    return {
      'strip.png': strip,
      'strip@2x.png': strip2x,
      'strip@3x.png': strip3x,
    };
  } catch (err) {
    const logger = await getLogger();
    logger.warn({ err }, 'Strip image generation failed; omitting strip assets');
    return null;
  }
}

import 'server-only';

import sharp from 'sharp';

import { appleWalletAssetBuffers } from './apple-wallet-assets';

const LOGO_WIDTH = 160;
const LOGO_HEIGHT = 50;

/**
 * Renders any logo as a white silhouette using the source alpha channel so it
 * stays crisp on dark navy passes.
 */
async function toWhiteSilhouette(
  source: Buffer,
  canvasWidth: number,
  canvasHeight: number,
): Promise<Buffer> {
  const fitted = await sharp(source)
    .resize(canvasWidth, canvasHeight, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .ensureAlpha()
    .png()
    .toBuffer();

  const meta = await sharp(fitted).metadata();
  const width = meta.width ?? canvasWidth;
  const height = meta.height ?? canvasHeight;

  const alpha = await sharp(fitted).extractChannel('alpha').toBuffer();

  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .joinChannel(alpha)
    .png()
    .toBuffer();
}

async function buildLogoSet(source: Buffer): Promise<Record<string, Buffer>> {
  const [logo, logo2x, logo3x] = await Promise.all([
    toWhiteSilhouette(source, LOGO_WIDTH, LOGO_HEIGHT),
    toWhiteSilhouette(source, LOGO_WIDTH * 2, LOGO_HEIGHT * 2),
    toWhiteSilhouette(source, LOGO_WIDTH * 3, LOGO_HEIGHT * 3),
  ]);

  return {
    'logo.png': logo,
    'logo@2x.png': logo2x,
    'logo@3x.png': logo3x,
  };
}

/**
 * Always uses the bundled Tailgate mark in the pass logo slot so branding is
 * consistent and readable. The organization name appears in the header field.
 */
export async function buildPassLogoBuffers(): Promise<Record<string, Buffer>> {
  return buildLogoSet(appleWalletAssetBuffers['logo.png']!);
}

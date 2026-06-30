import 'server-only';

import { SignJWT, importPKCS8 } from 'jose';

import { getLogger } from '@kit/shared/logger';

import {
  type BuildSaveUrlInput,
  buildGenericObject,
  readConfig,
} from './google-wallet.service';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const WALLET_OBJECT_BASE =
  'https://walletobjects.googleapis.com/walletobjects/v1/genericObject';
const SCOPE = 'https://www.googleapis.com/auth/wallet_object.issuer';

async function getAccessToken(
  saEmail: string,
  privateKeyPem: string,
): Promise<string> {
  const key = await importPKCS8(privateKeyPem, 'RS256');
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: 'RS256', typ: 'JWT' })
    .setIssuer(saEmail)
    .setAudience(TOKEN_URL)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(key);

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion,
    }),
  });
  if (!res.ok) {
    throw new Error(`GOOGLE_TOKEN_FAILED:${res.status}`);
  }
  const json = (await res.json()) as { access_token: string };
  return json.access_token;
}

export type GoogleUpdateResult = 'updated' | 'not_saved' | 'failed';

/**
 * Patches an already-saved Google Wallet object with refreshed content. Returns
 * 'not_saved' on 404 (object never created), 'failed' on other errors, so the
 * worker can decide whether to retry. Reuses buildGenericObject so the patched
 * fields exactly match the save-flow layout.
 */
export async function updateGoogleWalletObject(
  input: BuildSaveUrlInput,
): Promise<GoogleUpdateResult> {
  const logger = await getLogger();
  let config;
  try {
    config = readConfig();
  } catch {
    return 'failed';
  }

  try {
    const token = await getAccessToken(config.saEmail, config.privateKeyPem);
    const object = buildGenericObject(config, input);
    const resourceId = object.id; // `${issuerId}.${cardCode}`

    const res = await fetch(`${WALLET_OBJECT_BASE}/${resourceId}`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      // Patch the mutable content fields; leave id/classId/barcode untouched.
      body: JSON.stringify({
        header: object.header,
        textModulesData: object.textModulesData,
      }),
    });

    if (res.status === 404) return 'not_saved';
    if (!res.ok) {
      logger.error(
        { name: 'wallet.google.update', resourceId, status: res.status },
        'Google Wallet object PATCH failed',
      );
      return 'failed';
    }
    return 'updated';
  } catch (err) {
    logger.error(
      { name: 'wallet.google.update', cardCode: input.cardCode, err },
      'Google Wallet update threw',
    );
    return 'failed';
  }
}

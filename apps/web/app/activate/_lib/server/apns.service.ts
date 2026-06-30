import 'server-only';

import { SignJWT, importPKCS8 } from 'jose';
import http2 from 'node:http2';

import { getLogger } from '@kit/shared/logger';

const APNS_HOST = 'https://api.push.apple.com';

interface ApnsConfig {
  authKey: string;
  keyId: string;
  teamId: string;
  topic: string;
}

function readApnsConfig(): ApnsConfig | null {
  const authKey = process.env.APNS_AUTH_KEY;
  const keyId = process.env.APNS_KEY_ID;
  const teamId = process.env.APPLE_WALLET_TEAM_ID;
  const topic = process.env.APPLE_WALLET_PASS_TYPE_ID;
  if (!authKey || !keyId || !teamId || !topic) return null;
  return { authKey: authKey.replace(/\\n/g, '\n'), keyId, teamId, topic };
}

// APNs provider tokens are valid up to 60 min; refresh well within that.
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getProviderToken(config: ApnsConfig): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedToken.expiresAt > now + 60) {
    return cachedToken.value;
  }
  const key = await importPKCS8(config.authKey, 'ES256');
  const value = await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: config.keyId })
    .setIssuer(config.teamId)
    .setIssuedAt(now)
    .sign(key);
  cachedToken = { value, expiresAt: now + 3000 };
  return value;
}

export type ApnsResult =
  | { status: 'sent' }
  | { status: 'gone' } // 410 — token invalid, prune the registration
  | { status: 'failed'; code: number };

/**
 * Sends an empty PassKit update push to one device token. Wallet update pushes
 * carry an empty `{}` payload; the device responds by re-fetching the pass.
 * Returns 'gone' on HTTP 410 so the caller can delete the dead registration.
 */
export async function sendPassUpdatePush(
  pushToken: string,
): Promise<ApnsResult> {
  const logger = await getLogger();
  const config = readApnsConfig();
  if (!config) return { status: 'failed', code: 0 };

  const jwt = await getProviderToken(config);

  return new Promise<ApnsResult>((resolve) => {
    const client = http2.connect(APNS_HOST);

    // Resolve + tear down exactly once, whichever event fires first (connection
    // error, request error, or response end). Guards against double-close and a
    // dangling request stream / unsettled promise.
    let settled = false;
    const finish = (result: ApnsResult) => {
      if (settled) return;
      settled = true;
      client.destroy();
      resolve(result);
    };

    client.on('error', (err) => {
      logger.error({ name: 'wallet.apns', err }, 'APNs connection error');
      finish({ status: 'failed', code: 0 });
    });

    const req = client.request({
      ':method': 'POST',
      ':path': `/3/device/${pushToken}`,
      authorization: `bearer ${jwt}`,
      'apns-topic': config.topic,
      // Pass pushes are a silent nudge ("re-fetch this pass"), not a visible
      // notification — Wallet decides what to show from the changed fields.
      // Hence background/5; the payload stays an empty {} per the PassKit spec.
      'apns-push-type': 'background',
      'apns-priority': '5',
      'content-type': 'application/json',
    });

    let status = 0;
    req.on('response', (headers) => {
      status = Number(headers[':status'] ?? 0);
    });
    req.setEncoding('utf8');
    let data = '';
    req.on('data', (chunk) => (data += chunk));
    req.on('end', () => {
      if (status === 200) return finish({ status: 'sent' });
      if (status === 410) return finish({ status: 'gone' });
      logger.warn({ name: 'wallet.apns', status, data }, 'APNs push non-200');
      finish({ status: 'failed', code: status });
    });
    req.on('error', (err) => {
      logger.error({ name: 'wallet.apns', err }, 'APNs request error');
      finish({ status: 'failed', code: 0 });
    });

    req.write('{}');
    req.end();
  });
}

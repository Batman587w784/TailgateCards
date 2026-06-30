'use server';

import { cookies } from 'next/headers';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { getUserMerchantId } from '../../../_lib/server/role-guards';
import { VerifyPasscodeSchema } from '../../../entities/_lib/schemas/passcode.schema';

const PASSCODE_COOKIE_NAME = 'merchant_passcode_verified';

export const verifyPasscodeAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const merchantAccountId = await getUserMerchantId();

    if (!merchantAccountId) {
      throw new Error('User is not a merchant');
    }

    const { data: isValid, error } = await client.rpc(
      'verify_merchant_passcode',
      {
        target_account_id: merchantAccountId,
        input_passcode: data.passcode.toUpperCase(),
      },
    );

    if (error) {
      throw error;
    }

    if (!isValid) {
      return { success: false, error: 'Invalid passcode' };
    }

    const cookieStore = await cookies();
    cookieStore.set(PASSCODE_COOKIE_NAME, merchantAccountId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
    });

    return { success: true };
  },
  {
    schema: VerifyPasscodeSchema,
  },
);

export async function isPasscodeVerified(): Promise<boolean> {
  const merchantAccountId = await getUserMerchantId();
  if (!merchantAccountId) return false;

  const cookieStore = await cookies();
  const verifiedAccountId = cookieStore.get(PASSCODE_COOKIE_NAME)?.value;

  return verifiedAccountId === merchantAccountId;
}

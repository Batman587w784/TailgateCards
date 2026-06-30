import { NextResponse } from 'next/server';

import { enhanceRouteHandler } from '@kit/next/routes';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  parseApplePassAuthorization,
  verifyPassAuthToken,
} from '~/activate/_lib/server/pass-auth-token';

// POST: register a device to receive updates for a pass serial.
export const POST = enhanceRouteHandler(
  async ({ request, params }) => {
    const deviceLibraryIdentifier = params.deviceLibraryIdentifier!;
    const passTypeIdentifier = params.passTypeIdentifier!;
    const serialNumber = params.serialNumber!;
    const logger = await getLogger();
    const ctx = { name: 'wallet.apple.register', serialNumber };

    const token = parseApplePassAuthorization(
      request.headers.get('authorization'),
    );
    if (!token || !verifyPassAuthToken(serialNumber, token)) {
      logger.warn(ctx, 'Apple registration rejected: bad auth token');
      return new Response('Unauthorized', { status: 401 });
    }

    let pushToken: string;
    try {
      const body = (await request.json()) as { pushToken?: string };
      if (!body.pushToken) return new Response('Bad Request', { status: 400 });
      pushToken = body.pushToken;
    } catch {
      return new Response('Bad Request', { status: 400 });
    }

    const admin = getSupabaseServerAdminClient();

    // Pass serial must exist (issued via our flow) to register against.
    const { data: pass } = await admin
      .from('wallet_passes')
      .select('serial_number')
      .eq('serial_number', serialNumber)
      .maybeSingle();
    if (!pass) return new Response('Not Found', { status: 404 });

    const { error, data: existing } = await admin
      .from('wallet_pass_registrations')
      .select('device_library_identifier')
      .eq('device_library_identifier', deviceLibraryIdentifier)
      .eq('serial_number', serialNumber)
      .maybeSingle();

    if (error) {
      logger.error({ ...ctx, error: error.message }, 'register lookup failed');
      return new Response('Server Error', { status: 500 });
    }

    await admin.from('wallet_pass_registrations').upsert(
      {
        device_library_identifier: deviceLibraryIdentifier,
        serial_number: serialNumber,
        pass_type_identifier: passTypeIdentifier,
        push_token: pushToken,
      },
      { onConflict: 'device_library_identifier,serial_number' },
    );

    // 201 on first registration, 200 if already registered (PassKit spec).
    return new NextResponse(null, { status: existing ? 200 : 201 });
  },
  { auth: false },
);

// DELETE: unregister a device from a pass serial.
export const DELETE = enhanceRouteHandler(
  async ({ request, params }) => {
    const deviceLibraryIdentifier = params.deviceLibraryIdentifier!;
    const serialNumber = params.serialNumber!;

    const token = parseApplePassAuthorization(
      request.headers.get('authorization'),
    );
    if (!token || !verifyPassAuthToken(serialNumber, token)) {
      return new Response('Unauthorized', { status: 401 });
    }

    const admin = getSupabaseServerAdminClient();
    await admin
      .from('wallet_pass_registrations')
      .delete()
      .eq('device_library_identifier', deviceLibraryIdentifier)
      .eq('serial_number', serialNumber);

    return new Response(null, { status: 200 });
  },
  { auth: false },
);

import { NextResponse } from 'next/server';

import { enhanceRouteHandler } from '@kit/next/routes';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

// GET: serials registered to this device whose content changed since `passesUpdatedSince`.
export const GET = enhanceRouteHandler(
  async ({ request, params }) => {
    const deviceLibraryIdentifier = params.deviceLibraryIdentifier!;
    const since = new URL(request.url).searchParams.get('passesUpdatedSince');

    const admin = getSupabaseServerAdminClient();

    const { data: regs } = await admin
      .from('wallet_pass_registrations')
      .select('serial_number')
      .eq('device_library_identifier', deviceLibraryIdentifier);

    const serials = (regs ?? []).map((r) => r.serial_number);
    if (serials.length === 0) {
      return new Response(null, { status: 204 });
    }

    let query = admin
      .from('wallet_passes')
      .select('serial_number, content_tag')
      .in('serial_number', serials);

    if (since) {
      // `since` is the tag we previously returned (ISO timestamp).
      query = query.gt('content_tag', since);
    }

    const { data: passes } = await query;
    const changed = passes ?? [];

    if (changed.length === 0) {
      return new Response(null, { status: 204 });
    }

    const lastUpdated = changed
      .map((p) => p.content_tag)
      .sort()
      .at(-1)!;

    return NextResponse.json({
      lastUpdated,
      serialNumbers: changed.map((p) => p.serial_number),
    });
  },
  { auth: false },
);

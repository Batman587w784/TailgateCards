import { NextResponse } from 'next/server';

import { isSuperAdmin } from '@kit/admin';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;

  const client = getSupabaseServerClient();

  // Verify super admin
  const isAdmin = await isSuperAdmin(client);
  if (!isAdmin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }

  // Get organization card prefix
  const { data, error } = await client
    .from('accounts')
    .select('card_prefix')
    .eq('id', id)
    .single();

  if (error) {
    return NextResponse.json({ prefix: null });
  }

  return NextResponse.json({ prefix: data?.card_prefix ?? null });
}

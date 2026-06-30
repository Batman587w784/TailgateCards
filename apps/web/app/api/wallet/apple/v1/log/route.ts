import { enhanceRouteHandler } from '@kit/next/routes';
import { getLogger } from '@kit/shared/logger';

// POST: Apple devices report errors here. Always 200.
export const POST = enhanceRouteHandler(
  async ({ request }) => {
    const logger = await getLogger();
    try {
      const body = (await request.json()) as { logs?: string[] };
      logger.info(
        { name: 'wallet.apple.log', logs: body.logs ?? [] },
        'Apple Wallet device log',
      );
    } catch {
      // ignore malformed bodies
    }
    return new Response(null, { status: 200 });
  },
  { auth: false },
);

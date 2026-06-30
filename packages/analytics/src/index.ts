import { createGoogleAnalyticsService } from '@kit/google-analytics';

import { createAnalyticsManager } from './analytics-manager';
import type { AnalyticsManager } from './types';

export const analytics: AnalyticsManager = createAnalyticsManager({
  providers: {
    'google-analytics': createGoogleAnalyticsService,
  },
});

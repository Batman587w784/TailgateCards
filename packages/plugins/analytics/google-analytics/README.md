## Google Analytics Plugin

Install the plugin with the following command:

```bash
npx @makerkit/cli plugins install
```

Then choose the Plugin from the list of available plugins.

### Install Plugin in the Analytics package

To install the plugin in the Analytics package, run the following command:

```bash
pnpm add "@kit/google-analytics@workspace:*" --filter analytics -D
```

You can now use the Google Analytics plugin in the Analytics package. Update the `packages/analytics/src/index.ts` file as follows:

```tsx
import { createGoogleAnalyticsService } from '@kit/google-analytics';

import { createAnalyticsManager } from './analytics-manager';
import type { AnalyticsManager } from './types';

export const analytics: AnalyticsManager = createAnalyticsManager({
    providers: {
        'google-analytics': createGoogleAnalyticsService,
    },
});
```

## Configuration

Please add the following environment variables to your `.env` file:

```bash
NEXT_PUBLIC_GA_MEASUREMENT_ID=your-measurement-id
```

This is the Measurement ID of your Google Analytics property. You can find it in the Google Analytics dashboard.
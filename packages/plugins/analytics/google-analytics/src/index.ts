declare global {
  interface Window {
    dataLayer: unknown[];
  }
}

type GtagCommand = 'config' | 'event' | 'set' | 'js' | 'consent';

/**
 * Google Analytics Measurement ID.
 */
const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;

/**
 * Disable tracking on localhost.
 */
const DISABLE_LOCALHOST_TRACKING =
  process.env.NEXT_PUBLIC_GA_DISABLE_LOCALHOST_TRACKING ?? 'true';

/**
 * Disable tracking of page views.
 */
const DISABLE_PAGEVIEWS_TRACKING =
  process.env.NEXT_PUBLIC_GA_DISABLE_PAGE_VIEWS_TRACKING ?? 'false';

/**
 * Create a Google Analytics service.
 */
export function createGoogleAnalyticsService(
  props: {
    measurementId: string;
    disableLocalhostTracking?: boolean;
    disablePageViewsTracking?: boolean;
  } = {
    measurementId: GA_MEASUREMENT_ID!,
    disableLocalhostTracking: DISABLE_LOCALHOST_TRACKING === 'true',
    disablePageViewsTracking: DISABLE_PAGEVIEWS_TRACKING === 'true',
  },
) {
  const measurementId = props.measurementId || GA_MEASUREMENT_ID;

  const disableLocalhostTracking =
    props.disableLocalhostTracking ?? DISABLE_LOCALHOST_TRACKING === 'true';

  const disablePageViewsTracking =
    props.disablePageViewsTracking ?? DISABLE_PAGEVIEWS_TRACKING === 'true';

  if (!measurementId) {
    throw new Error(
      'GA_MEASUREMENT_ID is not set. Please set the environment variable NEXT_PUBLIC_GA_MEASUREMENT_ID.',
    );
  }

  return new GoogleAnalyticsService(
    measurementId,
    disableLocalhostTracking,
    disablePageViewsTracking,
  );
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function gtag(command: GtagCommand, ...args: unknown[]) {
  if (typeof window === 'undefined') {
    return;
  }

  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments);
}

/**
 * Google Analytics service that sends events to Google Analytics 4.
 */
class GoogleAnalyticsService {
  private initialized = false;

  constructor(
    private readonly measurementId: string,
    disableLocalhostTracking: boolean,
    private disablePageViewsTracking: boolean,
  ) {
    if (typeof window === 'undefined') {
      return;
    }

    window.dataLayer = window.dataLayer || [];

    if (disableLocalhostTracking) {
      this.setLocalHostTrackingDisabled();
    }
  }

  createGtagScript() {
    const script = document.createElement('script');

    script.src = `https://www.googletagmanager.com/gtag/js?id=${this.measurementId}`;
    script.async = true;

    document.head.appendChild(script);

    script.onload = () => {
      this.initialized = true;

      gtag('config', this.measurementId, {
        send_page_view: false,
      });

      gtag('js', new Date());
    };
  }

  async initialize() {
    if (this.initialized || typeof window === 'undefined') {
      return Promise.resolve();
    }

    return this.createGtagScript();
  }

  async trackPageView(path: string) {
    if (this.disablePageViewsTracking) {
      return;
    }

    const newUrl = new URL(path, window.location.href).href;

    gtag('config', this.measurementId, {
      send_page_view: false,
      page_location: newUrl,
      update: true,
    });

    gtag('event', 'page_view');
  }

  async trackEvent(
    eventName: string,
    eventProperties: Record<string, string> = {},
  ) {
    await this.initialize();

    gtag('event', eventName, eventProperties);
  }

  async identify(userId: string, traits: Record<string, string> = {}) {
    await this.initialize();

    gtag('config', this.measurementId, {
      user_id: userId,
      ...traits,
    });
  }

  private setLocalHostTrackingDisabled() {
    if (typeof window !== 'undefined') {
      if (window.location.hostname === 'localhost') {
        // @ts-expect-error: This is a custom property
        window['ga-disable-' + this.measurementId] = true;
      }
    }
  }
}

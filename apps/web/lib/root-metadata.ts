import { Metadata, Viewport } from 'next';

import { headers } from 'next/headers';

import appConfig from '~/config/app.config';

/**
 * @name generateRootViewport
 * @description Generates the viewport configuration with safe area support for iOS
 */
export const generateRootViewport = (): Viewport => {
  return {
    viewportFit: 'cover',
  };
};

/**
 * @name generateRootMetadata
 * @description Generates the root metadata for the application
 */
export const generateRootMetadata = async (): Promise<Metadata> => {
  const headersStore = await headers();
  const csrfToken = headersStore.get('x-csrf-token') ?? '';

  const isTestingEnv = process.env.NEXT_PUBLIC_ENVIRONMENT === 'testing';
  const title = isTestingEnv ? `[Testing] ${appConfig.title}` : appConfig.title;

  return {
    title,
    description: appConfig.description,
    metadataBase: new URL(appConfig.url),
    applicationName: appConfig.name,
    other: {
      'csrf-token': csrfToken,
    },
    openGraph: {
      url: appConfig.url,
      siteName: appConfig.name,
      title: appConfig.title,
      description: appConfig.description,
    },
    twitter: {
      card: 'summary_large_image',
      title: appConfig.title,
      description: appConfig.description,
    },
    icons: {
      icon: '/images/favicon/favicon.ico',
      apple: '/images/favicon/apple-touch-icon.png',
    },
  };
};

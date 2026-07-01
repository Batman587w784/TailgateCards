import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { resolveCardShareLink } from '~/activate/_lib/server/resolve-card';
import { withI18n } from '~/lib/i18n/with-i18n';

import { SharePassLauncher } from './_components/share-pass-launcher';

export const metadata: Metadata = {
  title: 'Share your Tailgate card',
  robots: { index: false, follow: false },
};

interface SharePageProps {
  params: Promise<{ code: string }>;
}

async function SharePage({ params }: SharePageProps) {
  const { code } = await params;

  const shareUrlPath = await resolveCardShareLink(code);
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;

  if (!shareUrlPath || !siteUrl) {
    notFound();
  }

  const shareUrl = new URL(shareUrlPath, siteUrl).toString();

  return (
    <main className="bg-background flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <SharePassLauncher shareUrl={shareUrl} />
    </main>
  );
}

export default withI18n(SharePage);

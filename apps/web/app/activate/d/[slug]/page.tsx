import type { Metadata } from 'next';

import { headers } from 'next/headers';
import { notFound } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { withI18n } from '~/lib/i18n/with-i18n';

import { ActivateCardFlow } from '../../_components/activate-card-flow';
import { detectPlatform } from '../../_lib/detect-platform';
import {
  type CardActivationData,
  loadDiscountsForOrganization,
} from '../../_lib/server/card-activation.loader';

const ogImage = {
  url: '/images/sales-link-og.png',
  width: 2000,
  height: 1000,
  alt: 'Support your local organization and earn local discounts with a Tailgate digital card',
};

export const metadata: Metadata = {
  title: 'Get a Tailgate Digital Card',
  description:
    'Buy a digital Tailgate discount card from your distributor and start saving at local businesses.',
  openGraph: {
    title: 'Get a Tailgate Digital Card',
    description:
      'Support your local organization and earn discounts at local businesses with a Tailgate digital card.',
    images: [ogImage],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Get a Tailgate Digital Card',
    description:
      'Support your local organization and earn discounts at local businesses with a Tailgate digital card.',
    images: [ogImage.url],
  },
};

interface PageProps {
  params: Promise<{
    slug: string;
  }>;
}

async function DistributorBuyPage({ params }: PageProps) {
  const { slug } = await params;

  const client = getSupabaseServerClient();

  const { data, error } = await client.rpc('get_distributor_buy_page', {
    p_slug: slug,
  });

  const row = data?.[0];

  if (error || !row) {
    notFound();
  }

  const priceCents = row.price_cents ?? 2500;

  const cardData: CardActivationData = {
    found: true,
    card: {
      id: null,
      display_code: null,
      status: 'pending',
      price_cents: priceCents,
      organization: {
        id: row.organization_id,
        name: row.organization_name ?? 'Tailgate',
        picture_url: row.organization_picture_url,
      },
      card_type: 'digital',
      distributor_id: row.distributor_id,
      distributor_slug: slug,
    },
  };

  const discounts = await loadDiscountsForOrganization(row.organization_id);

  const userAgent = (await headers()).get('user-agent');
  const platform = detectPlatform(userAgent);

  return (
    <ActivateCardFlow
      cardData={cardData}
      initialStep={1}
      discounts={discounts}
      platform={platform}
    />
  );
}

export default withI18n(DistributorBuyPage);

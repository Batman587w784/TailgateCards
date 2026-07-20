import { ImageResponse } from 'next/og';

import { OG_SIZE, ogCard } from '~/lib/og-card';
import { ogForOrgBuy } from '~/lib/server/og-data';

export const alt = 'Support your chapter with a Tailgate card';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = (await ogForOrgBuy(slug)) ?? {
    title: 'Tailgate',
    subtitle: 'Support your chapter',
  };

  return new ImageResponse(ogCard(data), { ...size });
}

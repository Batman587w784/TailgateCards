import { ImageResponse } from 'next/og';

import { OG_SIZE, ogCard } from '~/lib/og-card';
import { ogForCampus } from '~/lib/server/og-data';

export const alt = 'Live fundraising standings';
export const size = OG_SIZE;
export const contentType = 'image/png';

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const data = (await ogForCampus(slug)) ?? {
    title: 'Leaderboard',
    subtitle: 'Live fundraising standings',
  };

  return new ImageResponse(ogCard(data), { ...size });
}

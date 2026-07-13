import type { Metadata } from 'next';

import { notFound } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import type { NamingPreset } from '~/lib/naming';

import {
  PublicLeaderboard,
  type PublicRow,
} from './_components/public-leaderboard';

interface PageProps {
  params: Promise<{ slug: string }>;
}

interface PublicCampus {
  district_id: string;
  campus_name: string;
  naming_preset: NamingPreset;
}

async function resolveCampus(slug: string): Promise<PublicCampus | null> {
  const client = getSupabaseServerClient();
  const { data } = await client.rpc('get_public_campus', { p_share_slug: slug });

  return (data?.[0] as PublicCampus | undefined) ?? null;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const campus = await resolveCampus(slug);

  return {
    title: campus ? `${campus.campus_name} Leaderboard` : 'Leaderboard',
    description: 'Live fundraising standings.',
  };
}

async function PublicLeaderboardPage({ params }: PageProps) {
  const { slug } = await params;
  const campus = await resolveCampus(slug);

  if (!campus) {
    notFound();
  }

  const client = getSupabaseServerClient();

  const [summaryRes, chaptersRes, membersRes] = await Promise.all([
    client.rpc('get_campus_leaderboard_summary', {
      p_district_id: campus.district_id,
    }),
    client.rpc('get_campus_chapter_leaderboard', {
      p_district_id: campus.district_id,
    }),
    client.rpc('get_campus_member_leaderboard', {
      p_district_id: campus.district_id,
      p_limit: 100,
    }),
  ]);

  const summary = summaryRes.data as {
    total_raised_cents: number;
    total_cards_sold: number;
    chapter_count: number;
    goal_progress: number | null;
  } | null;

  const chapters: PublicRow[] = (chaptersRes.data ?? []).map((c) => ({
    rank: c.rank,
    label: c.chapter_name,
    cards_sold: c.cards_sold,
    dollars_raised_cents: c.dollars_raised_cents,
    goal_progress: c.goal_progress,
  }));

  const members: PublicRow[] = (membersRes.data ?? []).map((m) => ({
    rank: m.rank,
    label: m.display_name,
    cards_sold: m.cards_sold,
    dollars_raised_cents: m.dollars_raised_cents,
    goal_progress: m.goal_progress,
  }));

  return (
    <PublicLeaderboard
      campusName={campus.campus_name}
      namingPreset={campus.naming_preset}
      totalRaisedCents={summary?.total_raised_cents ?? 0}
      totalCardsSold={summary?.total_cards_sold ?? 0}
      chapterCount={summary?.chapter_count ?? 0}
      campusGoalProgress={summary?.goal_progress ?? null}
      chapters={chapters}
      members={members}
    />
  );
}

export default PublicLeaderboardPage;

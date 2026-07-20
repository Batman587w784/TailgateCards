import type { Metadata } from 'next';

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { chapterMonogram, monogramColor } from '~/lib/greek-monogram';
import { withI18n } from '~/lib/i18n/with-i18n';

interface PageProps {
  params: Promise<{ slug: string }>;
}

async function resolveCampusName(slug: string): Promise<string | null> {
  const client = getSupabaseServerClient();
  const { data } = await client.rpc('get_public_campus', {
    p_share_slug: slug,
  });
  return (data?.[0] as { campus_name: string } | undefined)?.campus_name ?? null;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const name = await resolveCampusName(slug);

  return {
    title: name ? `Support ${name}` : 'Pick your chapter',
    description: 'Choose a chapter and get your Tailgate discount card.',
  };
}

async function ChapterPickerPage({ params }: PageProps) {
  const { slug } = await params;
  const client = getSupabaseServerClient();

  const [{ data: campusData }, { data: chaptersData }] = await Promise.all([
    client.rpc('get_public_campus', { p_share_slug: slug }),
    client.rpc('get_district_chapter_picker', { p_share_slug: slug }),
  ]);

  const campus = campusData?.[0] as { campus_name: string } | undefined;

  if (!campus) {
    notFound();
  }

  // Only chapters with a buy-page slug are linkable (decision #9 — every card
  // must feed a house).
  const chapters = (chaptersData ?? []).filter(
    (c): c is typeof c & { slug: string } => Boolean(c.slug),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold">Pick your chapter</h1>
        <p className="text-muted-foreground text-sm">
          Choose which {campus.campus_name} chapter your card supports.
        </p>
      </div>

      {chapters.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No chapters are taking cards right now. Check back soon.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {chapters.map((chapter) => (
            <li key={chapter.org_account_id}>
              <Link
                href={`/activate/o/${chapter.slug}`}
                className="bg-sidebar hover:border-primary/40 flex items-center gap-3 rounded-lg border p-3 transition-colors"
              >
                {chapter.logo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={chapter.logo_url}
                    alt=""
                    className="h-10 w-10 shrink-0 rounded-full object-cover"
                  />
                ) : (
                  <div
                    style={{ backgroundColor: monogramColor(chapter.name) }}
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                    aria-hidden
                  >
                    {chapterMonogram(chapter.name)}
                  </div>
                )}
                <span className="min-w-0 flex-1 truncate font-medium">
                  {chapter.name}
                </span>
                <span className="text-muted-foreground text-sm">Select →</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default withI18n(ChapterPickerPage);

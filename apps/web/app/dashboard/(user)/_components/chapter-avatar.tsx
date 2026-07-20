import { chapterMonogram, monogramColor } from '~/lib/greek-monogram';

interface ChapterAvatarProps {
  name: string;
  logoUrl?: string | null;
  className?: string;
}

/**
 * Chapter row avatar (§5): the effective org logo, or a Greek-letter monogram
 * (ΠΚΑ) on a color block for chapters with no logo — falling back to initials
 * for non-Greek names.
 */
export function ChapterAvatar({
  name,
  logoUrl,
  className = 'h-8 w-8',
}: ChapterAvatarProps) {
  if (logoUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={logoUrl}
        alt={name}
        className={`${className} shrink-0 rounded-full object-cover`}
      />
    );
  }

  return (
    <div
      style={{ backgroundColor: monogramColor(name) }}
      className={`${className} flex shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white`}
      aria-hidden
    >
      {chapterMonogram(name)}
    </div>
  );
}

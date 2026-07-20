import { chapterMonogram, monogramColor } from './greek-monogram';

/**
 * M2.5 — reusable OG link-preview template (1200×630) for buy links + the public
 * leaderboard. Satori-safe (flex layouts, inline styles only). A circular logo
 * slot falls back to the Greek-letter monogram. Structured so a Canva background
 * can drop into `backgroundUrl` without a rewrite.
 */
export interface OgCardData {
  /** Headline entity name (chapter / district). */
  title: string;
  /** Secondary line — who they're supporting / context. */
  subtitle?: string | null;
  /** Effective logo URL; falls back to a Greek-letter monogram. */
  logoUrl?: string | null;
  /** Progress caption, e.g. "$3,250 of $5,000" or "180 of 500 cards". */
  progressLabel?: string | null;
  /** 0–100 progress bar fill; omit to hide the bar. */
  progressPct?: number | null;
  /** Countdown, e.g. "8 days left". */
  countdown?: string | null;
  /** Optional full-bleed background image (Canva drop-in). */
  backgroundUrl?: string | null;
}

export const OG_SIZE = { width: 1200, height: 630 };

export function ogCard(data: OgCardData) {
  const monogram = data.logoUrl ? null : chapterMonogram(data.title);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        padding: '64px',
        justifyContent: 'space-between',
        color: 'white',
        backgroundColor: '#0b1020',
        ...(data.backgroundUrl
          ? {
              backgroundImage: `url(${data.backgroundUrl})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
            }
          : {}),
      }}
    >
      {/* Header — logo + entity name. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '36px' }}>
        {data.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={data.logoUrl}
            width={148}
            height={148}
            style={{ borderRadius: '74px', objectFit: 'cover' }}
            alt=""
          />
        ) : (
          <div
            style={{
              display: 'flex',
              width: '148px',
              height: '148px',
              borderRadius: '74px',
              backgroundColor: monogramColor(data.title),
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '60px',
              fontWeight: 800,
            }}
          >
            {monogram}
          </div>
        )}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            maxWidth: '820px',
          }}
        >
          <div style={{ display: 'flex', fontSize: '64px', fontWeight: 800 }}>
            {data.title}
          </div>
          {data.subtitle ? (
            <div
              style={{ display: 'flex', fontSize: '32px', opacity: 0.82 }}
            >
              {data.subtitle}
            </div>
          ) : null}
        </div>
      </div>

      {/* Footer — progress + countdown + brand. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
        {data.progressLabel ? (
          <div style={{ display: 'flex', fontSize: '38px', fontWeight: 700 }}>
            {data.progressLabel}
          </div>
        ) : null}
        {typeof data.progressPct === 'number' ? (
          <div
            style={{
              display: 'flex',
              width: '100%',
              height: '26px',
              borderRadius: '13px',
              backgroundColor: 'rgba(255,255,255,0.16)',
            }}
          >
            <div
              style={{
                display: 'flex',
                width: `${Math.min(100, Math.max(0, data.progressPct))}%`,
                height: '100%',
                borderRadius: '13px',
                backgroundColor: '#3b82f6',
              }}
            />
          </div>
        ) : null}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '28px',
          }}
        >
          <div style={{ display: 'flex', fontWeight: 700 }}>Tailgate</div>
          {data.countdown ? (
            <div style={{ display: 'flex' }}>{data.countdown}</div>
          ) : (
            <div style={{ display: 'flex' }} />
          )}
        </div>
      </div>
    </div>
  );
}

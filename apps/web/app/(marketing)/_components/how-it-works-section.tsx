import { BarChart3, Store, TicketPercent } from 'lucide-react';

const features = [
  {
    icon: TicketPercent,
    title: 'Digital Discount Access',
    description:
      'Use your digital account at partner merchants to unlock exclusive discounts instantly.',
  },
  {
    icon: Store,
    title: 'Local Business Discounts',
    description:
      'Support your community while saving at restaurants, shops, and more.',
  },
  {
    icon: BarChart3,
    title: 'Track Your Impact',
    description:
      "See exactly how your purchases support your organization's goals.",
  },
];

const CLIP_PATH_ID = 'clipped-card-shape';
const CLIPPED_CARD_PATH =
  'M0.078,0.004 H0.842 C0.859,0.004 0.874,0.012 0.887,0.026 L0.967,0.115 C0.986,0.137 0.998,0.172 0.998,0.208 V0.881 C0.998,0.945 0.964,0.996 0.922,0.996 H0.078 C0.036,0.996 0.002,0.945 0.002,0.881 V0.119 C0.002,0.055 0.036,0.004 0.078,0.004 Z';

function ClippedCard({ children }: React.PropsWithChildren) {
  return (
    <div
      style={{
        filter:
          'drop-shadow(0 0 1px #E4E4E7) drop-shadow(0 1px 3px rgba(0,0,0,0.06))',
      }}
    >
      <div
        className="bg-gradient-to-tr from-[#E4F3F4] to-[#E3E9F1] px-8 py-[50px]"
        style={{ clipPath: `url(#${CLIP_PATH_ID})` }}
      >
        {children}
      </div>
    </div>
  );
}

export function HowItWorksSection() {
  return (
    <section className="bg-[#F4F4F5] px-4 py-16 md:py-24">
      {/* Shared clip-path definition */}
      <svg width="0" height="0" className="absolute">
        <defs>
          <clipPath id={CLIP_PATH_ID} clipPathUnits="objectBoundingBox">
            <path d={CLIPPED_CARD_PATH} />
          </clipPath>
        </defs>
      </svg>

      <div className="mx-auto max-w-7xl">
        {/* Section header */}
        <div className="mb-12 text-center">
          <h2 className="mb-3 text-3xl font-bold md:text-4xl">
            How <span className="text-brand">Tailgate</span> Works
          </h2>
          <p className="text-muted-foreground mx-auto max-w-xl">
            A seamless platform that connects members, merchants, and
            organizations
          </p>
        </div>

        {/* Feature cards */}
        <div className="grid gap-6 md:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <ClippedCard key={feature.title}>
                <div className="bg-brand mb-4 inline-flex items-center justify-center rounded-lg p-[5px] md:h-12 md:w-12 md:p-0">
                  <Icon className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-brand mb-2 text-lg font-semibold">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground text-sm">
                  {feature.description}
                </p>
              </ClippedCard>
            );
          })}
        </div>
      </div>
    </section>
  );
}

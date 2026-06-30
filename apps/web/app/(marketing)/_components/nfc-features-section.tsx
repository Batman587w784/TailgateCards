import { HandHelping, Nfc, Route, Store } from 'lucide-react';

const features = [
  {
    icon: Nfc,
    label: 'Instant NFC Activation',
    description:
      'Start using your card in seconds and unlock your benefits right away.',
  },
  {
    icon: Store,
    label: 'Exclusive Local Discounts',
    description:
      'Enjoy savings while supporting your community and partnering businesses.',
  },
  {
    icon: Route,
    label: 'Real-Time Impact Tracking',
    description:
      "See how every redemption contributes to your organization's fundraising goals.",
  },
  {
    icon: HandHelping,
    label: 'Business Growth for Merchants',
    description:
      'Local businesses gain new customers, targeted visibility, and insightful analytics.',
  },
];

export function NFCFeaturesSection() {
  return (
    <section className="bg-white px-4 py-16 shadow-md md:py-24">
      <div className="mx-auto max-w-7xl text-center">
        {/* Headline */}
        <h2 className="mb-4 text-3xl font-bold md:text-4xl">
          Connect. Save. Grow — All Through NFC.
        </h2>

        {/* Supporting paragraph */}
        <p className="text-muted-foreground mx-auto mb-12 max-w-2xl">
          Tailgate brings organizations, supporters, and local businesses
          together in one NFC-powered ecosystem. Save with exclusive deals,
          support fundraising goals, and help local merchants grow — all with a
          simple tap.
        </p>

        {/* Feature icons grid */}
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.label}
                className="flex flex-col items-center text-center"
              >
                <div className="bg-brand mb-3 flex h-14 w-14 items-center justify-center rounded-2xl">
                  <Icon className="h-7 w-7 text-white" />
                </div>
                <span className="text-sm font-semibold">{feature.label}</span>
                <p className="text-muted-foreground mt-1 text-xs">
                  {feature.description}
                </p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

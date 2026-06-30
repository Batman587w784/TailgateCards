import Link from 'next/link';

import { ArrowUpRight, DollarSign, Users } from 'lucide-react';

import { Button } from '@kit/ui/button';

function StatCard({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ElementType;
  value: string;
  label: string;
}) {
  return (
    <div
      className="flex items-center gap-3 rounded-xl border bg-white px-6 py-4"
      style={{ boxShadow: '0 100px 50px rgba(40, 40, 40, 0.20)' }}
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#CCCDDD]">
        <Icon className="text-brand h-5 w-5" />
      </div>
      <div>
        <div className="text-left text-xl font-bold">{value}</div>
        <div className="text-muted-foreground text-sm">{label}</div>
      </div>
    </div>
  );
}

export function TailgateHero() {
  return (
    <section
      className="px-4 pt-6 pb-16 md:py-24"
      style={{
        backgroundColor: '#F4F4F5',
        backgroundImage: `
          radial-gradient(900px circle at 50% 18%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 60%),
          linear-gradient(90deg, #F4F4F5 0%, rgba(35,136,255,0.08) 20%, transparent 50%, rgba(35,136,255,0.08) 80%, #F4F4F5 100%),
          linear-gradient(180deg, rgba(35,136,255,0.15) 0%, #ffffff 50%, transparent 100%)
        `,
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="mx-auto max-w-4xl text-center">
        {/* NFC Powered Pill */}
        <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border bg-white px-3 py-1 text-sm font-medium shadow-sm">
          <span className="text-brand font-semibold">
            ⚡️ NFC Powered Fundraising
          </span>
        </div>

        {/* Headline */}
        <h1 className="mb-4 text-3xl leading-snug font-bold tracking-tight sm:text-4xl md:text-5xl lg:text-6xl">
          Raise Funds With Zero Upfront Cost. Risk-Free,{' '}
          <span className="bg-brand/10 text-brand inline-block rounded-md px-2 py-1">
            NFC-Powered.
          </span>
        </h1>

        {/* Subtitle */}
        <p className="text-muted-foreground mx-auto mb-8 text-lg">
          Launch your fundraising programTurn your organization’s supporters
          into real results. No setup fees. No risk. We design, print, and
          launch your fundraising program — you only pay once cards sell.
        </p>

        {/* CTA Buttons */}
        <div className="mb-12 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            asChild
            size="lg"
            className="bg-brand hover:bg-brand/90 rounded-lg px-8 shadow-lg"
          >
            <Link href="/activate">
              Activate My Card
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>

          <Button
            asChild
            size="lg"
            variant="outline"
            className="text-brand border-border hover:bg-brand/5 rounded-lg bg-white px-8 shadow-lg"
          >
            <Link href="/contact">
              Start My Fundraiser
              <ArrowUpRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>

        {/* Stats */}
        <div className="flex w-full flex-col items-stretch gap-4 pb-16 sm:w-auto sm:flex-row sm:items-center sm:justify-center">
          <StatCard icon={Users} value="10+" label="Organizations" />
          <StatCard
            icon={DollarSign}
            value="$50k+"
            label="Raised for Organizations"
          />
        </div>
      </div>
    </section>
  );
}

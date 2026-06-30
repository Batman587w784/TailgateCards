import Link from 'next/link';

import { ArrowUpRight } from 'lucide-react';

import { Button } from '@kit/ui/button';

export function CTASection() {
  return (
    <section className="bg-[#F4F4F5] px-4 py-16">
      <div className="mx-auto max-w-7xl">
        <div className="bg-brand-700 rounded-3xl p-16 text-center md:px-16 md:py-16">
          <h2 className="mb-4 text-2xl font-bold text-white md:text-3xl">
            Ready to activate your NFC card?
          </h2>
          <p className="mb-8 text-lg text-white/80">
            Start tapping, saving, and supporting your team.
          </p>
          <Button
            asChild
            size="lg"
            className="bg-brand hover:bg-brand/90 font-semibold text-white"
          >
            <Link href="/activate">
              Activate My Card
              <ArrowUpRight className="ml-2 h-5 w-5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

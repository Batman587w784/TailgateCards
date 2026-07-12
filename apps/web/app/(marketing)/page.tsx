import Link from 'next/link';

import { Button } from '@kit/ui/button';

import { TailgateLogo } from '~/components/tailgate-logo';
import pathsConfig from '~/config/paths.config';
import { withI18n } from '~/lib/i18n/with-i18n';

/**
 * T0 — Minimal entry screen.
 *
 * Cold open (web + wrapped app) shows only the logo, "Get Started", and
 * "Login". The heavy marketing sections (hero, how-it-works, NFC features,
 * partners, testimonials, CTA) are intentionally no longer rendered here — their
 * component files remain in `_components/` for reuse but are retired from the
 * home route. Legal pages stay reachable via the small footer for app-store
 * compliance.
 */
function Home() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-10 px-4 py-16">
      <TailgateLogo className="h-24 w-auto" />

      <div className="flex w-full max-w-xs flex-col gap-3">
        <Button
          asChild
          size="lg"
          className="bg-brand hover:bg-brand/90 w-full shadow-lg"
        >
          {/* REVIEW: lands on the T6 self-signup entry (app/join/start), which
              is built in a later ticket. Until T6 ships this route 404s. */}
          <Link href="/join/start">Get Started</Link>
        </Button>

        <Button asChild size="lg" variant="outline" className="w-full">
          <Link href={pathsConfig.auth.signIn}>Login</Link>
        </Button>
      </div>

      <nav className="text-muted-foreground flex items-center gap-4 text-xs">
        <Link href="/privacy-policy" className="hover:text-foreground transition-colors">
          Privacy Policy
        </Link>
        <Link href="/terms-of-service" className="hover:text-foreground transition-colors">
          Terms of Service
        </Link>
        <Link href="/cookie-policy" className="hover:text-foreground transition-colors">
          Cookie Policy
        </Link>
      </nav>
    </div>
  );
}

export default withI18n(Home);

import Link from 'next/link';

import { TailgateLogo } from '~/components/tailgate-logo';

export function SiteFooter() {
  return (
    <footer className="border-t bg-[#F4F4F5] sm:bg-white">
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Mobile-only logo */}
        <div className="mb-6 flex justify-center sm:hidden">
          <TailgateLogo className="h-[100px]" />
        </div>

        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-muted-foreground text-sm">
            © {new Date().getFullYear()} Tailgate.com | Powered by Vizio
            Ventures
          </p>
          <nav className="flex items-center gap-6">
            <Link
              href="/privacy-policy"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms-of-service"
              className="text-muted-foreground hover:text-foreground text-sm transition-colors"
            >
              Terms of Service
            </Link>
          </nav>
        </div>
      </div>
    </footer>
  );
}

import Link from 'next/link';

import { TailgateLogo } from '~/components/tailgate-logo';

export default function ValidateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <header className="flex justify-center py-6">
        <Link href="/dashboard">
          <TailgateLogo />
        </Link>
      </header>
      <main className="flex flex-1 flex-col items-center px-4 pb-12">
        {children}
      </main>
    </div>
  );
}

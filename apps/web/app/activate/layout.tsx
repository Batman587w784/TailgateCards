import Link from 'next/link';

export default function ActivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-linear-to-b from-slate-50 to-slate-100">
      <main className="flex flex-1 flex-col items-center px-4 py-6">
        <div className="w-full max-w-xl">
          {/* Subtle escape hatch in place of the old mobile back button — the
              purchase flow stays the priority. */}
          <div className="mb-2 flex justify-end">
            <Link
              href="/auth/sign-in"
              className="text-muted-foreground hover:text-foreground text-xs underline-offset-2 hover:underline"
            >
              Already a supporter? Log in
            </Link>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

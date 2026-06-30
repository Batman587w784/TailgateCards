import { MobileHeader } from '~/components/mobile-header';

export default function ActivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col bg-linear-to-b from-slate-50 to-slate-100">
      {/* Mobile: Back button header */}
      <MobileHeader left="back" backHref="/" />

      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8">
        <div className="w-full max-w-xl rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}

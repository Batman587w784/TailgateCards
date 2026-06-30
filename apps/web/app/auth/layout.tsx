import { TailgateLogo } from '~/components/tailgate-logo';

function AuthLayout({ children }: React.PropsWithChildren) {
  return (
    <div
      className="flex h-screen flex-col items-center justify-center gap-y-10 lg:gap-y-8"
      style={{
        backgroundColor: '#fff',
        backgroundImage: `
          radial-gradient(900px circle at 50% 18%, rgba(255,255,255,0.95) 0%, rgba(255,255,255,0) 60%),
          linear-gradient(90deg, rgba(35,136,255,0.08) 0%, #ffffff 50%, rgba(35,136,255,0.08) 100%),
          linear-gradient(180deg, rgba(35,136,255,0.15) 0%, #ffffff 100%)
        `,
        backgroundRepeat: 'no-repeat',
      }}
    >
      <div className="bg-background flex w-full max-w-[476px] flex-col gap-y-6 rounded-lg px-6 py-6 shadow-lg md:px-8 md:py-8">
        <div className="flex justify-center">
          <TailgateLogo />
        </div>
        {children}
      </div>
    </div>
  );
}

export default AuthLayout;

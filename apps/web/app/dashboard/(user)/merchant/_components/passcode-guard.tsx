import { isPasscodeVerified } from '../_lib/server/passcode-server-actions';
import { PasscodeVerificationForm } from './passcode-verification-form';

interface PasscodeGuardProps {
  children: React.ReactNode;
  description?: string;
}

export async function PasscodeGuard({
  children,
  description,
}: PasscodeGuardProps) {
  const verified = await isPasscodeVerified();

  if (verified) {
    return <>{children}</>;
  }

  return (
    <div className="relative flex h-full flex-1 flex-col">
      <div className="pointer-events-none blur-sm select-none">{children}</div>
      <div className="fixed top-14 right-0 bottom-0 left-0 z-40 flex items-center justify-center md:top-0 md:left-64">
        <PasscodeVerificationForm description={description} />
      </div>
    </div>
  );
}

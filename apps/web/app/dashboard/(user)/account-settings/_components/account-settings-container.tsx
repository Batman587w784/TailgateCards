'use client';

import { Card, CardContent } from '@kit/ui/card';
import { Separator } from '@kit/ui/separator';

import { BasicInfoForm } from './basic-info-form';
import { ChangePasswordForm } from './change-password-form';
import { EmailForm } from './email-form';
import { PhoneForm } from './phone-form';

interface AccountSettingsContainerProps {
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  enablePasswordUpdate: boolean;
}

export function AccountSettingsContainer({
  firstName,
  lastName,
  email,
  phone,
  enablePasswordUpdate,
}: AccountSettingsContainerProps) {
  return (
    <div className="flex w-full flex-col space-y-4 pb-32">
      <Card>
        <CardContent className="space-y-6 py-4">
          <BasicInfoForm firstName={firstName} lastName={lastName} />

          <Separator />

          <EmailForm email={email} />

          <Separator />

          <PhoneForm phone={phone} />

          {enablePasswordUpdate && (
            <>
              <Separator />
              <ChangePasswordForm />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

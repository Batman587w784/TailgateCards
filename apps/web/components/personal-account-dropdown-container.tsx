'use client';

import { PersonalAccountDropdown } from '@kit/accounts/personal-account-dropdown';
import { useSignOut } from '@kit/supabase/hooks/use-sign-out';
import { useUser } from '@kit/supabase/hooks/use-user';
import { JWTUserData } from '@kit/supabase/types';

import pathsConfig from '~/config/paths.config';

const paths = {
  home: pathsConfig.app.home,
};

export function ProfileAccountDropdownContainer(props: {
  user?: JWTUserData | null;
  showProfileName?: boolean;

  account?: {
    id: string | null;
    name: string | null;
    picture_url: string | null;
  };
}) {
  const signOut = useSignOut();
  const user = useUser(props.user);
  const userData = user.data;

  if (!userData) {
    return null;
  }

  return (
    <PersonalAccountDropdown
      className={'w-full'}
      paths={paths}
      user={userData}
      account={props.account}
      signOutRequested={() => signOut.mutateAsync()}
      showProfileName={props.showProfileName}
    />
  );
}

'use client';

import { useEffect, useMemo } from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Spinner } from '@kit/ui/spinner';

import pathsConfig from '~/config/paths.config';

function getHashAuthInfo() {
  if (typeof window === 'undefined') return null;

  const hash = window.location.hash;
  if (!hash) return null;

  const hashParams = new URLSearchParams(hash.substring(1));
  const type = hashParams.get('type');
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');

  if (
    !accessToken ||
    (type !== 'invite' && type !== 'recovery' && type !== 'magiclink')
  ) {
    return null;
  }

  return { type, accessToken, refreshToken };
}

/**
 * Handles automatic redirect when user arrives with auth tokens in URL hash.
 * This handles invite and password recovery flows that land on the sign-in page
 * with hash tokens (e.g., #access_token=...&type=invite).
 */
export function AuthRedirectHandler() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useSupabase();

  const hashAuthInfo = useMemo(() => getHashAuthInfo(), []);

  useEffect(() => {
    if (!hashAuthInfo) return;

    const { type, accessToken, refreshToken } = hashAuthInfo;

    const next = searchParams.get('next');

    const redirectWithSession = (event: string) => {
      if (
        type === 'invite' ||
        type === 'recovery' ||
        event === 'PASSWORD_RECOVERY'
      ) {
        const destination = next ?? pathsConfig.auth.passwordUpdate;
        router.replace(destination);
        return;
      }

      const destination = next ?? pathsConfig.app.home;
      router.replace(destination);
    };

    if (refreshToken) {
      void supabase.auth
        .setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        })
        .then(({ data, error }) => {
          if (!error && data.session) {
            redirectWithSession('SIGNED_IN');
          }
        });
    }

    // Listen for auth state change when Supabase processes the hash tokens
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session) return;

        redirectWithSession(event);
      },
    );

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [supabase, router, searchParams, hashAuthInfo]);

  if (hashAuthInfo) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-8">
        <Spinner className="h-8 w-8" />
        <p className="text-muted-foreground text-sm">
          Setting up your account...
        </p>
      </div>
    );
  }

  return null;
}

'use client';

import { useState } from 'react';

import { Button } from '@kit/ui/button';

interface SharePassLauncherProps {
  shareUrl: string;
}

type ShareState = 'idle' | 'shared' | 'copied' | 'error';

export function SharePassLauncher({ shareUrl }: SharePassLauncherProps) {
  const [state, setState] = useState<ShareState>('idle');

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: 'Get a Tailgate discount card',
          text: 'Support the team and save at local spots — grab your own Tailgate card:',
          url: shareUrl,
        });
        setState('shared');
        return;
      } catch {
        // User cancelled or the share sheet failed — fall back to copying.
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setState('copied');
    } catch {
      setState('error');
    }
  };

  return (
    <div className="flex w-full max-w-sm flex-col items-center gap-4">
      <h1 className="text-2xl font-bold">Share with friends</h1>

      <p className="text-muted-foreground">
        Send your friends the link to grab their own card. Every card sold
        supports the team.
      </p>

      <Button
        size="lg"
        className="w-full"
        onClick={handleShare}
        data-test="share-pass-button"
      >
        Share
      </Button>

      {state === 'shared' ? (
        <p className="text-sm text-green-600">Thanks for sharing! 🎉</p>
      ) : null}

      {state === 'copied' ? (
        <p className="text-sm text-green-600">
          Link copied — paste it to anyone!
        </p>
      ) : null}

      {state === 'error' ? (
        <p className="text-muted-foreground text-sm break-all">
          Copy this link: {shareUrl}
        </p>
      ) : null}
    </div>
  );
}

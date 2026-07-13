'use client';

import { useState } from 'react';

import { Check, Share2 } from 'lucide-react';

import { Button } from '@kit/ui/button';

/**
 * Copy-link + native-share for the public leaderboard. No PII, no tracking —
 * just shares the current URL.
 */
export function ShareButton({ title }: { title: string }) {
  const [copied, setCopied] = useState(false);

  const onShare = async () => {
    const url = window.location.href;

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // user cancelled or unsupported — fall through to copy
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — nothing else to do
    }
  };

  return (
    <Button variant="outline" size="sm" onClick={onShare} data-test="share-leaderboard">
      {copied ? (
        <Check className="mr-2 h-4 w-4" />
      ) : (
        <Share2 className="mr-2 h-4 w-4" />
      )}
      {copied ? 'Link copied' : 'Share'}
    </Button>
  );
}

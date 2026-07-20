'use client';

import { useState } from 'react';

import { Check, Copy, MessageSquare, Share2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

interface ShareButtonProps {
  /** Dynamic share copy (one short line, no URL). */
  text: string;
  /** The link to share (personal / chapter buy link). */
  url: string;
  label?: string;
}

/**
 * M2.5-e share affordance. Primary = the native share sheet (navigator.share),
 * which on mobile surfaces GroupMe / iMessage / Instagram / Snapchat / etc. in
 * one call. Fallbacks (desktop / no navigator.share): SMS deep link + copy.
 * One short line + link so it survives SMS previews.
 */
export function ShareButton({ text, url, label = 'Share' }: ShareButtonProps) {
  const [copied, setCopied] = useState(false);
  const message = `${text} ${url}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      toast.success('Copied — paste it anywhere');
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Could not copy — long-press the link to copy it');
    }
  };

  const onShare = async () => {
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({ text: message });
      } catch {
        // User cancelled the sheet — nothing to do.
      }
      return;
    }
    // No native share (desktop) → copy.
    await copy();
  };

  return (
    <div className="flex flex-col gap-2">
      <Button
        size="lg"
        className="bg-brand text-brand-foreground hover:bg-brand/90 w-full"
        onClick={onShare}
        data-test="share-button"
      >
        <Share2 className="mr-2 h-5 w-5" />
        {label}
      </Button>
      <div className="flex gap-2">
        <Button asChild variant="outline" className="flex-1">
          <a href={`sms:?&body=${encodeURIComponent(message)}`}>
            <MessageSquare className="mr-2 h-4 w-4" />
            Text
          </a>
        </Button>
        <Button variant="outline" className="flex-1" onClick={copy}>
          {copied ? (
            <Check className="mr-2 h-4 w-4" />
          ) : (
            <Copy className="mr-2 h-4 w-4" />
          )}
          Copy link
        </Button>
      </div>
    </div>
  );
}

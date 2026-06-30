'use client';

import { useState } from 'react';

import { Check, Copy } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { cn } from '@kit/ui/utils';

interface OrgShareLinkCardProps {
  shareSlug: string | null;
  className?: string;
}

export function OrgShareLinkCard({
  shareSlug,
  className,
}: OrgShareLinkCardProps) {
  const [copied, setCopied] = useState(false);

  if (!shareSlug) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">
            Organization Sales Link
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-xs">
            Your sales link is being prepared. Please refresh the page in a
            moment.
          </p>
        </CardContent>
      </Card>
    );
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const shareUrl = `${baseUrl}/activate/o/${shareSlug}`;
  const displayUrl = shareUrl.replace(/^https?:\/\//, '');

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard may be unavailable; fall back to share dialog below.
    }
  };

  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && 'share' in navigator) {
      try {
        await navigator.share({
          title: 'Buy a Tailgate digital card',
          text: 'Get your digital discount card here:',
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or share failed — fall through to copy.
      }
    }
    handleCopy();
  };

  return (
    <Card className={cn('gap-3 md:gap-5', className)}>
      <CardHeader className="pb-4">
        <CardTitle className="text-sm font-semibold">
          Organization Sales Link
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <button
          type="button"
          onClick={handleCopy}
          className="bg-background hover:bg-muted flex w-full items-center gap-2 rounded-md border px-3 py-2 text-left text-xs transition"
          data-test="org-share-copy"
        >
          <span className="flex-1 truncate" data-test="org-share-link">
            {displayUrl}
          </span>
          {copied ? (
            <Check className="text-primary h-3.5 w-3.5 shrink-0" />
          ) : (
            <Copy className="text-primary h-3.5 w-3.5 shrink-0" />
          )}
        </button>
        <Button
          className="bg-brand text-brand-foreground hover:bg-brand-400 w-full"
          onClick={handleShare}
          data-test="org-share-button"
        >
          Share Sales Link
        </Button>
        <p className="text-muted-foreground text-xs">
          Share this link to sell digital cards directly for your organization.
        </p>
      </CardContent>
    </Card>
  );
}

'use client';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

interface ShareOrgSalesLinkButtonProps {
  shareSlug: string | null;
  className?: string;
}

export function ShareOrgSalesLinkButton({
  shareSlug,
  className,
}: ShareOrgSalesLinkButtonProps) {
  if (!shareSlug) {
    return null;
  }

  const handleShare = async () => {
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
    const shareUrl = `${baseUrl}/activate/o/${shareSlug}`;

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
  };

  return (
    <Button
      type="button"
      onClick={handleShare}
      className={cn(
        'bg-brand text-brand-foreground hover:bg-brand-400',
        className,
      )}
      data-test="org-sales-share-button"
    >
      Share Sales Link
    </Button>
  );
}

'use client';

import { useRef, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { ImageIcon, Loader2, Upload } from 'lucide-react';

import { useSupabase } from '@kit/supabase/hooks/use-supabase';
import { Button } from '@kit/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@kit/ui/card';
import { toast } from '@kit/ui/sonner';

import {
  uploadDistrictLogoSelf,
  uploadOrganizationLogo,
} from '../_lib/logo-upload';

interface LogoSettingsCardProps {
  kind: 'organization' | 'district';
  entityId: string;
  currentLogoUrl: string | null;
}

const LABELS = {
  organization: {
    title: 'Organization Logo',
    description:
      'Shown on your purchase page. Square images work best (PNG, JPG, GIF, or WebP, up to 5MB).',
  },
  district: {
    title: 'District Logo',
    description:
      'Shown on your campus/district purchase pages and, when standardize-logos is on, on every chapter. PNG, JPG, GIF, or WebP, up to 5MB.',
  },
} as const;

export function LogoSettingsCard({
  kind,
  entityId,
  currentLogoUrl,
}: LogoSettingsCardProps) {
  const supabase = useSupabase();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(currentLogoUrl);
  const [isPending, startTransition] = useTransition();

  const copy = LABELS[kind];

  const onFile = (file: File | undefined) => {
    if (!file) return;

    startTransition(async () => {
      try {
        const url =
          kind === 'district'
            ? await uploadDistrictLogoSelf(supabase, file, entityId)
            : await uploadOrganizationLogo(supabase, file, entityId);

        setPreview(url);
        toast.success(`${copy.title} updated`);
        router.refresh();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Could not upload the logo',
        );
      } finally {
        if (inputRef.current) inputRef.current.value = '';
      }
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{copy.title}</CardTitle>
        <CardDescription>{copy.description}</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-5">
          <div className="bg-muted flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border">
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={preview}
                alt={copy.title}
                className="h-full w-full object-cover"
              />
            ) : (
              <ImageIcon className="text-muted-foreground h-7 w-7" />
            )}
          </div>

          <div className="flex flex-col gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/png,image/jpeg,image/gif,image/webp"
              className="hidden"
              data-test={`logo-input-${kind}`}
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <Button
              type="button"
              variant="outline"
              disabled={isPending}
              onClick={() => inputRef.current?.click()}
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {preview ? 'Replace logo' : 'Upload logo'}
            </Button>
            <p className="text-muted-foreground text-xs">
              Updates immediately once uploaded.
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

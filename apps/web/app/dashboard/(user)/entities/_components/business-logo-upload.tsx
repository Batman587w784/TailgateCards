'use client';

import { useRef, useState } from 'react';

import { Upload } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { toast } from '@kit/ui/sonner';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

interface BusinessLogoUploadProps {
  onFileSelect: (file: File | null) => void;
  initialPreview?: string | null;
}

export function BusinessLogoUpload({
  onFileSelect,
  initialPreview,
}: BusinessLogoUploadProps) {
  const [preview, setPreview] = useState<string | null>(initialPreview ?? null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];

    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        toast.error('File size must be less than 5MB');
        return;
      }

      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error('Only JPEG, PNG, GIF, and WebP images are allowed');
        return;
      }

      const reader = new FileReader();

      reader.onloadend = () => {
        setPreview(reader.result as string);
      };

      reader.readAsDataURL(file);
      onFileSelect(file);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium">Business Logo</span>
      <div className="bg-muted flex items-center gap-4 rounded-lg p-4">
        <div className="bg-background h-14 w-14 overflow-hidden rounded-xl">
          {preview ? (
            <img
              src={preview}
              alt="Logo preview"
              className="h-full w-full object-cover"
              data-test="logo-preview-image"
            />
          ) : (
            <div className="text-muted-foreground flex h-full w-full items-center justify-center">
              <Upload className="h-6 w-6" />
            </div>
          )}
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => inputRef.current?.click()}
          data-test="upload-logo-button"
        >
          <Upload className="mr-2 h-4 w-4" />
          Upload
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/gif,image/webp"
          onChange={handleFileChange}
          className="hidden"
          data-test="logo-file-input"
        />
      </div>
    </div>
  );
}

'use client';

import { useState } from 'react';

import { Camera } from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Trans } from '@kit/ui/trans';

import { useQrScanner } from './use-qr-scanner';

interface QrScannerModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onScan: (code: string) => void;
}

export function QrScannerModal({
  open,
  onOpenChange,
  onScan,
}: QrScannerModalProps) {
  const [retryCount, setRetryCount] = useState(0);

  const { videoRef, status } = useQrScanner(
    open,
    (raw) => {
      const code = extractCardCode(raw);
      if (code) {
        onOpenChange(false);
        onScan(code);
      }
    },
    // Force re-init on retry
  );

  // Re-trigger hook when retrying by closing and reopening
  const handleRetry = () => {
    setRetryCount((c) => c + 1);
    // Force close and reopen to reinitialize scanner
    onOpenChange(false);
    setTimeout(() => onOpenChange(true), 100);
  };

  const isLoading = status === 'loading';
  const hasError = status === 'error';

  const handleClose = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose} key={retryCount}>
      <DialogContent className="max-w-md overflow-hidden p-0">
        <DialogHeader className="p-4 pb-0">
          <DialogTitle className="text-center">
            <Trans i18nKey="merchant:scan.scanQr" defaults="Scan QR Code" />
          </DialogTitle>
        </DialogHeader>

        <div className="relative aspect-square bg-black">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-2 text-white">
                <Camera className="h-8 w-8 animate-pulse" />
                <span>
                  <Trans
                    i18nKey="merchant:scan.startingCamera"
                    defaults="Starting camera..."
                  />
                </span>
              </div>
            </div>
          )}

          {hasError && (
            <div className="absolute inset-0 flex items-center justify-center p-4">
              <div className="flex flex-col items-center gap-4 text-center text-white">
                <p>
                  <Trans
                    i18nKey="merchant:scan.cameraError"
                    defaults="Could not access camera. Please grant permission and try again."
                  />
                </p>
                <Button variant="secondary" onClick={handleRetry}>
                  <Trans i18nKey="common:retry" defaults="Retry" />
                </Button>
              </div>
            </div>
          )}

          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            playsInline
            muted
          />

          {status === 'scanning' && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-48 w-48 rounded-2xl border-2 border-white/50">
                <div className="absolute -top-1 -left-1 h-8 w-8 rounded-tl-lg border-t-4 border-l-4 border-white" />
                <div className="absolute -top-1 -right-1 h-8 w-8 rounded-tr-lg border-t-4 border-r-4 border-white" />
                <div className="absolute -bottom-1 -left-1 h-8 w-8 rounded-bl-lg border-b-4 border-l-4 border-white" />
                <div className="absolute -right-1 -bottom-1 h-8 w-8 rounded-br-lg border-r-4 border-b-4 border-white" />
              </div>
            </div>
          )}
        </div>

        <div className="p-4 pt-2">
          <p className="text-muted-foreground mb-4 text-center text-sm">
            <Trans
              i18nKey="merchant:scan.positionQr"
              defaults="Position the QR code within the frame"
            />
          </p>

          <Button variant="outline" className="w-full" onClick={handleClose}>
            <Trans i18nKey="common:cancel" defaults="Cancel" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function extractCardCode(scannedValue: string): string | null {
  if (!scannedValue) return null;

  try {
    const url = new URL(scannedValue);
    const code = url.searchParams.get('code');
    if (code) return code;
  } catch {
    // Not a URL
  }

  return scannedValue.trim() || null;
}

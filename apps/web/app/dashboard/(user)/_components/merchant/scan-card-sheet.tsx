'use client';

import { useEffect, useRef, useState, useTransition } from 'react';

import { QrCode, Wifi } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@kit/ui/sheet';
import { toast } from '@kit/ui/sonner';
import { Trans } from '@kit/ui/trans';

import { validateCard } from '~/validate/_lib/server/card-validation.actions';
import { validateCardErrorMessage } from '~/validate/_lib/validation-errors';

import { QrScannerModal } from './qr-scanner-modal';
import { ScanResultDialog } from './scan-result-dialog';

interface CardData {
  cardId: string;
  cardCode: string;
  discount: { id: string; title: string } | null;
  status: 'active' | 'expired';
  validityDate: string | null;
}

interface ScanCardSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  merchantId: string;
}

export function ScanCardSheet({
  open,
  onOpenChange,
  merchantId,
}: ScanCardSheetProps) {
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [isNfcScanning, setIsNfcScanning] = useState(false);
  const [isResultDialogOpen, setIsResultDialogOpen] = useState(false);
  const [scannedCardData, setScannedCardData] = useState<CardData | null>(null);
  const [isPending, startTransition] = useTransition();
  const nfcScanAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      nfcScanAbortRef.current?.abort();
    };
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      nfcScanAbortRef.current?.abort();
      nfcScanAbortRef.current = null;
      setIsNfcScanning(false);
    }

    onOpenChange(nextOpen);
  };

  const handleScanComplete = (code: string) => {
    setIsQrScannerOpen(false);
    onOpenChange(false);

    startTransition(async () => {
      const result = await validateCard({ displayCode: code, merchantId });

      if (!result.success) {
        toast.error(validateCardErrorMessage(result.code), {
          description: `Reference: ${result.reference}`,
        });
        return;
      }

      setScannedCardData(result.data);
      setIsResultDialogOpen(true);
    });
  };

  const handleQrScan = (code: string) => {
    handleScanComplete(code);
  };

  const handleNfcScan = async () => {
    // Check if Web NFC is supported
    if (!('NDEFReader' in window)) {
      toast.error('NFC is not supported on this device or browser', {
        description: 'Try using Chrome on an Android device with NFC enabled.',
      });
      return;
    }

    nfcScanAbortRef.current?.abort();

    const abortController = new AbortController();
    nfcScanAbortRef.current = abortController;

    const stopNfcScan = () => {
      abortController.abort();

      if (nfcScanAbortRef.current === abortController) {
        nfcScanAbortRef.current = null;
      }

      setIsNfcScanning(false);
    };

    setIsNfcScanning(true);

    try {
      // @ts-expect-error - NDEFReader is not in TypeScript types yet
      const ndef = new NDEFReader();
      await ndef.scan({ signal: abortController.signal });

      toast.info('Hold your device near the card to scan', {
        duration: 5000,
      });

      ndef.addEventListener(
        'reading',
        ({
          message,
        }: {
          message: {
            records: Array<{ recordType: string; data: ArrayBuffer }>;
          };
        }) => {
          // QR and NFC payloads share the same card identifier format.
          for (const record of message.records) {
            if (record.recordType === 'text' || record.recordType === 'url') {
              const textDecoder = new TextDecoder();
              const code = textDecoder.decode(record.data);

              stopNfcScan();
              handleScanComplete(code);
              return;
            }
          }

          toast.error('Could not read card data');
          stopNfcScan();
        },
      );

      ndef.addEventListener('readingerror', () => {
        toast.error('Error reading NFC card');
        stopNfcScan();
      });
    } catch (error) {
      console.error('NFC error:', error);

      if (error instanceof Error && error.name === 'AbortError') {
        return;
      }

      if (error instanceof Error && error.name === 'NotAllowedError') {
        toast.error('NFC permission denied', {
          description: 'Please allow NFC access in your browser settings.',
        });
      } else {
        toast.error('Failed to start NFC scan');
      }

      stopNfcScan();
    }
  };

  return (
    <>
      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="bottom" className="rounded-t-3xl">
          <SheetHeader className="pb-6">
            <SheetTitle className="text-center text-xl">
              <Trans i18nKey="merchant:scan.title" defaults="Scan a Card" />
            </SheetTitle>
          </SheetHeader>

          <div className="flex flex-col gap-3 pb-4">
            <Button
              size="lg"
              className="bg-brand-400 h-14 gap-3 text-base"
              onClick={() => setIsQrScannerOpen(true)}
            >
              <QrCode className="h-5 w-5" />
              <Trans i18nKey="merchant:scan.withQr" defaults="with QR" />
            </Button>

            <Button
              size="lg"
              className="bg-brand-400 h-14 gap-3 text-base"
              onClick={handleNfcScan}
              disabled={isNfcScanning}
            >
              <Wifi className="h-5 w-5" />
              {isNfcScanning ? (
                <Trans
                  i18nKey="merchant:scan.scanning"
                  defaults="Scanning..."
                />
              ) : (
                <Trans i18nKey="merchant:scan.withNfc" defaults="with NFC" />
              )}
            </Button>
          </div>

          <Button
            variant="secondary"
            size="lg"
            className="h-12 w-full"
            onClick={() => handleOpenChange(false)}
          >
            <Trans i18nKey="common:cancel" defaults="Cancel" />
          </Button>
        </SheetContent>
      </Sheet>

      <QrScannerModal
        open={isQrScannerOpen}
        onOpenChange={setIsQrScannerOpen}
        onScan={handleQrScan}
      />

      <ScanResultDialog
        open={isResultDialogOpen}
        onOpenChange={setIsResultDialogOpen}
        cardData={scannedCardData}
        merchantId={merchantId}
        isPending={isPending}
      />
    </>
  );
}

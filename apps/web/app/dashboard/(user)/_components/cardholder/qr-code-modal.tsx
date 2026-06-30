'use client';

import QRCode from 'react-qr-code';

import { Dialog, DialogContent } from '@kit/ui/dialog';

interface QRCodeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  value: string;
}

export function QRCodeModal({ open, onOpenChange, value }: QRCodeModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex w-[calc(100vw-2rem)] max-w-sm flex-col items-center p-6"
        data-test="qr-code-modal"
      >
        {/* QR Code with overlay */}
        <div
          className="relative mt-4 w-full max-w-[300px] rounded-3xl bg-white p-4"
          data-test="qr-code-display"
        >
          <QRCode
            value={value}
            style={{ width: '100%', height: 'auto' }}
            aria-label="Verification QR code"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}

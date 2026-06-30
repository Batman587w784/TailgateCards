'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';

import type { IScannerControls } from '@zxing/browser';

export type ScannerStatus = 'idle' | 'loading' | 'scanning' | 'error';

// zxing Result interface (getText returns decoded text)
interface ZxingResult {
  getText(): string;
}

// BarcodeDetector is not in TypeScript's DOM lib yet
declare global {
  interface BarcodeDetectorOptions {
    formats: string[];
  }

  interface DetectedBarcode {
    rawValue: string;
  }

  class BarcodeDetector {
    constructor(options?: BarcodeDetectorOptions);
    static getSupportedFormats(): Promise<string[]>;
    detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>;
  }
}

export function useQrScanner(open: boolean, onScan: (text: string) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const bdRef = useRef<BarcodeDetector | null>(null);
  const zxingControlsRef = useRef<IScannerControls | null>(null);
  const onScanRef = useRef(onScan);
  const hasScannedRef = useRef(false);

  const intervalRef = useRef<number | null>(null);

  const [status, setStatus] = useState<ScannerStatus>('idle');

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  const cleanup = useCallback(() => {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = null;

    if (zxingControlsRef.current) {
      try {
        zxingControlsRef.current.stop();
      } catch {
        // Ignore cleanup errors
      }
      zxingControlsRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    const v = videoRef.current;
    if (v) v.srcObject = null;
  }, []);

  useEffect(() => {
    if (!open) {
      cleanup();
      setStatus('idle');
      return;
    }

    let cancelled = false;

    const start = async () => {
      setStatus('loading');
      hasScannedRef.current = false;

      const video = await waitForVideoElement(videoRef, () => cancelled);
      if (!video || cancelled) {
        if (!cancelled) setStatus('error');
        return;
      }

      const handleScan = (text: string) => {
        if (hasScannedRef.current || cancelled) return;

        hasScannedRef.current = true;
        cleanup();
        onScanRef.current(text);
      };

      try {
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera access is not supported in this browser');
        }

        // Request camera permission before loading detector-specific code.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = stream;
        video.srcObject = stream;
        await video.play();

        if (cancelled) return;

        setStatus('scanning');

        // Path A: BarcodeDetector (mostly Chromium; Safari is typically out)
        const hasBD = 'BarcodeDetector' in window;
        const formats =
          hasBD && typeof BarcodeDetector.getSupportedFormats === 'function'
            ? await BarcodeDetector.getSupportedFormats()
            : [];

        if (cancelled) return;

        const canQr = Array.isArray(formats) && formats.includes('qr_code');

        if (hasBD && canQr) {
          bdRef.current =
            bdRef.current ?? new BarcodeDetector({ formats: ['qr_code'] });

          const tick = async () => {
            if (cancelled) return;
            try {
              // Pass the video element directly, not ImageData
              const found = await bdRef.current?.detect(video);
              if (found?.length && found[0]) {
                handleScan(found[0].rawValue);
              }
            } catch {
              // Ignore detection errors
            }
          };

          // 6-10 fps is plenty; rAF can be overkill
          intervalRef.current = window.setInterval(() => void tick(), 150);
          return;
        }

        // Path B: Fallback (works where BarcodeDetector is missing/disabled, e.g., iOS Safari)
        cleanup();

        if (cancelled) return;

        const { BrowserQRCodeReader } = await import('@zxing/browser');
        if (cancelled) return;

        const reader = new BrowserQRCodeReader();

        zxingControlsRef.current = await reader.decodeFromConstraints(
          {
            video: {
              facingMode: { ideal: 'environment' },
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
          },
          video,
          (result: ZxingResult | undefined) => {
            if (!result) return;
            const text = result.getText();
            handleScan(text);
          },
        );

        if (!cancelled) setStatus('scanning');
      } catch (e) {
        console.error('Camera/scanner error:', e);
        if (!cancelled) setStatus('error');
      }
    };

    void start();

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [cleanup, open]);

  return { videoRef, status, cleanup };
}

async function waitForVideoElement(
  videoRef: RefObject<HTMLVideoElement | null>,
  isCancelled: () => boolean,
) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (videoRef.current || isCancelled()) {
      return videoRef.current;
    }

    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
  }

  return videoRef.current;
}

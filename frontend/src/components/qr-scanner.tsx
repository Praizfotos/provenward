"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import type { Html5Qrcode } from "html5-qrcode";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

/**
 * Live camera QR reader for the verify form. Scans a QR code printed on a
 * product — typically the product's verify URL — and hands the decoded text to
 * `onScan`. Stops the camera as soon as a code is read.
 */
export function QrScanner({
  onScan,
  onClose,
}: {
  onScan: (text: string) => void;
  onClose: () => void;
}) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const [error, setError] = useState<string | null>(null);

  const stop = useCallback(async () => {
    const scanner = scannerRef.current;
    if (!scanner) {
      return;
    }
    scannerRef.current = null;
    try {
      await scanner.stop();
    } catch {
      // Camera may already be stopped.
    }
    try {
      scanner.clear();
    } catch {
      // Reader may already be cleared.
    }
  }, []);

  useEffect(() => {
    let disposed = false;

    async function start() {
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        if (disposed) {
          return;
        }
        const scanner = new Html5Qrcode("provenward-qr-reader", {
          verbose: false,
        });
        scannerRef.current = scanner;
        await scanner.start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 220, height: 220 } },
          async (decodedText) => {
            void stop();
            onScan(decodedText);
          },
          () => {
            // Frame without a readable code — keep scanning.
          },
        );
      } catch (caught) {
        if (!disposed) {
          setError(
            caught instanceof Error
              ? caught.message
              : "Could not start the camera. Check camera permissions and HTTPS.",
          );
        }
      }
    }

    void start();

    return () => {
      disposed = true;
      void stop();
    };
  }, [onScan, stop]);

  return (
    <div className="space-y-3">
      <div
        id="provenward-qr-reader"
        className="overflow-hidden rounded-lg border bg-background [&_video]:mx-auto [&_video]:max-h-72 [&_video]:w-full [&_video]:object-contain"
      />
      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Camera unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="button" variant="outline" size="sm" onClick={onClose}>
        <X className="mr-2 h-4 w-4" />
        Stop scanning
      </Button>
    </div>
  );
}

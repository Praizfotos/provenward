"use client";

import { useCallback, useState } from "react";
import { ScanSearch, Loader2, QrCode } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { QrScanner } from "@/components/qr-scanner";
import { VerificationResultPanel } from "@/components/verification-result";
import { ApiError, verifySerial, VerifyResponse } from "@/lib/api";

const HEX64 = "[0-9a-fA-F]{64}";

function parseScan(text: string): { batchId: string; serial: string } | null {
  const trimmed = text.trim();

  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const url = new URL(trimmed);
      const segments = url.pathname.split("/").filter(Boolean);
      const verifyIndex = segments.findIndex((segment) => segment === "verify");
      if (verifyIndex !== -1 && segments.length >= verifyIndex + 3) {
        const batchId = segments[verifyIndex + 1];
        const serial = segments[verifyIndex + 2];
        if (new RegExp(`^(0x)?${HEX64}$`).test(batchId) && /^\d+$/.test(serial)) {
          return { batchId, serial };
        }
      }
    } catch {
      // Not a parseable URL — fall through to the plain-format parser.
    }
  }

  const match = trimmed.match(
    new RegExp(`^(0x${HEX64}|${HEX64})[:|,\\s]+(\\d+)$`),
  );
  if (match) {
    return { batchId: match[1], serial: match[2] };
  }

  return null;
}

export function ScanForm() {
  const [batchId, setBatchId] = useState("");
  const [serial, setSerial] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [scanning, setScanning] = useState(false);

  const runVerify = useCallback(async (nextBatchId: string, nextSerial: string) => {
    if (!nextBatchId || !nextSerial) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const response = await verifySerial(nextBatchId, nextSerial);
      setResult(response);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : "Verification failed",
      );
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleScan = useCallback(
    (text: string) => {
      setScanning(false);
      const parsed = parseScan(text);
      if (!parsed) {
        setError("Could not read the code. It must contain a verify URL or a batch ID and serial.");
        return;
      }
      setError(null);
      setBatchId(parsed.batchId);
      setSerial(parsed.serial);
      void runVerify(parsed.batchId, parsed.serial);
    },
    [runVerify],
  );

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="batch-id">Batch ID (32-byte hex)</Label>
            <Input
              id="batch-id"
              placeholder="0x9f3c…"
              value={batchId}
              onChange={(event) => setBatchId(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="serial">Serial number</Label>
            <Input
              id="serial"
              placeholder="e.g. 1042"
              value={serial}
              onChange={(event) => setSerial(event.target.value)}
              inputMode="numeric"
              autoComplete="off"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button
            size="lg"
            disabled={loading || !batchId || !serial}
            onClick={() => void runVerify(batchId, serial)}
          >
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanSearch className="mr-2 h-4 w-4" />}
            {loading ? "Checking…" : "Verify product"}
          </Button>
          <Button
            type="button"
            size="lg"
            variant="outline"
            onClick={() => setScanning((value) => !value)}
          >
            <QrCode className="mr-2 h-4 w-4" />
            {scanning ? "Cancel scanning" : "Scan QR code"}
          </Button>
        </div>
      </div>

      {scanning ? (
        <QrScanner onScan={handleScan} onClose={() => setScanning(false)} />
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Verification unavailable</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {result ? <VerificationResultPanel response={result} /> : null}
    </div>
  );
}

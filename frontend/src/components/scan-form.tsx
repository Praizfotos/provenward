"use client";

import { useCallback, useState } from "react";
import { ScanSearch, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { VerificationResultPanel } from "@/components/verification-result";
import { ApiError, verifySerial, VerifyResponse } from "@/lib/api";

export function ScanForm() {
  const [batchId, setBatchId] = useState("");
  const [serial, setSerial] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<VerifyResponse | null>(null);

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
        <Button
          size="lg"
          disabled={loading || !batchId || !serial}
          onClick={() => void runVerify(batchId, serial)}
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ScanSearch className="mr-2 h-4 w-4" />}
          {loading ? "Checking…" : "Verify product"}
        </Button>
      </div>

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

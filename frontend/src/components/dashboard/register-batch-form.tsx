"use client";

import { useCallback, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { randomBatchId, registerBatch, TransactionSubmissionError } from "@/lib/contract";

function dateToEpochSeconds(dateString: string): bigint {
  if (!dateString) {
    return 0n;
  }
  const [year, month, day] = dateString.split("-").map(Number);
  return BigInt(Math.floor(Date.UTC(year, month - 1, day) / 1000));
}

export function RegisterBatchForm({ publicKey }: { publicKey: string }) {
  const [batchId, setBatchId] = useState("");
  const [productName, setProductName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [manufacturedDate, setManufacturedDate] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleGenerate = useCallback(() => {
    setBatchId(randomBatchId());
    setSuccess(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const manufactured = dateToEpochSeconds(manufacturedDate);
      const { hash } = await registerBatch(publicKey, {
        batchIdHex: batchId,
        productName: productName.trim(),
        serialRangeStart: BigInt(start),
        serialRangeEnd: BigInt(end),
        manufacturedDate: manufactured,
      });
      setSuccess(hash);
      setProductName("");
      setStart("");
      setEnd("");
      setManufacturedDate("");
    } catch (caught) {
      setError(
        caught instanceof TransactionSubmissionError || caught instanceof Error
          ? caught.message
          : "Batch registration failed",
      );
    } finally {
      setBusy(false);
    }
  }, [publicKey, batchId, productName, start, end, manufacturedDate]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="batch-id">Batch ID (32-byte hex)</Label>
          <div className="flex gap-2">
            <Input
              id="batch-id"
              className="font-mono"
              placeholder="0x…"
              value={batchId}
              onChange={(event) => setBatchId(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <Button type="button" variant="outline" onClick={handleGenerate}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Generate
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="product-name">Product name</Label>
          <Input
            id="product-name"
            placeholder="e.g. Air Purifier 5000"
            value={productName}
            onChange={(event) => setProductName(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="manufactured-date">Manufactured date</Label>
          <Input
            id="manufactured-date"
            type="date"
            value={manufacturedDate}
            onChange={(event) => setManufacturedDate(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="serial-start">Serial range start</Label>
          <Input
            id="serial-start"
            inputMode="numeric"
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="serial-end">Serial range end</Label>
          <Input
            id="serial-end"
            inputMode="numeric"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </div>
      </div>
      <Button disabled={busy || !batchId || !productName || !start || !end || !manufacturedDate} onClick={() => void handleSubmit()}>
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {busy ? "Submitting transaction…" : "Register batch on-chain"}
      </Button>
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      {success ? (
        <Alert variant="success">
          <AlertTitle>Batch registered</AlertTitle>
          <AlertDescription>
            Transaction confirmed. Hash: <span className="break-all font-mono">{success}</span>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

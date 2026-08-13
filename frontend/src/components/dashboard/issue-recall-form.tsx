"use client";

import { useCallback, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { issueRecall, randomBatchId, Severity, TransactionSubmissionError } from "@/lib/contract";

interface IssueRecallFormProps {
  publicKey: string;
  batches: string[];
}

export function IssueRecallForm({ publicKey, batches }: IssueRecallFormProps) {
  const [batchId, setBatchId] = useState("");
  const [severity, setSeverity] = useState<Severity>("Warning");
  const [messageHash, setMessageHash] = useState("");
  const [affectedStart, setAffectedStart] = useState("");
  const [affectedEnd, setAffectedEnd] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleGenerateHash = useCallback(() => {
    setMessageHash(randomBatchId());
    setSuccess(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const { hash } = await issueRecall(publicKey, {
        batchIdHex: batchId,
        severity,
        messageHashHex: messageHash,
        affectedSerialStart: BigInt(affectedStart),
        affectedSerialEnd: BigInt(affectedEnd),
      });
      setSuccess(hash);
      setAffectedStart("");
      setAffectedEnd("");
    } catch (caught) {
      setError(
        caught instanceof TransactionSubmissionError || caught instanceof Error
          ? caught.message
          : "Recall issuance failed",
      );
    } finally {
      setBusy(false);
    }
  }, [publicKey, batchId, severity, messageHash, affectedStart, affectedEnd]);

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Batch</Label>
          <Select value={batchId} onValueChange={setBatchId}>
            <SelectTrigger className="font-mono">
              <SelectValue placeholder="Select a batch" />
            </SelectTrigger>
            <SelectContent>
              {batches.map((id) => (
                <SelectItem key={id} value={id}>
                  {`0x${id.slice(0, 12)}…`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Severity</Label>
          <Select value={severity} onValueChange={(value) => setSeverity(value as Severity)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Info">Info</SelectItem>
              <SelectItem value="Warning">Warning</SelectItem>
              <SelectItem value="Critical">Critical</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <Label htmlFor="message-hash">Off-chain details document hash (32-byte hex)</Label>
          <div className="flex gap-2">
            <Input
              id="message-hash"
              className="font-mono"
              placeholder="0x…"
              value={messageHash}
              onChange={(event) => setMessageHash(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
            <Button type="button" variant="outline" onClick={handleGenerateHash}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Generate
            </Button>
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="affected-start">Affected serial start</Label>
          <Input
            id="affected-start"
            inputMode="numeric"
            value={affectedStart}
            onChange={(event) => setAffectedStart(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="affected-end">Affected serial end</Label>
          <Input
            id="affected-end"
            inputMode="numeric"
            value={affectedEnd}
            onChange={(event) => setAffectedEnd(event.target.value)}
          />
        </div>
      </div>
      <Button
        disabled={busy || !batchId || !messageHash || !affectedStart || !affectedEnd}
        onClick={() => void handleSubmit()}
        variant={severity === "Critical" ? "destructive" : "default"}
      >
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {busy ? "Submitting transaction…" : `Issue ${severity} recall`}
      </Button>
      {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
      {success ? (
        <Alert variant="success">
          <AlertTitle>Recall issued</AlertTitle>
          <AlertDescription>
            Transaction confirmed. Hash: <span className="break-all font-mono">{success}</span>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
}

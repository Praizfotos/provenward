"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck, Wallet } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { ApiError, getAlertPreferences, setAlertPreferences } from "@/lib/api";
import {
  checkWallet,
  connectWallet,
  maskAddress,
  signAlertPrefsMessage,
  WalletState,
} from "@/lib/wallet";
import { registerOwnershipReceipt, TransactionSubmissionError } from "@/lib/contract";

export function RegisterPurchase() {
  const [wallet, setWallet] = useState<WalletState>({
    connected: false,
    publicKey: null,
    network: null,
    error: null,
  });
  const [batchId, setBatchId] = useState("");
  const [serial, setSerial] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const [email, setEmail] = useState("");
  const [webhookUrl, setWebhookUrl] = useState("");
  const [prefsBusy, setPrefsBusy] = useState(false);
  const [prefsMessage, setPrefsMessage] = useState<string | null>(null);
  const [prefsError, setPrefsError] = useState<string | null>(null);

  useEffect(() => {
    void checkWallet().then(setWallet);
  }, []);

  const handleConnect = useCallback(async () => {
    const state = await connectWallet();
    setWallet(state);
    if (state.publicKey) {
      try {
        const prefs = await getAlertPreferences(state.publicKey);
        setEmail(prefs.email ?? "");
        setWebhookUrl("");
      } catch {
        // No preferences yet — that is fine.
      }
    }
  }, []);

  const handleRegister = useCallback(async () => {
    if (!wallet.publicKey) {
      return;
    }
    setBusy(true);
    setError(null);
    setTxHash(null);
    try {
      const serialValue = BigInt(serial);
      const { hash } = await registerOwnershipReceipt(wallet.publicKey, batchId, serialValue);
      setTxHash(hash);
    } catch (caught) {
      setError(
        caught instanceof TransactionSubmissionError || caught instanceof Error
          ? caught.message
          : "Registration failed",
      );
    } finally {
      setBusy(false);
    }
  }, [wallet.publicKey, batchId, serial]);

  const handleSavePrefs = useCallback(async () => {
    if (!wallet.publicKey) {
      return;
    }
    setPrefsBusy(true);
    setPrefsError(null);
    setPrefsMessage(null);
    try {
      const signature = await signAlertPrefsMessage({
        owner: wallet.publicKey,
        email: email.trim() || null,
        webhookUrl: webhookUrl.trim() || null,
      });
      await setAlertPreferences({
        owner: wallet.publicKey,
        email: email.trim() || null,
        webhookUrl: webhookUrl.trim() || null,
        signature,
      });
      setPrefsMessage("Alert preferences saved. You'll be notified only about products you own.");
    } catch (caught) {
      setPrefsError(
        caught instanceof ApiError
          ? caught.message
          : caught instanceof Error
            ? caught.message
            : "Could not save preferences",
      );
    } finally {
      setPrefsBusy(false);
    }
  }, [wallet.publicKey, email, webhookUrl]);

  if (!wallet.connected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5" />
            Connect your Stellar wallet
          </CardTitle>
          <CardDescription>
            Purchase registration stores only your wallet address, batch, and serial on-chain.
            Your email or name is never stored on the ledger.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {wallet.error ? (
            <Alert variant="destructive">
              <AlertTitle>Freighter not available</AlertTitle>
              <AlertDescription>
                Install the Freighter extension for your browser, then connect.
              </AlertDescription>
            </Alert>
          ) : null}
          <Button onClick={() => void handleConnect()}>
            <Wallet className="mr-2 h-4 w-4" />
            Connect with Freighter
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            Register a purchase
          </CardTitle>
          <CardDescription>
            Connected as <span className="font-mono">{maskAddress(wallet.publicKey ?? "")}</span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="purchase-batch">Batch ID (32-byte hex)</Label>
              <Input
                id="purchase-batch"
                placeholder="0x…"
                value={batchId}
                onChange={(event) => setBatchId(event.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="purchase-serial">Serial number</Label>
              <Input
                id="purchase-serial"
                placeholder="e.g. 1042"
                value={serial}
                onChange={(event) => setSerial(event.target.value)}
                inputMode="numeric"
              />
            </div>
          </div>
          <Button
            disabled={busy || !batchId || !serial}
            onClick={() => void handleRegister()}
          >
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {busy ? "Signing transaction…" : "Register this serial on-chain"}
          </Button>
          {error ? <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert> : null}
          {txHash ? (
            <Alert variant="success">
              <ShieldCheck className="h-4 w-4" />
              <AlertTitle>Ownership registered</AlertTitle>
              <AlertDescription>
                Transaction confirmed. Hash: <span className="break-all font-mono">{txHash}</span>
              </AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Recall alerts (optional)</CardTitle>
          <CardDescription>
            Opt in to receive a notification when a recall affects a serial you own. Your
            email or webhook is stored only in Provenward&apos;s off-chain database, never on the
            ledger, and only after you sign this consent with your wallet.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="prefs-email">Email</Label>
              <Input
                id="prefs-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="prefs-webhook">Webhook URL</Label>
              <Input
                id="prefs-webhook"
                type="url"
                placeholder="https://…"
                value={webhookUrl}
                onChange={(event) => setWebhookUrl(event.target.value)}
              />
            </div>
          </div>
          <Button variant="outline" disabled={prefsBusy || (!email.trim() && !webhookUrl.trim())} onClick={() => void handleSavePrefs()}>
            {prefsBusy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {prefsBusy ? "Signing…" : "Save alert preferences"}
          </Button>
          {prefsMessage ? <Alert variant="success"><AlertDescription>{prefsMessage}</AlertDescription></Alert> : null}
          {prefsError ? <Alert variant="destructive"><AlertDescription>{prefsError}</AlertDescription></Alert> : null}
        </CardContent>
      </Card>
    </div>
  );
}

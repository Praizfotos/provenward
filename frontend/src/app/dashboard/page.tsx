"use client";

import { useCallback, useEffect, useState } from "react";
import { Factory, Loader2, RefreshCw, Wallet } from "lucide-react";

import { AnalyticsPanel } from "@/components/dashboard/analytics-panel";
import { BatchList } from "@/components/dashboard/batch-list";
import { IssueRecallForm } from "@/components/dashboard/issue-recall-form";
import { RegisterBatchForm } from "@/components/dashboard/register-batch-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { connectWallet, maskAddress, WalletState } from "@/lib/wallet";
import {
  getBatchesForManufacturer,
  getManufacturerId,
  TransactionSubmissionError,
} from "@/lib/contract";

type Tab = "batches" | "register" | "recall" | "analytics";

const TABS: { id: Tab; label: string }[] = [
  { id: "batches", label: "My batches" },
  { id: "register", label: "Register batch" },
  { id: "recall", label: "Issue recall" },
  { id: "analytics", label: "Analytics" },
];

export default function DashboardPage() {
  const [wallet, setWallet] = useState<WalletState>({
    connected: false,
    publicKey: null,
    network: null,
    error: null,
  });
  const [tab, setTab] = useState<Tab>("batches");
  const [manufacturerId, setManufacturerId] = useState<bigint | null>(null);
  const [batches, setBatches] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadManufacturer = useCallback(async (publicKey: string) => {
    setLoading(true);
    setLoadError(null);
    try {
      const [id, batchIds] = await Promise.all([
        getManufacturerId(publicKey),
        getBatchesForManufacturer(publicKey),
      ]);
      setManufacturerId(id);
      setBatches(batchIds);
    } catch (caught) {
      setLoadError(
        caught instanceof TransactionSubmissionError || caught instanceof Error
          ? caught.message
          : "Could not load manufacturer data",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (wallet.publicKey) {
      void loadManufacturer(wallet.publicKey);
    }
  }, [wallet.publicKey, loadManufacturer]);

  const handleConnect = useCallback(async () => {
    const state = await connectWallet();
    setWallet(state);
  }, []);

  const isRegistered = manufacturerId !== null;

  if (!wallet.connected) {
    return (
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Manufacturer dashboard</h1>
          <p className="text-muted-foreground">
            This tool is wallet-gated. Connect the wallet that was onboarded as your
            manufacturer account to register batches, issue recalls, and view aggregate
            scan analytics.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Connect your manufacturer wallet
            </CardTitle>
            <CardDescription>
              Manufacturing actions are signed and submitted to the Soroban contract from
              your browser.
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
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight">Manufacturer dashboard</h1>
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Factory className="h-4 w-4" />
            {maskAddress(wallet.publicKey ?? "")}
            {isRegistered ? (
              <Badge variant="success">Registered · id #{manufacturerId.toString()}</Badge>
            ) : null}
          </p>
        </div>
        <Button variant="outline" size="sm" disabled={loading} onClick={() => wallet.publicKey ? void loadManufacturer(wallet.publicKey) : undefined}>
          <RefreshCw className={cn("mr-2 h-4 w-4", loading && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {!isRegistered ? (
        <Alert>
          <AlertTitle>Not yet onboarded</AlertTitle>
          <AlertDescription>
            This wallet address has no manufacturer record on the contract. An admin must
            call <span className="font-mono">register_manufacturer</span> for it before you
            can register batches. If you were given a manufacturer address, connect that
            wallet instead.
          </AlertDescription>
        </Alert>
      ) : null}

      {loadError ? (
        <Alert variant="destructive">
          <AlertTitle>Sync issue</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2 border-b pb-px">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => setTab(item.id)}
            className={cn(
              "rounded-t-md border-b-2 px-4 py-2 text-sm font-medium transition-colors",
              tab === item.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div>
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Syncing with the registry…
          </div>
        ) : (
          <>
            {tab === "batches" ? (
              <BatchList batches={batches} />
            ) : null}
            {tab === "register" && wallet.publicKey ? (
              <RegisterBatchForm publicKey={wallet.publicKey} />
            ) : null}
            {tab === "recall" && wallet.publicKey ? (
              <IssueRecallForm publicKey={wallet.publicKey} batches={batches} />
            ) : null}
            {tab === "analytics" && manufacturerId !== null ? (
              <AnalyticsPanel manufacturerId={manufacturerId} />
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
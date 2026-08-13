"use client";

import { useEffect, useState } from "react";
import { BarChart3, Loader2 } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getAnalytics, Analytics } from "@/lib/api";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border p-4">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
    </div>
  );
}

export function AnalyticsPanel({ manufacturerId }: { manufacturerId: bigint }) {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void getAnalytics(Number(manufacturerId))
      .then((analytics) => {
        if (!cancelled) {
          setData(analytics);
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(caught instanceof Error ? caught.message : "Could not load analytics");
        }
      });
    return () => {
      cancelled = true;
    };
  }, [manufacturerId]);

  if (error) {
    return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>;
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading analytics…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Registered batches" value={data.totalBatches} />
        <Stat label="Total verification scans" value={data.totalScans} />
        <Stat label="Genuine scans" value={data.genuineScans} />
        <Stat label="Non-genuine scans" value={data.nonGenuineScans} />
        <Stat label="Total recalls" value={data.totalRecalls} />
        <Stat label="Critical recalls" value={data.criticalRecalls} />
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            About these numbers
          </CardTitle>
          <CardDescription>
            Aggregate counts only. Provenward deliberately does not expose per-scan rows,
            serial numbers, or any personally identifying information to manufacturers.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}

"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function BatchList({ batches }: { batches: string[] }) {
  if (batches.length === 0) {
    return (
      <Alert>
        <AlertDescription>
          No batches registered yet. Use the &ldquo;Register batch&rdquo; tab to add your first
          production batch.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-3">
      {batches.map((batchId) => (
        <Card key={batchId}>
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <div className="min-w-0">
              <div className="font-mono text-sm">0x{batchId.slice(0, 20)}…</div>
              <div className="mt-1 truncate text-xs text-muted-foreground">
                Batch {batchId.slice(-6)}
              </div>
            </div>
            <Badge variant="secondary">Registered</Badge>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
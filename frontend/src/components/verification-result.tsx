import { BadgeCheck, ShieldAlert, ShieldQuestion, TriangleAlert } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Recall, VerifyResponse } from "@/lib/api";

function severityVariant(severity: Recall["severity"]): "destructive" | "warning" | "secondary" {
  switch (severity) {
    case "Critical":
      return "destructive";
    case "Warning":
      return "warning";
    case "Info":
      return "secondary";
  }
}

export function VerificationResultPanel({ response }: { response: VerifyResponse }) {
  const { result, recalls } = response;
  const activeRecalls = recalls;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {result.status === "genuine" ? (
              <BadgeCheck className="h-6 w-6 text-success" />
            ) : result.status === "out_of_range" ? (
              <ShieldQuestion className="h-6 w-6 text-warning" />
            ) : (
              <ShieldAlert className="h-6 w-6 text-destructive" />
            )}
            {result.status === "genuine"
              ? "Authentic product"
              : result.status === "out_of_range"
                ? "Serial outside registered range"
                : "Unregistered batch"}
          </CardTitle>
          <CardDescription>
            {result.status === "genuine"
              ? "This serial number is registered on-chain for the given batch."
              : result.status === "out_of_range"
                ? "The batch exists, but this serial falls outside its registered range."
                : "This batch identifier is not registered with any manufacturer on the registry."}
          </CardDescription>
        </CardHeader>
        {result.status === "genuine" && result.details ? (
          <CardContent className="grid gap-3 sm:grid-cols-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Manufacturer</div>
              <div className="mt-1 break-all font-medium">{result.details.manufacturer}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Product</div>
              <div className="mt-1 font-medium">{result.details.productName}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-muted-foreground">Manufactured</div>
              <div className="mt-1 font-medium">
                {new Date(Number(result.details.manufacturedDate) * 1000).toLocaleDateString()}
              </div>
            </div>
          </CardContent>
        ) : null}
      </Card>

      {activeRecalls.length > 0 ? (
        <Alert variant="destructive">
          <TriangleAlert className="h-4 w-4" />
          <AlertTitle>Active safety alerts</AlertTitle>
          <AlertDescription>
            {activeRecalls.length} active recall{activeRecalls.length === 1 ? "" : "s"} affects
            this serial number.
          </AlertDescription>
        </Alert>
      ) : result.status === "genuine" ? (
        <Alert variant="success">
          <BadgeCheck className="h-4 w-4" />
          <AlertTitle>No active recalls</AlertTitle>
          <AlertDescription>
            No recall or safety alert currently covers this serial number.
          </AlertDescription>
        </Alert>
      ) : null}

      {activeRecalls.length > 0 ? (
        <div className="space-y-3">
          {activeRecalls.map((recall) => (
            <Card key={recall.id}>
              <CardContent className="pt-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold">Recall #{recall.id}</span>
                      <Badge variant={severityVariant(recall.severity)}>{recall.severity}</Badge>
                    </div>
                    <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                      <p>
                        Affected serials: {recall.affectedSerialStart} – {recall.affectedSerialEnd}
                      </p>
                      <p className="break-all">
                        Details document hash: <span className="font-mono">{recall.messageHash}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
    </div>
  );
}

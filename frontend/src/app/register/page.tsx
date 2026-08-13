import type { Metadata } from "next";

import { RegisterPurchase } from "@/components/register-purchase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Register your purchase",
  description:
    "Register your product purchase on-chain for recall alerts without exposing personal data.",
};

export default function RegisterPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Register your purchase</h1>
        <p className="text-muted-foreground">
          Prove you own a serial number so Provenward can alert you about recalls that
          affect it — without the manufacturer ever learning who you are.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>What happens on-chain</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              Stored on-chain: your wallet address, the batch ID, the serial number, and a
              timestamp. Nothing else.
            </li>
            <li>
              Never stored on-chain: your name, email, phone number, physical address, or any
              other personal data.
            </li>
            <li>
              Alert contact details live only in Provenward&apos;s off-chain database and only if
              you opt in by signing this page&apos;s consent message.
            </li>
          </ul>
        </CardContent>
      </Card>

      <RegisterPurchase />
    </div>
  );
}

import Link from "next/link";

import { ScanForm } from "@/components/scan-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight sm:text-4xl">
            Check a product&apos;s authenticity and safety status
          </h1>
          <p className="max-w-2xl text-muted-foreground">
            Enter the batch ID and serial number printed on your product (or scan its
            QR code). Provenward checks the on-chain registry — no wallet or account
            required.
          </p>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Verify a product</CardTitle>
            <CardDescription>
              Results come straight from the Soroban contract on Stellar&apos;s public
              testnet.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScanForm />
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Own this product?</CardTitle>
            <CardDescription>
              Register your purchase to receive recall alerts without revealing any
              personal data.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/register">Register my purchase</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Are you a manufacturer?</CardTitle>
            <CardDescription>
              Register production batches and publish recall notices on-chain.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline" className="w-full">
              <Link href="/dashboard">Open manufacturer dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

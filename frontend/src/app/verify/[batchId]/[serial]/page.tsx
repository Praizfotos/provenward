import Link from "next/link";
import { notFound } from "next/navigation";

import { VerificationResultPanel } from "@/components/verification-result";
import { Button } from "@/components/ui/button";
import { ApiError, verifySerial } from "@/lib/api";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function VerifyPage({
  params,
}: {
  params: { batchId: string; serial: string };
}) {
  let response;
  try {
    response = await verifySerial(params.batchId, params.serial);
  } catch (error) {
    if (error instanceof ApiError && (error.status === 404 || error.status === 400)) {
      notFound();
    }
    throw error;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">Verification result</h1>
        <p className="text-sm text-muted-foreground">
          Batch <span className="font-mono">{params.batchId}</span> · Serial{" "}
          <span className="font-mono">{params.serial}</span>
        </p>
      </div>
      <VerificationResultPanel response={response} />
      <Button asChild variant="outline">
        <Link href="/">Verify another product</Link>
      </Button>
    </div>
  );
}

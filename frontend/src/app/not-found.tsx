import Link from "next/link";

import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center">
      <h1 className="text-3xl font-bold tracking-tight">Not found</h1>
      <p className="text-muted-foreground">
        We couldn&apos;t find the page or verification record you were looking for.
      </p>
      <Button asChild variant="outline">
        <Link href="/">Back to verification</Link>
      </Button>
    </div>
  );
}

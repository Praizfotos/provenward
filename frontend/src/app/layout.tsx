import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";

import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: {
    default: "Provenward — Product Authenticity & Recall Registry",
    template: "%s · Provenward",
  },
  description:
    "Verify physical products on Stellar Soroban, register your purchase for recall alerts, and let manufacturers publish safety notices on-chain.",
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

function NavLink({
  href,
  children,
  className,
}: {
  href: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
        className,
      )}
    >
      {children}
    </Link>
  );
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={cn(inter.variable)}>
      <body className="min-h-screen bg-background font-sans antialiased">
        <header className="border-b">
          <div className="container flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                P
              </span>
              <span className="text-lg font-semibold tracking-tight">Provenward</span>
            </Link>
            <nav className="flex items-center gap-6">
              <NavLink href="/">Verify</NavLink>
              <NavLink href="/register">Register purchase</NavLink>
              <NavLink href="/dashboard">Manufacturer dashboard</NavLink>
            </nav>
          </div>
        </header>
        <main className="container py-10">{children}</main>
        <footer className="border-t py-6">
          <div className="container flex flex-col gap-1 text-sm text-muted-foreground">
            <p>
              Provenward is a manufacturer-agnostic on-chain registry for product
              authenticity and recall propagation on Stellar Soroban.
            </p>
            <p>
              Verification never requires a wallet. Purchase registration is
              pseudonymous by design — no email or name is ever stored on-chain.
            </p>
          </div>
        </footer>
      </body>
    </html>
  );
}

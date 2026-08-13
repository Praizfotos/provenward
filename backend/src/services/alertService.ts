import { Keypair, StrKey } from "@stellar/stellar-sdk";
import { createHash } from "node:crypto";

const ED25519_MSG_PREFIX = Buffer.from("Stellar Signed Message:\n");

export type AlertPreferencesInput = {
  owner: string;
  email: string | null;
  webhookUrl: string | null;
};

/**
 * The exact byte payload a wallet signs. The frontend must reproduce this
 * string verbatim (see `lib/wallet.ts`).
 */
export function buildMessage(prefs: AlertPreferencesInput): string {
  return `provenward:alert-preferences:1:${prefs.owner}:${prefs.email ?? ""}:${prefs.webhookUrl ?? ""}`;
}

/**
 * Verifies a wallet signature over `buildMessage(prefs)` following the
 * SEP-53 ("Sign and Verify Messages") convention used by Freighter-style
 * wallets: the signer hashes `"Stellar Signed Message:\n" + message` with
 * SHA-256 and signs the digest with their ed25519 key.
 */
export function verifyMessageSignature(
  prefs: AlertPreferencesInput,
  signatureBase64: string,
): boolean {
  if (!StrKey.isValidEd25519PublicKey(prefs.owner)) {
    return false;
  }
  let signature: Buffer;
  try {
    signature = Buffer.from(signatureBase64, "base64");
  } catch {
    return false;
  }
  const payload = createHash("sha256")
    .update(ED25519_MSG_PREFIX)
    .update(Buffer.from(buildMessage(prefs), "utf8"))
    .digest();
  try {
    return Keypair.fromPublicKey(prefs.owner).verify(payload, signature);
  } catch {
    return false;
  }
}

export function maskEmail(email: string | null): string | null {
  if (!email || !email.includes("@")) {
    return email;
  }
  const [local, domain] = email.split("@");
  if (local.length <= 1) {
    return `${local.slice(0, 1)}***@${domain}`;
  }
  return `${local.slice(0, 1)}${"*".repeat(Math.min(local.length - 1, 6))}@${domain}`;
}
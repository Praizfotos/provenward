import { createHash } from "node:crypto";
import { Keypair } from "@stellar/stellar-sdk";
import {
  buildMessage,
  maskEmail,
  verifyMessageSignature,
} from "../services/alertService";

describe("buildMessage", () => {
  it("serializes preferences deterministically", () => {
    const owner = Keypair.random().publicKey();
    expect(buildMessage({ owner, email: "a@b.co", webhookUrl: "https://x" })).toBe(
      `provenward:alert-preferences:1:${owner}:a@b.co:https://x`,
    );
  });

  it("emits empty strings for missing optional fields", () => {
    const owner = Keypair.random().publicKey();
    expect(buildMessage({ owner, email: null, webhookUrl: null })).toBe(
      `provenward:alert-preferences:1:${owner}::`,
    );
  });
});

describe("verifyMessageSignature (SEP-53)", () => {
  it("accepts a real ed25519 signature over the message digest", () => {
    const keypair = Keypair.random();
    const owner = keypair.publicKey();
    const prefs = { owner, email: "owner@example.com", webhookUrl: null };

    const payload = Buffer.concat([
      Buffer.from("Stellar Signed Message:\n", "utf8"),
      Buffer.from(buildMessage(prefs), "utf8"),
    ]);
    const digest = createHash("sha256").update(payload).digest();
    const signature = keypair.sign(digest).toString("base64");

    expect(verifyMessageSignature(prefs, signature)).toBe(true);
  });

  it("rejects a signature over a different message", () => {
    const keypair = Keypair.random();
    const prefs = { owner: keypair.publicKey(), email: "a@b.co", webhookUrl: null };
    const other = { ...prefs, email: "other@b.co" };

    const digest = createHash("sha256")
      .update(
        Buffer.concat([
          Buffer.from("Stellar Signed Message:\n"),
          Buffer.from(buildMessage(other), "utf8"),
        ]),
      )
      .digest();
    const signature = keypair.sign(digest).toString("base64");

    expect(verifyMessageSignature(prefs, signature)).toBe(false);
  });

  it("rejects invalid owner addresses", () => {
    const keypair = Keypair.random();
    const prefs = { owner: "not-a-key", email: "a@b.co", webhookUrl: null };
    const digest = createHash("sha256").update("x").digest();
    const signature = keypair.sign(digest).toString("base64");
    expect(verifyMessageSignature(prefs, signature)).toBe(false);
  });

  it("rejects garbage signatures", () => {
    const keypair = Keypair.random();
    const prefs = { owner: keypair.publicKey(), email: "a@b.co", webhookUrl: null };
    expect(verifyMessageSignature(prefs, "!!!not-base64!!!")).toBe(false);
    expect(verifyMessageSignature(prefs, "")).toBe(false);
  });
});

describe("maskEmail", () => {
  it("masks the local part", () => {
    expect(maskEmail("alice@example.com")).toBe("a****@example.com");
  });

  it("caps the mask length", () => {
    expect(maskEmail("al@example.com")).toBe("a*@example.com");
  });

  it("returns null/identity for malformed input", () => {
    expect(maskEmail(null)).toBeNull();
    expect(maskEmail("not-an-email")).toBe("not-an-email");
  });
});
import nodemailer from "nodemailer";

import { config } from "../config";
import { logger } from "../logger";
import { Recall } from "../scval";

export interface DeliveryTarget {
  recall: Recall;
  productName: string;
  owner: string;
}

let transporter: nodemailer.Transporter | null = null;

function getTransporter(): nodemailer.Transporter | null {
  if (!config.SMTP_HOST) {
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: config.SMTP_HOST,
      port: config.SMTP_PORT,
      secure: config.SMTP_SECURE,
      auth:
        config.SMTP_USER && config.SMTP_PASS
          ? { user: config.SMTP_USER, pass: config.SMTP_PASS }
          : undefined,
    });
  }
  return transporter;
}

function renderEmail(target: DeliveryTarget): { subject: string; text: string } {
  const { recall, productName } = target;
  const severity = recall.severity.toUpperCase();
  return {
    subject: `[Provenward] ${severity}: recall notice for ${productName}`,
    text: [
      `A safety alert has been issued for a product you registered.`,
      ``,
      `Product:   ${productName}`,
      `Severity:  ${recall.severity}`,
      `Batch:     0x${recall.batchId}`,
      `Affected serials: ${recall.affectedSerialStart} - ${recall.affectedSerialEnd}`,
      `Details document hash: 0x${recall.messageHash}`,
      ``,
      `The full recall details document is published off-chain and referenced by the hash above.`,
      `Visit Provenward and enter your serial to see the latest safety status.`,
    ].join("\n"),
  };
}

export async function sendEmail(target: DeliveryTarget, email: string): Promise<void> {
  const transport = getTransporter();
  if (!transport) {
    throw new Error("SMTP is not configured on this instance");
  }
  const { subject, text } = renderEmail(target);
  await transport.sendMail({
    from: config.SMTP_FROM,
    to: email,
    subject,
    text,
  });
}

export async function sendWebhook(target: DeliveryTarget, webhookUrl: string): Promise<void> {
  const { recall, productName, owner } = target;
  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      event: "recall",
      owner,
      productName,
      recall: {
        id: recall.id,
        batchId: `0x${recall.batchId}`,
        severity: recall.severity,
        messageHash: `0x${recall.messageHash}`,
        affectedSerialStart: recall.affectedSerialStart.toString(),
        affectedSerialEnd: recall.affectedSerialEnd.toString(),
        issuedAt: recall.issuedAt.toString(),
      },
    }),
  });
  if (!response.ok) {
    logger.warn(
      { webhookUrl, status: response.status },
      "webhook delivery returned non-2xx",
    );
  }
}
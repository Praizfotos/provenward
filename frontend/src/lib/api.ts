import { BACKEND_URL } from "./constants";

const API_BASE =
  typeof window === "undefined"
    ? `${BACKEND_URL}/api`
    : "/api/backend";

export interface GenuineDetails {
  manufacturer: string;
  productName: string;
  manufacturedDate: string;
}

export type VerificationStatus = "genuine" | "not_found" | "out_of_range";

export interface VerificationResult {
  status: VerificationStatus;
  details: GenuineDetails | null;
}

export interface Recall {
  id: number;
  batchId: string;
  manufacturer: string;
  severity: "Info" | "Warning" | "Critical";
  messageHash: string;
  affectedSerialStart: string;
  affectedSerialEnd: string;
  issuedAt: string;
}

export interface VerifyResponse {
  result: VerificationResult;
  recalls: Recall[];
  cached: boolean;
}

export interface RecallsResponse {
  batchId: string;
  recalls: Recall[];
  summary: { count: number; critical: number; warning: number; info: number };
}

export interface Manufacturer {
  id: number;
  address: string;
  name: string;
  registeredAt: number;
}

export interface Batch {
  batchId: string;
  productName: string;
  serialRangeStart: string;
  serialRangeEnd: string;
  manufacturedDate: number;
  recallCount: number;
}

export interface ManufacturerDetail {
  manufacturer: Omit<Manufacturer, "registeredAt">;
  batches: Batch[];
}

export interface Analytics {
  manufacturerId: number;
  totalBatches: number;
  totalScans: number;
  genuineScans: number;
  nonGenuineScans: number;
  totalRecalls: number;
  criticalRecalls: number;
}

export interface AlertPreferences {
  owner: string;
  active: boolean;
  email: string | null;
  webhookEnabled: boolean;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function normalizeBatchId(input: string): string {
  return input.replace(/^0x/, "").toLowerCase();
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, init);
  const text = await response.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "message" in body
        ? String((body as { message: unknown }).message)
        : `Request failed with status ${response.status}`;
    throw new ApiError(message, response.status);
  }
  return body as T;
}

export async function verifySerial(
  batchId: string,
  serial: string,
): Promise<VerifyResponse> {
  return request<VerifyResponse>(
    `/verify/${normalizeBatchId(batchId)}/${serial}`,
    { cache: "no-store" },
  );
}

export async function getRecalls(batchId: string): Promise<RecallsResponse> {
  return request<RecallsResponse>(`/recalls?batchId=${encodeURIComponent(normalizeBatchId(batchId))}`);
}

export async function getManufacturers(): Promise<{ manufacturers: Manufacturer[] }> {
  return request<{ manufacturers: Manufacturer[] }>("/manufacturers");
}

export async function getManufacturerBatches(id: number): Promise<ManufacturerDetail> {
  return request<ManufacturerDetail>(`/manufacturers/${id}/batches`);
}

export async function getAnalytics(id: number): Promise<Analytics> {
  return request<Analytics>(`/manufacturers/${id}/analytics`);
}

export async function getAlertPreferences(owner: string): Promise<AlertPreferences> {
  return request<AlertPreferences>(`/alert-preferences/${encodeURIComponent(owner)}`);
}

export async function setAlertPreferences(input: {
  owner: string;
  email?: string | null;
  webhookUrl?: string | null;
  signature: string;
}): Promise<{ ok: boolean }> {
  return request<{ ok: boolean }>("/alert-preferences", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
}

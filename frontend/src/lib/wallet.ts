import {
  getAddress,
  getNetwork,
  isConnected,
  requestAccess,
  signMessage,
} from "@stellar/freighter-api";

/**
 * Wallet helpers wrapping the Freighter browser extension. Signatures follow
 * SEP-53 ("Sign and Verify Messages"); the backend verifies the same format.
 */

export interface WalletState {
  connected: boolean;
  publicKey: string | null;
  network: string | null;
  error: string | null;
}

export async function checkWallet(): Promise<WalletState> {
  try {
    const connected = await isConnected();
    if (!connected.isConnected) {
      return { connected: false, publicKey: null, network: null, error: null };
    }
    const address = await getAddress();
    const network = await getNetwork();
    return { connected: true, publicKey: address.address, network: network.network, error: null };
  } catch (error) {
    return {
      connected: false,
      publicKey: null,
      network: null,
      error: error instanceof Error ? error.message : "Freighter unavailable",
    };
  }
}

export async function connectWallet(): Promise<WalletState> {
  try {
    const access = await requestAccess();
    if (access.error) {
      return {
        connected: false,
        publicKey: null,
        network: null,
        error: access.error.message,
      };
    }
    return {
      connected: true,
      publicKey: access.address,
      network: null,
      error: null,
    };
  } catch (error) {
    return {
      connected: false,
      publicKey: null,
      network: null,
      error: error instanceof Error ? error.message : "Freighter unavailable",
    };
  }
}

/**
 * The exact byte payload the wallet signs. Must match `buildMessage` in the
 * backend (`services/alertService.ts`).
 */
export function buildAlertPrefsMessage(input: {
  owner: string;
  email: string | null;
  webhookUrl: string | null;
}): string {
  return `provenward:alert-preferences:1:${input.owner}:${input.email ?? ""}:${input.webhookUrl ?? ""}`;
}

function signatureToString(signature: string | Buffer | null): string {
  if (signature === null) {
    throw new Error("Message signing returned an empty signature");
  }
  return typeof signature === "string" ? signature : signature.toString("base64");
}

export async function signAlertPrefsMessage(input: {
  owner: string;
  email: string | null;
  webhookUrl: string | null;
}): Promise<string> {
  const message = buildAlertPrefsMessage(input);
  const result = await signMessage(message, { address: input.owner });
  if (result.error) {
    throw new Error(result.error.message);
  }
  return signatureToString(result.signedMessage);
}

export function maskAddress(address: string, chars = 6): string {
  if (address.length <= chars * 2) {
    return address;
  }
  return `${address.slice(0, chars)}…${address.slice(-chars)}`;
}

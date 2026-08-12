/**
 * WhatsApp provider factory.
 * Choose implementation based on `WHATSAPP_PROVIDER` env var.
 * Singleton — only one instance is created per process.
 */
import { env } from "../env";
import type { WhatsAppProvider } from "./types";
import { BaileysProvider } from "./baileys";
import { MetaCloudProvider } from "./meta";

const globalForWA = globalThis as unknown as { __waProvider?: WhatsAppProvider };

export function getWhatsAppProvider(): WhatsAppProvider {
  if (globalForWA.__waProvider) return globalForWA.__waProvider;

  const provider: WhatsAppProvider =
    env.WHATSAPP_PROVIDER === "meta" ? new MetaCloudProvider() : new BaileysProvider();

  globalForWA.__waProvider = provider;
  // eslint-disable-next-line no-console
  console.log(`[whatsapp] provider = ${env.WHATSAPP_PROVIDER}`);
  return provider;
}

export type { WhatsAppProvider, SendResult, ConnectionStatus, SendTextInput, SendTemplateInput } from "./types";

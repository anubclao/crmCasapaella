/**
 * WhatsApp provider abstraction.
 *
 * The CRM talks to one interface (this file). The implementation is chosen
 * via the `WHATSAPP_PROVIDER` env var:
 *   - "baileys" → src/lib/whatsapp/baileys.ts (dev/MVP, free, QR scan)
 *   - "meta"    → src/lib/whatsapp/meta.ts    (prod, paid, official)
 *
 * Swapping is just a config change. The rest of the app is unaware.
 */

export type SendTextInput = {
  to: string; // E.164 phone, e.g. "+573138818822"
  body: string;
};

export type SendTemplateInput = {
  to: string;
  templateName: string; // must be pre-approved by Meta
  languageCode?: string; // default "es"
  variables?: string[]; // for {{1}}, {{2}}, etc.
};

export type SendResult =
  | { ok: true; providerMessageId: string; status: "sent" | "delivered" | "queued" }
  | { ok: false; error: string };

export type ConnectionStatus =
  | { provider: "baileys"; connected: boolean; qrCode: string | null; phoneNumber: string | null }
  | { provider: "meta"; connected: boolean; phoneNumberId: string | null };

export interface WhatsAppProvider {
  /** Idempotent — safe to call multiple times. */
  init(): Promise<void>;

  sendText(input: SendTextInput): Promise<SendResult>;
  sendTemplate(input: SendTemplateInput): Promise<SendResult>;

  getStatus(): Promise<ConnectionStatus>;

  /** Disconnect / logout. No-op for Meta (token revocation is separate). */
  disconnect(): Promise<void>;
}

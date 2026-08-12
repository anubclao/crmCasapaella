/**
 * Meta Cloud API WhatsApp provider — for production.
 *
 * Apply at developers.facebook.com:
 *   1. Create a Meta Business Account.
 *   2. Add the WhatsApp product.
 *   3. Verify a phone number (or port the existing one in).
 *   4. Create message templates in the WhatsApp Manager (these need Meta
 *      approval — usually 24-48h, sometimes longer for marketing templates).
 *   5. Generate a permanent System User Access Token.
 *   6. Paste the credentials into .env.production:
 *        META_WA_PHONE_NUMBER_ID=...
 *        META_WA_BUSINESS_ACCOUNT_ID=...
 *        META_WA_ACCESS_TOKEN=...
 *        META_WA_WEBHOOK_VERIFY_TOKEN=...
 *
 * Once approved, set WHATSAPP_PROVIDER=meta and restart. No code change.
 */
import { env } from "../env";
import type {
  WhatsAppProvider,
  SendTextInput,
  SendTemplateInput,
  SendResult,
  ConnectionStatus,
} from "./types";

const META_API_BASE = "https://graph.facebook.com/v21.0";

export class MetaCloudProvider implements WhatsAppProvider {
  async init(): Promise<void> {
    if (!env.META_WA_PHONE_NUMBER_ID || !env.META_WA_ACCESS_TOKEN) {
      throw new Error(
        "Meta Cloud provider selected but META_WA_PHONE_NUMBER_ID / META_WA_ACCESS_TOKEN are missing. Fill them in .env."
      );
    }
    // No persistent connection needed — Meta is HTTP.
  }

  async sendText({ to, body }: SendTextInput): Promise<SendResult> {
    if (!env.META_WA_ACCESS_TOKEN || !env.META_WA_PHONE_NUMBER_ID) {
      return { ok: false, error: "Meta credentials missing" };
    }
    try {
      const res = await fetch(
        `${META_API_BASE}/${env.META_WA_PHONE_NUMBER_ID}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.META_WA_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: to.replace(/\D/g, ""),
            type: "text",
            text: { body, preview_url: false },
          }),
        }
      );
      const data = (await res.json()) as { messages?: Array<{ id: string }>; error?: { message: string } };
      if (!res.ok || data.error) {
        return { ok: false, error: data.error?.message ?? `HTTP ${res.status}` };
      }
      return {
        ok: true,
        providerMessageId: data.messages?.[0]?.id ?? `meta-${Date.now()}`,
        status: "sent",
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async sendTemplate({
    to,
    templateName,
    languageCode = "es",
    variables = [],
  }: SendTemplateInput): Promise<SendResult> {
    if (!env.META_WA_ACCESS_TOKEN || !env.META_WA_PHONE_NUMBER_ID) {
      return { ok: false, error: "Meta credentials missing" };
    }
    try {
      const components =
        variables.length > 0
          ? [
              {
                type: "body",
                parameters: variables.map((v) => ({ type: "text", text: v })),
              },
            ]
          : [];
      const res = await fetch(
        `${META_API_BASE}/${env.META_WA_PHONE_NUMBER_ID}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.META_WA_ACCESS_TOKEN}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: to.replace(/\D/g, ""),
            type: "template",
            template: {
              name: templateName,
              language: { code: languageCode },
              components,
            },
          }),
        }
      );
      const data = (await res.json()) as { messages?: Array<{ id: string }>; error?: { message: string } };
      if (!res.ok || data.error) {
        return { ok: false, error: data.error?.message ?? `HTTP ${res.status}` };
      }
      return {
        ok: true,
        providerMessageId: data.messages?.[0]?.id ?? `meta-${Date.now()}`,
        status: "sent",
      };
    } catch (err) {
      return { ok: false, error: err instanceof Error ? err.message : String(err) };
    }
  }

  async getStatus(): Promise<ConnectionStatus> {
    return {
      provider: "meta",
      connected: !!env.META_WA_ACCESS_TOKEN && !!env.META_WA_PHONE_NUMBER_ID,
      phoneNumberId: env.META_WA_PHONE_NUMBER_ID ?? null,
    };
  }

  async disconnect(): Promise<void> {
    // Meta is stateless for our purposes. To revoke, rotate the access token
    // in the Meta dashboard.
  }
}

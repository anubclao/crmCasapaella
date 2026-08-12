/**
 * Meta Cloud API WhatsApp provider — for production.
 *
 * Apply at developers.facebook.com:
 *   1. Create a Meta Business Account.
 *   2. Add the WhatsApp product.
 *   3. Verify a phone number (or port the existing one in).
 *   4. Create message templates in the WhatsApp Manager (these need Meta
 *      approval — usually 24-48h, sometimes longer for marketing templates).
 *      The list of approved templates and their variables lives in
 *      `meta-config.ts` — keep them in sync.
 *   5. Generate a permanent System User Access Token.
 *   6. Paste the credentials into .env.production:
 *        META_WA_PHONE_NUMBER_ID=...
 *        META_WA_BUSINESS_ACCOUNT_ID=...
 *        META_WA_ACCESS_TOKEN=...
 *        META_WA_WEBHOOK_VERIFY_TOKEN=...
 *
 * Once approved, set WHATSAPP_PROVIDER=meta and restart. No code change.
 *
 * Template names, variables, and the `body` are centralized in `meta-config.ts`
 * so the WhatsApp page and the campaign worker read the same source of truth.
 */
import { env } from "../env";
import type {
  WhatsAppProvider,
  SendTextInput,
  SendTemplateInput,
  SendResult,
  ConnectionStatus,
} from "./types";
import {
  checkMetaReadiness,
  renderTemplateParams,
  getTemplate,
} from "./meta-config";

const META_API_BASE = "https://graph.facebook.com/v21.0";

export class MetaCloudProvider implements WhatsAppProvider {
  async init(): Promise<void> {
    if (!env.META_WA_PHONE_NUMBER_ID || !env.META_WA_ACCESS_TOKEN) {
      throw new Error(
        "Meta Cloud provider selected but META_WA_PHONE_NUMBER_ID / META_WA_ACCESS_TOKEN are missing. " +
          "Check the readiness panel in /whatsapp for details.",
      );
    }
    // No persistent connection needed — Meta is HTTP.
  }

  /**
   * Send a free-form text message. Use ONLY for utility messages to
   * customers who messaged you in the last 24h (Meta's "customer service
   * window"). For anything else, use a pre-approved template.
   *
   * Free-form messages outside the 24h window will be REJECTED by Meta
   * (error code 131049).
   */
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
        },
      );
      const data = (await res.json()) as {
        messages?: Array<{ id: string }>;
        error?: { message: string; code?: number };
      };
      if (!res.ok || data.error) {
        return {
          ok: false,
          error: data.error?.message ?? `HTTP ${res.status}`,
          ...(data.error?.code ? { metaErrorCode: data.error.code } : {}),
        };
      }
      return {
        ok: true,
        providerMessageId: data.messages?.[0]?.id ?? `meta-${Date.now()}`,
        status: "sent",
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Send a pre-approved template message. This is the only safe way to do
   * outbound messaging with Meta (utility, marketing, authentication).
   *
   * Variables are passed as a `string[]` in the order declared in
   * `META_TEMPLATES[name].variables`. The mapping from semantic placeholders
   * (`{{nombre}}`, `{{date}}`, ...) to positional `{{1}}`, `{{2}}` is done
   * by `renderTemplateParams`.
   */
  async sendTemplate({
    to,
    templateName,
    languageCode,
    variables,
  }: SendTemplateInput): Promise<SendResult> {
    if (!env.META_WA_ACCESS_TOKEN || !env.META_WA_PHONE_NUMBER_ID) {
      return { ok: false, error: "Meta credentials missing" };
    }

    const template = getTemplate(templateName);
    if (!template) {
      return {
        ok: false,
        error:
          `Template '${templateName}' not registered in META_TEMPLATES. ` +
          `Add it to src/lib/whatsapp/meta-config.ts and to Meta's WhatsApp Manager.`,
      };
    }

    // If caller already provided a positional array (length matches), use as-is.
    // Otherwise render an empty positional array (caller should have provided values).
    const positional =
      variables && variables.length > 0
        ? variables
        : renderTemplateParams(templateName, {});

    const empties = positional.filter((v) => v === "");
    if (empties.length > 0) {
      return {
        ok: false,
        error: `Template '${templateName}' has empty values. Caller must provide all required variables.`,
      };
    }

    const lang = languageCode ?? template.language;

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
            type: "template",
            template: {
              name: templateName,
              language: { code: lang },
              components: [
                {
                  type: "body",
                  parameters: positional.map((text) => ({
                    type: "text",
                    text,
                  })),
                },
              ],
            },
          }),
        },
      );
      const data = (await res.json()) as {
        messages?: Array<{ id: string }>;
        error?: { message: string; code?: number };
      };
      if (!res.ok || data.error) {
        return {
          ok: false,
          error: data.error?.message ?? `HTTP ${res.status}`,
          ...(data.error?.code ? { metaErrorCode: data.error.code } : {}),
        };
      }
      return {
        ok: true,
        providerMessageId: data.messages?.[0]?.id ?? `meta-${Date.now()}`,
        status: "sent",
      };
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  /**
   * Returns the current readiness state of the Meta integration.
   * The UI uses this to show "what's missing" to the operator.
   */
  async getStatus(): Promise<ConnectionStatus> {
    if (env.WHATSAPP_PROVIDER !== "meta") {
      return {
        provider: "meta",
        connected: false,
        phoneNumberId: env.META_WA_PHONE_NUMBER_ID ?? null,
      };
    }
    const readiness = checkMetaReadiness();
    return {
      provider: "meta",
      connected: readiness.ok,
      phoneNumberId: env.META_WA_PHONE_NUMBER_ID ?? null,
    };
  }

  async disconnect(): Promise<void> {
    // Meta is stateless for our purposes. To revoke, rotate the access token
    // in the Meta dashboard.
  }
}

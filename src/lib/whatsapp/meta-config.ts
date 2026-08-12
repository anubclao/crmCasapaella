/**
 * Meta Cloud API — configuration module.
 *
 * Centralizes:
 *   - All Meta-specific env vars and their validation
 *   - The list of approved message templates (must match Meta's dashboard)
 *   - Per-template variable definitions (for sending positional params to Meta)
 *   - Helper to render a template's `body` (using `{{nombre}}` placeholders) into
 *     a positional `string[]` that Meta's `template.components[].parameters` expects.
 *   - A readiness check used by the UI to show "what's missing" to the operator.
 *
 * Why a dedicated module:
 *   - The `body` stored in `message_templates.body` uses semantic placeholders
 *     like `{{nombre}}` so operators can edit them in the UI.
 *   - Meta's Cloud API requires positional `{{1}}`, `{{2}}`... placeholders.
 *   - At send time we map the semantic body to a positional parameter array
 *     using the variable order declared here.
 *   - This is the single source of truth — `meta.ts` and the WhatsApp page
 *     both import from here.
 */
import { env } from "../env";

/* ── Types ──────────────────────────────────────────────────────────── */

export type MetaTemplateCategory = "marketing" | "utility" | "authentication";

export type MetaTemplateVariable = {
  /** Position in Meta's {{1}}, {{2}}... (1-indexed). */
  position: number;
  /** Semantic name used in the body stored in our DB. e.g. "nombre". */
  semantic: string;
  /** Human description for the operator UI. */
  description: string;
  /** Example value, used in the UI to show what to put in the variable. */
  example: string;
};

export type MetaTemplate = {
  /** Must match exactly the name in Meta's WhatsApp Manager. */
  name: string;
  /** Category for approval. Marketing templates take longer (24-48h+). */
  category: MetaTemplateCategory;
  /** ISO language code, e.g. "es", "en", "es_CO". */
  language: string;
  /** Variables in the order Meta expects them. */
  variables: MetaTemplateVariable[];
  /**
   * The body we store in our DB. Uses semantic placeholders like `{{nombre}}`.
   * If you change this, update the template in Meta's dashboard too.
   * Operators edit this in `/templates` and it should match what Meta renders.
   */
  body: string;
  /** Free-form notes for the operator. */
  notes?: string;
};

export type MetaReadiness = {
  ok: boolean;
  missing: Array<{
    key: string;
    label: string;
    help: string;
  }>;
};

/* ── Templates (single source of truth) ────────────────────────────── */

export const META_TEMPLATES: Record<string, MetaTemplate> = {
  casapaella_reserva_confirmada: {
    name: "casapaella_reserva_confirmada",
    category: "utility",
    language: "es",
    body: "¡Hola {{nombre}}! 🍤 Tu reserva en {{restaurant}} para el {{date}} a las {{time}} para {{guests}} personas está confirmada. ¡Te esperamos! Cualquier cambio responde a este mensaje.",
    variables: [
      {
        position: 1,
        semantic: "nombre",
        description: "Nombre del cliente",
        example: "Carlos",
      },
      {
        position: 2,
        semantic: "restaurant",
        description: "Nombre del restaurante",
        example: "Casa Paella",
      },
      {
        position: 3,
        semantic: "date",
        description: "Fecha de la reserva",
        example: "15 de agosto",
      },
      {
        position: 4,
        semantic: "time",
        description: "Hora de la reserva",
        example: "20:00",
      },
      {
        position: 5,
        semantic: "guests",
        description: "Cantidad de personas",
        example: "4",
      },
    ],
    notes:
      "Categoría utility: NO requiere opt-in. Se puede enviar a cualquier cliente con reserva.",
  },

  casapaella_pedido_recibido: {
    name: "casapaella_pedido_recibido",
    category: "utility",
    language: "es",
    body: "¡Hola {{nombre}}! 👨‍🍫 Recibimos tu pedido en {{restaurant}}. Total: ${{total}} COP. Ya está en preparación y te avisaremos cuando esté listo. {{address}}",
    variables: [
      {
        position: 1,
        semantic: "nombre",
        description: "Nombre del cliente",
        example: "Carlos",
      },
      {
        position: 2,
        semantic: "restaurant",
        description: "Nombre del restaurante",
        example: "Casa Paella",
      },
      {
        position: 3,
        semantic: "total",
        description: "Total en COP sin puntos",
        example: "85000",
      },
      {
        position: 4,
        semantic: "address",
        description: "Dirección de entrega",
        example: "Calle 100 #15-20",
      },
    ],
    notes: "utility: confirmación de pedido. NO requiere opt-in.",
  },

  casapaella_promocion_generica: {
    name: "casapaella_promocion_generica",
    category: "marketing",
    language: "es",
    body: "¡Hola {{nombre}}! {{restaurant}} te tiene una promo especial. {{body}}",
    variables: [
      {
        position: 1,
        semantic: "nombre",
        description: "Nombre del cliente",
        example: "Carlos",
      },
      {
        position: 2,
        semantic: "restaurant",
        description: "Nombre del restaurante",
        example: "Casa Paella",
      },
      {
        position: 3,
        semantic: "body",
        description: "Cuerpo de la promo",
        example: "2x1 en paellas los viernes",
      },
    ],
    notes:
      "Categoría MARKETING: solo se puede enviar a clientes que hayan dado opt-in (conversación reciente o respuesta activa). Meta bloquea si se abusa.",
  },
};

/* ── Render semantic body → positional params ──────────────────────── */

/**
 * Extract the variables from a semantic body and return them in the order
 * defined in the template's `variables` config (position 1..N).
 *
 * Returns an array of strings ready to send as `template.components[].parameters`.
 * Missing variables become empty string — caller should validate before.
 */
export function renderTemplateParams(
  templateName: string,
  values: Record<string, string | number | undefined | null>,
): string[] {
  const template = META_TEMPLATES[templateName];
  if (!template) {
    throw new Error(
      `Template '${templateName}' not registered in META_TEMPLATES. ` +
        `Add it to src/lib/whatsapp/meta-config.ts and to Meta's WhatsApp Manager.`,
    );
  }

  return template.variables
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((v) => {
      const raw = values[v.semantic];
      if (raw === undefined || raw === null) return "";
      return String(raw);
    });
}

/**
 * Replace semantic placeholders in a body with concrete values. Used to show
 * a preview of how a template will look before sending (e.g. in the campaign
 * editor).
 */
export function previewTemplate(
  body: string,
  values: Record<string, string | number | undefined | null>,
): string {
  return body.replace(/\{\{(\w+)\}\}/g, (_, k) => {
    const v = values[k];
    return v === undefined || v === null ? `{{${k}}}` : String(v);
  });
}

/* ── Readiness check (drives the UI's "what's missing" panel) ──────── */

export function checkMetaReadiness(): MetaReadiness {
  const missing: MetaReadiness["missing"] = [];

  if (!env.META_WA_PHONE_NUMBER_ID) {
    missing.push({
      key: "META_WA_PHONE_NUMBER_ID",
      label: "Phone Number ID",
      help:
        "En developers.facebook.com → tu app → WhatsApp → API Setup. " +
        "Copiá el 'Phone number ID' (no es el número en sí, es un ID numérico).",
    });
  }

  if (!env.META_WA_BUSINESS_ACCOUNT_ID) {
    missing.push({
      key: "META_WA_BUSINESS_ACCOUNT_ID",
      label: "WhatsApp Business Account ID",
      help:
        "En developers.facebook.com → tu app → WhatsApp → API Setup. " +
        "También lo encontrás en business.facebook.com → Settings → Accounts → WhatsApp Accounts.",
    });
  }

  if (!env.META_WA_ACCESS_TOKEN) {
    missing.push({
      key: "META_WA_ACCESS_TOKEN",
      label: "Access Token (permanente)",
      help:
        "Generá un System User permanente en business.facebook.com → Settings → System Users → " +
        "Add → Admin → Generate Token. Scope: whatsapp_business_management, " +
        "whatsapp_business_messaging. NO uses tokens temporales de 24h.",
    });
  }

  if (!env.META_WA_WEBHOOK_VERIFY_TOKEN) {
    missing.push({
      key: "META_WA_WEBHOOK_VERIFY_TOKEN",
      label: "Webhook Verify Token",
      help:
        "Inventá una cadena random (ej: 'crm-casapaella-2026'). " +
        "La usás en developers.facebook.com → Webhook → Verify Token Y acá.",
    });
  }

  return { ok: missing.length === 0, missing };
}

/* ── Per-template helpers ──────────────────────────────────────────── */

export function getTemplate(name: string): MetaTemplate | null {
  return META_TEMPLATES[name] ?? null;
}

export function listTemplates(): MetaTemplate[] {
  return Object.values(META_TEMPLATES);
}

export function getMarketingTemplates(): MetaTemplate[] {
  return listTemplates().filter((t) => t.category === "marketing");
}

export function getTransactionalTemplates(): MetaTemplate[] {
  return listTemplates().filter((t) => t.category !== "marketing");
}

/* ── Rate limits (defensive constants for the campaign worker) ─────── */

/**
 * Meta's per-number rate limits (Cloud API, current as of 2026):
 *   - utility: 1000 msg/sec, but recommended 80 msg/sec to be safe
 *   - marketing: 80 msg/sec, but Meta throttles to 1 msg/sec for new numbers
 *     and ramps up over ~7 days based on quality rating.
 *
 * We use the conservative numbers to avoid the quality-rating drop.
 */
export const META_RATE_LIMITS = {
  /** Recommended for utility/auth templates. */
  utility: { msgsPerSecond: 10, minIntervalMs: 100 },
  /** Recommended for marketing templates. */
  marketing: { msgsPerSecond: 1, minIntervalMs: 1000 },
} as const;

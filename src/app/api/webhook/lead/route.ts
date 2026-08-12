/**
 * POST /api/webhook/lead
 *
 * Endpoint único para que el sitio de Casa Paella (formularios de reserva
 * y pedido a domicilio) inserte o actualice clientes y dispare el WhatsApp
 * de bienvenida/confirmación.
 *
 * Auth: NONE en el MVP (el sitio de marketing se autentica por IP / dominio
 * configurado en el hPanel). Para producción, agregar un header
 * `X-Webhook-Secret` y compararlo con LEAD_WEBHOOK_SECRET en .env.
 *
 * Payload:
 * {
 *   "name": "Juan Pérez",
 *   "phone": "+57 313 881 8822" | "3138818822",
 *   "email": "juan@example.com",          // opcional
 *   "source": "web_reservation" | "web_order",
 *
 *   // Solo si source=web_reservation:
 *   "reservationDate": "2026-08-15T19:30:00-05:00",
 *   "guests": 4,
 *   "notes": "Mesa cerca de la ventana",
 *
 *   // Solo si source=web_order:
 *   "items": [{ "name": "Paella Valenciana", "qty": 1, "price": 42000 }],
 *   "totalAmount": 42000,
 *   "orderType": "delivery" | "pickup",
 *   "deliveryAddress": "Calle 100 #15-20"
 * }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { query, withTransaction } from "@/lib/db";
import { normalizePhone } from "@/lib/phone";
import { getWhatsAppProvider } from "@/lib/whatsapp";
import { env } from "@/lib/env";
import { getTemplate, renderTemplateBody } from "@/server/templates";
import { recalculateTagsForCustomer } from "@/server/auto-tagging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const leadSchema = z.discriminatedUnion("source", [
  z.object({
    name: z.string().min(1).max(255),
    phone: z.string().min(7).max(30),
    email: z.string().email().optional(),
    source: z.literal("web_reservation"),
    reservationDate: z.string().datetime({ offset: true }),
    guests: z.number().int().min(1).max(50).default(2),
    notes: z.string().max(1000).optional(),
  }),
  z.object({
    name: z.string().min(1).max(255),
    phone: z.string().min(7).max(30),
    email: z.string().email().optional(),
    source: z.literal("web_order"),
    orderType: z.enum(["delivery", "pickup"]).default("delivery"),
    items: z
      .array(z.object({ name: z.string(), qty: z.number().int().min(1), price: z.number().min(0) }))
      .min(1),
    totalAmount: z.number().min(0),
    deliveryAddress: z.string().optional(),
    notes: z.string().max(1000).optional(),
  }),
]);

type LeadInput = z.infer<typeof leadSchema>;

function renderTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] ?? "");
}

const TEMPLATE_FALLBACKS = {
  reservation:
    "¡Hola {{nombre}}! 🍤 Tu reserva en {{restaurant}} para el {{date}} a las {{time}} para {{guests}} personas está confirmada. ¡Te esperamos! Cualquier cambio, responde a este mensaje.",
  order:
    "¡Hola {{nombre}}! 👨‍🍳 Recibimos tu pedido en {{restaurant}}. Total: ${{total}} COP. Ya está en preparación y te avisaremos cuando esté listo. {{address}}",
};

export async function POST(req: NextRequest) {
  // (Optional) simple shared-secret check
  const secret = req.headers.get("x-webhook-secret");
  if (process.env.LEAD_WEBHOOK_SECRET && secret !== process.env.LEAD_WEBHOOK_SECRET) {
    return NextResponse.json({ ok: false, error: "invalid secret" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid JSON" }, { status: 400 });
  }
  const parsed = leadSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "validation", issues: parsed.error.issues },
      { status: 400 }
    );
  }
  const lead = parsed.data;

  // 1) Normalize phone
  const phone = normalizePhone(lead.phone);
  if (!phone.valid) {
    return NextResponse.json(
      { ok: false, error: `invalid phone: ${lead.phone}` },
      { status: 400 }
    );
  }

  // 2) UPSERT customer + insert reservation/order, all in one transaction
  const result = await withTransaction(async (conn) => {
    // Find or create the customer.
    const [existing] = (await conn.execute(
      "SELECT id, name, email, total_reservations, total_orders, total_spent FROM customers WHERE phone = ? LIMIT 1",
      [phone.e164]
    )) as [Array<{ id: number; name: string; email: string | null; total_reservations: number; total_orders: number; total_spent: string }>, unknown];

    let customerId: number;
    let isNew = false;
    if (existing && existing.length > 0) {
      customerId = existing[0].id;
      await conn.execute(
        "UPDATE customers SET name = COALESCE(NULLIF(?, ''), name), email = COALESCE(NULLIF(?, ''), email), last_activity_at = NOW() WHERE id = ?",
        [lead.name, lead.email ?? "", customerId]
      );
    } else {
      const [insertResult] = await conn.execute(
        "INSERT INTO customers (name, phone, email, source, last_activity_at) VALUES (?, ?, ?, ?, NOW())",
        [lead.name, phone.e164, lead.email ?? null, lead.source]
      );
      customerId = (insertResult as { insertId: number }).insertId;
      isNew = true;
    }

    // 3) Source-specific record + counters
    if (lead.source === "web_reservation") {
      await conn.execute(
        "INSERT INTO reservations (customer_id, reservation_date, guests, status, notes) VALUES (?, ?, ?, 'pending', ?)",
        [customerId, new Date(lead.reservationDate), lead.guests, lead.notes ?? null]
      );
      await conn.execute(
        "UPDATE customers SET total_reservations = total_reservations + 1, last_activity_at = NOW() WHERE id = ?",
        [customerId]
      );
    } else {
      await conn.execute(
        "INSERT INTO orders (customer_id, order_type, total_amount, status, items, delivery_address, notes) VALUES (?, ?, ?, 'pending', CAST(? AS JSON), ?, ?)",
        [
          customerId,
          lead.orderType,
          lead.totalAmount.toFixed(2),
          JSON.stringify(lead.items),
          lead.deliveryAddress ?? null,
          lead.notes ?? null,
        ]
      );
      await conn.execute(
        "UPDATE customers SET total_orders = total_orders + 1, total_spent = total_spent + ?, last_activity_at = NOW() WHERE id = ?",
        [lead.totalAmount.toFixed(2), customerId]
      );
    }

    // 4) Build the WhatsApp message body
    //    Look up the template from DB. Fall back to a hardcoded string
    //    if not found (e.g. seed not yet run).
    let body: string;
    const firstName = lead.name.split(" ")[0];
    if (lead.source === "web_reservation") {
      const dt = new Date(lead.reservationDate);
      const vars: Record<string, string> = {
        nombre: firstName,
        restaurant: env.RESTAURANT_NAME,
        date: new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: env.RESTAURANT_TIMEZONE }).format(dt),
        time: new Intl.DateTimeFormat("es-CO", { timeStyle: "short", timeZone: env.RESTAURANT_TIMEZONE }).format(dt),
        guests: String(lead.guests),
      };
      const tpl = await getTemplate("casapaella_reserva_confirmada");
      body = tpl ? renderTemplateBody(tpl.body, vars) : renderTemplate(TEMPLATE_FALLBACKS.reservation, vars);
    } else {
      const vars: Record<string, string> = {
        nombre: firstName,
        restaurant: env.RESTAURANT_NAME,
        total: new Intl.NumberFormat("es-CO").format(lead.totalAmount),
        address: lead.deliveryAddress ? `📍 ${lead.deliveryAddress}` : "Recoger en local.",
      };
      const tpl = await getTemplate("casapaella_pedido_recibido");
      body = tpl ? renderTemplateBody(tpl.body, vars) : renderTemplate(TEMPLATE_FALLBACKS.order, vars);
    }

    return { customerId, isNew, body };
  });

  // 5) Log the message (queued)
  const messageInsert = (await query(
    "INSERT INTO messages (customer_id, direction, channel, body, status) VALUES (?, 'outbound', 'whatsapp', ?, 'queued')",
    [result.customerId, result.body]
  )) as { insertId: number };
  const messageId = messageInsert.insertId;

  // 6) Send via WhatsApp provider (fire-and-log; webhook must stay fast)
  const wa = getWhatsAppProvider();
  const sendResult = await wa.sendText({ to: phone.e164, body: result.body });

  if (sendResult.ok) {
    await query(
      "UPDATE messages SET status = 'sent', provider_message_id = ?, sent_at = NOW() WHERE id = ?",
      [sendResult.providerMessageId, messageId]
    );
  } else {
    await query(
      "UPDATE messages SET status = 'failed', error = ? WHERE id = ?",
      [sendResult.error, messageId]
    );
    // Don't fail the webhook — the lead is captured. Operator can retry.
    console.error(`[webhook/lead] WhatsApp send failed: ${sendResult.error}`);
  }

  // 7) Recalculate auto-tags for this customer (fire and forget, errors logged only)
  recalculateTagsForCustomer(result.customerId).catch((e) => {
    console.error(`[webhook/lead] auto-tag failed for customer ${result.customerId}:`, e);
  });

  return NextResponse.json(
    {
      ok: true,
      customerId: result.customerId,
      isNewCustomer: result.isNew,
      messageId,
      whatsapp: sendResult.ok ? "sent" : `failed: ${sendResult.error}`,
    },
    { status: 200 }
  );
}

// Health check
export async function GET() {
  return NextResponse.json({ ok: true, endpoint: "webhook/lead" });
}

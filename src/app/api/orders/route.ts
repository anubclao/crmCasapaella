/**
 * POST /api/orders
 * Manual order creation by staff (phone orders, walk-ins).
 * Body: { customerId, orderType, items[], totalAmount, deliveryAddress?, notes? }
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { getWhatsAppProvider } from "@/lib/whatsapp";
import { env } from "@/lib/env";
import { getTemplate, renderTemplateBody } from "@/server/templates";
import { recalculateTagsForCustomer } from "@/server/auto-tagging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  customerId: z.number().int().positive(),
  orderType: z.enum(["delivery", "pickup", "dine_in"]).default("delivery"),
  items: z
    .array(z.object({ name: z.string().min(1), qty: z.number().int().min(1), price: z.number().min(0) }))
    .min(1),
  totalAmount: z.number().min(0),
  deliveryAddress: z.string().optional(),
  notes: z.string().max(1000).optional(),
  sendWhatsapp: z.boolean().default(true),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  const raw = await req.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }
  const { customerId, orderType, items, totalAmount, deliveryAddress, notes, sendWhatsapp } = parsed.data;

  const customer = await withTransaction(async (conn) => {
    const [c] = (await conn.execute(
      "SELECT id, name, phone FROM customers WHERE id = ? LIMIT 1",
      [customerId]
    )) as [Array<{ id: number; name: string; phone: string }>, unknown];
    if (!c || c.length === 0) throw new Error("Cliente no encontrado");

    await conn.execute(
      "INSERT INTO orders (customer_id, order_type, total_amount, status, items, delivery_address, notes) VALUES (?, ?, ?, 'confirmed', CAST(? AS JSON), ?, ?)",
      [customerId, orderType, totalAmount.toFixed(2), JSON.stringify(items), deliveryAddress ?? null, notes ?? null]
    );
    await conn.execute(
      "UPDATE customers SET total_orders = total_orders + 1, total_spent = total_spent + ?, last_activity_at = NOW() WHERE id = ?",
      [totalAmount.toFixed(2), customerId]
    );
    return c[0];
  });

  if (sendWhatsapp) {
    const vars: Record<string, string> = {
      nombre: customer.name.split(" ")[0],
      restaurant: env.RESTAURANT_NAME,
      total: new Intl.NumberFormat("es-CO").format(totalAmount),
      address: deliveryAddress ? `📍 ${deliveryAddress}` : "Recoger en local.",
    };
    const tpl = await getTemplate("casapaella_pedido_recibido");
    const body = tpl ? renderTemplateBody(tpl.body, vars) :
      `¡Hola ${vars.nombre}! 👨‍🍳 Recibimos tu pedido en ${env.RESTAURANT_NAME}. Total: $${vars.total} COP. ${vars.address}`;

    const insert = (await query(
      "INSERT INTO messages (customer_id, direction, channel, body, status) VALUES (?, 'outbound', 'whatsapp', ?, 'queued')",
      [customerId, body]
    )) as { insertId: number };
    const result = await getWhatsAppProvider().sendText({ to: customer.phone, body });
    if (result.ok) {
      await query("UPDATE messages SET status='sent', provider_message_id=?, sent_at=NOW() WHERE id=?", [
        result.providerMessageId,
        insert.insertId,
      ]);
    } else {
      await query("UPDATE messages SET status='failed', error=? WHERE id=?", [result.error, insert.insertId]);
    }
  }

  recalculateTagsForCustomer(customerId).catch((e) => {
    console.error(`[api/orders] auto-tag failed for ${customerId}:`, e);
  });

  return NextResponse.json({ ok: true });
}

/**
 * POST /api/reservations
 * Manual reservation creation by staff (not via the web webhook).
 * Body: { customerId, reservationDate, guests, notes? }
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
  reservationDate: z.string().datetime(),
  guests: z.number().int().min(1).max(50).default(2),
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
    return NextResponse.json({ ok: false, error: "validation", issues: parsed.error.issues }, { status: 400 });
  }
  const { customerId, reservationDate, guests, notes, sendWhatsapp } = parsed.data;

  // Create the reservation + bump the counter atomically.
  const customer = await withTransaction(async (conn) => {
    const [c] = (await conn.execute(
      "SELECT id, name, phone FROM customers WHERE id = ? LIMIT 1",
      [customerId]
    )) as [Array<{ id: number; name: string; phone: string }>, unknown];

    if (!c || c.length === 0) throw new Error("Cliente no encontrado");

    await conn.execute(
      "INSERT INTO reservations (customer_id, reservation_date, guests, status, notes) VALUES (?, ?, 'confirmed', ?, ?)",
      [customerId, new Date(reservationDate), guests, notes ?? null]
    );
    await conn.execute(
      "UPDATE customers SET total_reservations = total_reservations + 1, last_activity_at = NOW() WHERE id = ?",
      [customerId]
    );
    return c[0];
  });

  if (sendWhatsapp) {
    const dt = new Date(reservationDate);
    const vars: Record<string, string> = {
      nombre: customer.name.split(" ")[0],
      restaurant: env.RESTAURANT_NAME,
      date: new Intl.DateTimeFormat("es-CO", { dateStyle: "long", timeZone: env.RESTAURANT_TIMEZONE }).format(dt),
      time: new Intl.DateTimeFormat("es-CO", { timeStyle: "short", timeZone: env.RESTAURANT_TIMEZONE }).format(dt),
      guests: String(guests),
    };
    const tpl = await getTemplate("casapaella_reserva_confirmada");
    const body = tpl ? renderTemplateBody(tpl.body, vars) :
      `¡Hola ${vars.nombre}! 🍤 Confirmamos tu reserva en ${env.RESTAURANT_NAME} para el ${vars.date} a las ${vars.time} para ${guests} personas. ¡Te esperamos!`;

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
    console.error(`[api/reservations] auto-tag failed for ${customerId}:`, e);
  });

  return NextResponse.json({ ok: true });
}

/**
 * GET /api/campaigns/[id]/export
 * Streams campaign recipients (one row per message attempt) as CSV.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import { toCSV } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const cid = Number(id);
  if (!Number.isFinite(cid)) {
    return NextResponse.json({ ok: false, error: "invalid id" }, { status: 400 });
  }

  const rows = await query<Array<{
    customer_name: string;
    customer_phone: string;
    body: string;
    status: string;
    error: string | null;
    sent_at: string | null;
    delivered_at: string | null;
  }>>(
    `SELECT c.name AS customer_name, c.phone AS customer_phone,
            m.body, m.status, m.error, m.sent_at, m.delivered_at
     FROM messages m
     LEFT JOIN customers c ON c.id = m.customer_id
     WHERE m.campaign_id = ?
     ORDER BY m.id ASC`,
    [cid]
  );

  const csv = toCSV(
    rows.map((r) => ({
      Cliente: r.customer_name ?? "",
      Teléfono: r.customer_phone ?? "",
      Mensaje: r.body,
      Estado: r.status,
      "Enviado": r.sent_at ?? "",
      "Entregado": r.delivered_at ?? "",
      Error: r.error ?? "",
    }))
  );

  return new NextResponse("\uFEFF" + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="campana-${cid}.csv"`,
    },
  });
}

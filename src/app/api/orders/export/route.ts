/**
 * GET /api/orders/export.csv
 * Streams all orders as CSV.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import { toCSV } from "@/lib/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const rows = await query<Array<{
    id: number; created_at: string; customer_name: string; customer_phone: string;
    order_type: string; total_amount: string; status: string; delivery_address: string | null;
  }>>(
    `SELECT o.id, o.created_at, c.name AS customer_name, c.phone AS customer_phone,
            o.order_type, o.total_amount, o.status, o.delivery_address
     FROM orders o INNER JOIN customers c ON c.id = o.customer_id
     ORDER BY o.created_at DESC`
  );

  const csv = toCSV(
    rows.map((r) => ({
      ID: r.id,
      Fecha: r.created_at,
      Cliente: r.customer_name,
      Teléfono: r.customer_phone,
      Tipo: r.order_type,
      "Total (COP)": r.total_amount,
      Estado: r.status,
      Dirección: r.delivery_address ?? "",
    }))
  );

  return new NextResponse("\uFEFF" + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="pedidos-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

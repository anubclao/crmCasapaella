/**
 * GET /api/customers/export.csv
 * Streams all customers as CSV.
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
    id: number;
    name: string;
    phone: string;
    email: string | null;
    source: string;
    total_reservations: number;
    total_orders: number;
    total_spent: string;
    last_activity_at: string | null;
    created_at: string;
  }>>(
    "SELECT id, name, phone, email, source, total_reservations, total_orders, total_spent, last_activity_at, created_at FROM customers ORDER BY id ASC"
  );

  const csv = toCSV(
    rows.map((r) => ({
      ID: r.id,
      Nombre: r.name,
      Teléfono: r.phone,
      Email: r.email ?? "",
      Origen: r.source,
      Reservas: r.total_reservations,
      Pedidos: r.total_orders,
      "Total gastado (COP)": r.total_spent,
      "Última actividad": r.last_activity_at ?? "",
      "Creado": r.created_at,
    }))
  );

  // BOM for Excel compatibility with UTF-8
  return new NextResponse("\uFEFF" + csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clientes-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

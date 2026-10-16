/**
 * GET /api/customers/export.csv
 * Streams all customers as CSV.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";
import { toCSV } from "@/lib/csv";
import { stageInfo } from "@/lib/pipeline";
import { birthDateISO, type CustomerRow } from "@/server/customers";
import { ensureCustomerColumns } from "@/server/customer-schema";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  await ensureCustomerColumns();
  const rows = await query<CustomerRow[]>("SELECT * FROM customers ORDER BY id ASC");

  // First columns match the bulk-import template, so this file can be edited
  // in Excel and uploaded back through "Cargue masivo".
  const legacy = (r: CustomerRow) => !r.first_name && !r.last_name;
  const csv = toCSV(
    rows.map((r) => ({
      ID: r.id,
      Nombres: legacy(r) ? r.name : r.first_name ?? "",
      Apellidos: r.last_name ?? "",
      WhatsApp: r.phone,
      Correo: r.email ?? "",
      "Fecha de nacimiento": birthDateISO(r.birth_date).split("-").reverse().join("/"),
      Estado: stageInfo(r.pipeline_stage).label,
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

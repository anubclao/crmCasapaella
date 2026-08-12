import { query } from "@/lib/db";
import Link from "next/link";

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));

const fmtCOP = (n: string | number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(n));

const statusColor: Record<string, string> = {
  pending: "bg-dorado-100 text-dorado-700",
  confirmed: "bg-blue-100 text-blue-700",
  preparing: "bg-orange-100 text-orange-700",
  ready: "bg-green-100 text-green-700",
  delivered: "bg-green-200 text-green-800",
  cancelled: "bg-granate-100 text-granate-700",
};

export default async function OrdersPage() {
  const rows = await query<Array<{
    id: number; order_type: string; total_amount: string; status: string;
    customer_name: string; customer_phone: string; created_at: string;
  }>>(
    `SELECT o.id, o.order_type, o.total_amount, o.status, o.created_at,
            c.name AS customer_name, c.phone AS customer_phone
     FROM orders o
     INNER JOIN customers c ON c.id = o.customer_id
     ORDER BY o.created_at DESC LIMIT 100`
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-granate-800">Pedidos</h1>
          <p className="text-sm text-granate-700/60">Últimos 100 pedidos</p>
        </div>
        <div className="flex gap-2">
          <a href="/api/orders/export" className="px-3 py-2 text-sm rounded-lg border border-granate-200 text-granate-700 hover:bg-crema-50">
            📥 Exportar CSV
          </a>
          <Link href="/orders/new" className="px-4 py-2 bg-granate-500 text-white rounded-lg text-sm hover:bg-granate-600 shadow-warm">
            + Nuevo pedido
          </Link>
        </div>
      </div>
      <div className="bg-white rounded-2xl border border-granate-100 shadow-warm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-crema-100 border-b border-granate-100">
            <tr className="text-left text-granate-700">
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-granate-700/60">Sin pedidos todavía.</td></tr>
            ) : rows.map((o) => (
              <tr key={o.id} className="border-b border-granate-50">
                <td className="px-4 py-3 text-granate-700">{fmtDate(o.created_at)}</td>
                <td className="px-4 py-3"><div className="font-medium text-granate-800">{o.customer_name}</div><div className="text-xs text-granate-700/60">{o.customer_phone}</div></td>
                <td className="px-4 py-3 text-granate-700">{o.order_type}</td>
                <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${statusColor[o.status]}`}>{o.status}</span></td>
                <td className="px-4 py-3 text-right font-medium text-granate-800">{fmtCOP(o.total_amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

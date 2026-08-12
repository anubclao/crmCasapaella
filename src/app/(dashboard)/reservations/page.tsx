import { query } from "@/lib/db";
import Link from "next/link";

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

const statusColor: Record<string, string> = {
  pending: "bg-dorado-100 text-dorado-700",
  confirmed: "bg-green-100 text-green-700",
  cancelled: "bg-granate-100 text-granate-700",
  completed: "bg-blue-100 text-blue-700",
  no_show: "bg-gray-100 text-gray-700",
};

export default async function ReservationsPage() {
  const rows = await query<Array<{
    id: number; reservation_date: string; guests: number; status: string;
    customer_name: string; customer_phone: string; notes: string | null;
  }>>(
    `SELECT r.id, r.reservation_date, r.guests, r.status, r.notes,
            c.name AS customer_name, c.phone AS customer_phone
     FROM reservations r
     INNER JOIN customers c ON c.id = r.customer_id
     ORDER BY r.reservation_date DESC
     LIMIT 100`
  );

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-granate-800">Reservas</h1>
          <p className="text-sm text-granate-700/60">Últimas 100 reservas</p>
        </div>
        <Link href="/reservations/new" className="px-4 py-2 bg-granate-500 text-white rounded-lg text-sm hover:bg-granate-600 shadow-warm">
          + Nueva reserva
        </Link>
      </div>
      <div className="bg-white rounded-2xl border border-granate-100 shadow-warm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-crema-100 border-b border-granate-100">
            <tr className="text-left text-granate-700">
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Comensales</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Notas</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-12 text-center text-granate-700/60">Sin reservas todavía.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id} className="border-b border-granate-50">
                <td className="px-4 py-3 text-granate-800">{fmtDate(r.reservation_date)}</td>
                <td className="px-4 py-3"><div className="font-medium text-granate-800">{r.customer_name}</div><div className="text-xs text-granate-700/60">{r.customer_phone}</div></td>
                <td className="px-4 py-3 text-granate-700">{r.guests}</td>
                <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${statusColor[r.status]}`}>{r.status}</span></td>
                <td className="px-4 py-3 text-granate-700/70 text-xs">{r.notes ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

import { notFound } from "next/navigation";
import Link from "next/link";
import { getCustomer } from "@/server/customers";
import { getTagsForCustomer } from "@/server/customer-tags";
import { query } from "@/lib/db";

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));

const fmtCOP = (n: number | string) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(Number(n));

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customerId = Number(id);
  if (!Number.isFinite(customerId)) notFound();
  const customer = await getCustomer(customerId);
  if (!customer) notFound();

  const [reservations, orders, messages, tags] = await Promise.all([
    query<Array<{ id: number; reservation_date: string; guests: number; status: string; notes: string | null }>>(
      "SELECT id, reservation_date, guests, status, notes FROM reservations WHERE customer_id = ? ORDER BY reservation_date DESC",
      [customerId]
    ),
    query<Array<{ id: number; order_type: string; total_amount: string; status: string; created_at: string }>>(
      "SELECT id, order_type, total_amount, status, created_at FROM orders WHERE customer_id = ? ORDER BY created_at DESC",
      [customerId]
    ),
    query<Array<{ id: number; direction: string; body: string; status: string; created_at: string }>>(
      "SELECT id, direction, body, status, created_at FROM messages WHERE customer_id = ? ORDER BY created_at DESC LIMIT 20",
      [customerId]
    ),
    getTagsForCustomer(customerId),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/customers" className="text-sm text-granate-600 hover:underline">← Volver a clientes</Link>
      </div>

      <div className="bg-white rounded-2xl border border-granate-100 shadow-warm p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-3xl text-granate-800">{customer.name}</h1>
            <div className="text-granate-700 mt-1">{customer.phone}</div>
            {customer.email && <div className="text-granate-700/70 text-sm">{customer.email}</div>}
            <div className="text-xs text-granate-700/50 mt-2 uppercase tracking-wide">Origen: {customer.source}</div>
            {tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {tags.map((t) => (
                  <span
                    key={t.id}
                    className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                    style={{ backgroundColor: t.color }}
                  >
                    {t.name}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-xs text-granate-700/60 uppercase">LTV</div>
            <div className="font-display text-3xl text-granate-600">{fmtCOP(customer.total_spent)}</div>
            <div className="text-sm text-granate-700/70 mt-1">
              {customer.total_orders} pedidos · {customer.total_reservations} reservas
            </div>
            <div className="mt-3 flex gap-2 justify-end">
              <Link
                href={`/reservations/new?customer=${customer.id}`}
                className="text-xs px-3 py-1.5 rounded border border-granate-200 text-granate-700 hover:bg-granate-50"
              >
                + Reserva
              </Link>
              <Link
                href={`/orders/new?customer=${customer.id}`}
                className="text-xs px-3 py-1.5 rounded border border-granate-200 text-granate-700 hover:bg-granate-50"
              >
                + Pedido
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Section title="Reservas">
          {reservations.length === 0 ? (
            <Empty msg="Sin reservas." />
          ) : (
            <ul className="space-y-2">
              {reservations.map((r) => (
                <li key={r.id} className="flex items-center justify-between text-sm border-b border-granate-50 pb-2">
                  <div>
                    <div className="font-medium text-granate-800">{fmtDate(r.reservation_date)}</div>
                    <div className="text-xs text-granate-700/60">{r.guests} comensales · {r.status}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Pedidos">
          {orders.length === 0 ? (
            <Empty msg="Sin pedidos." />
          ) : (
            <ul className="space-y-2">
              {orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between text-sm border-b border-granate-50 pb-2">
                  <div>
                    <div className="font-medium text-granate-800">{fmtDate(o.created_at)}</div>
                    <div className="text-xs text-granate-700/60">{o.order_type} · {o.status}</div>
                  </div>
                  <div className="text-granate-800 font-medium">{fmtCOP(o.total_amount)}</div>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Mensajes recientes">
        {messages.length === 0 ? (
          <Empty msg="Sin mensajes." />
        ) : (
          <ul className="space-y-3">
            {messages.map((m) => (
              <li key={m.id} className="border border-granate-100 rounded-lg p-3 bg-crema-50">
                <div className="flex items-center justify-between text-xs text-granate-700/60 mb-1">
                  <span>{m.direction === "outbound" ? "📤 Enviado" : "📥 Recibido"}</span>
                  <span>{fmtDate(m.created_at)} · {m.status}</span>
                </div>
                <div className="text-sm text-granate-800 whitespace-pre-wrap">{m.body}</div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-granate-100 shadow-warm p-6">
      <h2 className="font-display text-xl text-granate-800 mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Empty({ msg }: { msg: string }) {
  return <p className="text-sm text-granate-700/60">{msg}</p>;
}

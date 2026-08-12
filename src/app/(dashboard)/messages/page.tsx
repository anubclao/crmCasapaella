import { listMessages } from "@/server/messages";

const fmtDate = (iso: string) =>
  new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(new Date(iso));

const statusColor: Record<string, string> = {
  queued: "bg-dorado-100 text-dorado-700",
  sent: "bg-blue-100 text-blue-700",
  delivered: "bg-green-100 text-green-700",
  read: "bg-green-200 text-green-800",
  failed: "bg-granate-100 text-granate-700",
};

export default async function MessagesPage() {
  const messages = await listMessages({ limit: 100 });

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-3xl text-granate-800">Mensajes</h1>
        <p className="text-sm text-granate-700/60">Últimos 100 mensajes de WhatsApp</p>
      </div>

      <div className="bg-white rounded-2xl border border-granate-100 shadow-warm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-crema-100 border-b border-granate-100">
            <tr className="text-left text-granate-700">
              <th className="px-4 py-3 font-medium">Fecha</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Dirección</th>
              <th className="px-4 py-3 font-medium">Mensaje</th>
              <th className="px-4 py-3 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {messages.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-granate-700/60">
                  Aún no hay mensajes. Los primeros aparecerán cuando un cliente reserve o pida.
                </td>
              </tr>
            ) : (
              messages.map((m) => (
                <tr key={m.id} className="border-b border-granate-50 align-top">
                  <td className="px-4 py-3 text-granate-700/80 text-xs whitespace-nowrap">{fmtDate(m.created_at)}</td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-granate-800">{m.customer_name ?? "—"}</div>
                    <div className="text-xs text-granate-700/60">{m.customer_phone}</div>
                  </td>
                  <td className="px-4 py-3 text-granate-700 text-xs">
                    {m.direction === "outbound" ? "📤" : "📥"} {m.channel}
                  </td>
                  <td className="px-4 py-3 text-granate-800 max-w-md">
                    <div className="line-clamp-3 whitespace-pre-wrap">{m.body}</div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${statusColor[m.status] ?? "bg-gray-100 text-gray-700"}`}>
                      {m.status}
                    </span>
                    {m.error && <div className="text-xs text-granate-600 mt-1">{m.error}</div>}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

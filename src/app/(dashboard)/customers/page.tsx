import Link from "next/link";
import { listCustomers, countCustomers, countByStage } from "@/server/customers";
import { getTagsForCustomers } from "@/server/customer-tags";
import { getCurrentRoleAsync, roleAtLeast } from "@/lib/authz";
import { PIPELINE_STAGES, stageInfo } from "@/lib/pipeline";

const fmtDate = (iso: string | null) =>
  iso ? new Intl.DateTimeFormat("es-CO", { dateStyle: "short" }).format(new Date(iso)) : "—";

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; page?: string; stage?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const stage = PIPELINE_STAGES.some((s) => s.key === sp.stage) ? sp.stage : undefined;
  const page = Math.max(1, Number(sp.page ?? 1));
  const limit = 25;
  const offset = (page - 1) * limit;

  const [rows, total, byStage, role] = await Promise.all([
    listCustomers({ search: q, stage, limit, offset }),
    countCustomers({ search: q, stage }),
    countByStage(q),
    getCurrentRoleAsync(),
  ]);
  const canEdit = roleAtLeast(role, "manager");
  const tagsByCustomer = await getTagsForCustomers(rows.map((r) => r.id));
  const pages = Math.max(1, Math.ceil(total / limit));
  const allCount = [...byStage.values()].reduce((a, b) => a + b, 0);
  const qs = (params: { page?: number; stage?: string }) => {
    const u = new URLSearchParams();
    if (q) u.set("q", q);
    if (params.stage) u.set("stage", params.stage);
    if (params.page && params.page > 1) u.set("page", String(params.page));
    const str = u.toString();
    return `/customers${str ? `?${str}` : ""}`;
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-display text-3xl text-granate-800">Clientes</h1>
          <p className="text-sm text-granate-700/60">
            {total} {stage ? `en estado ${stageInfo(stage).label}` : "en total"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          {canEdit && (
            <>
              <Link
                href="/customers/new"
                className="px-3 py-2 text-sm rounded-lg bg-granate-500 text-white hover:bg-granate-600"
              >
                + Nuevo cliente
              </Link>
              <Link
                href="/customers/import"
                className="px-3 py-2 text-sm rounded-lg border border-granate-200 text-granate-700 hover:bg-crema-50"
              >
                📤 Cargue masivo
              </Link>
            </>
          )}
          <a
            href="/api/customers/export"
            className="px-3 py-2 text-sm rounded-lg border border-granate-200 text-granate-700 hover:bg-crema-50"
          >
            📥 Exportar CSV
          </a>
          <form className="flex gap-2">
            {stage && <input type="hidden" name="stage" value={stage} />}
            <input
              name="q"
              defaultValue={q}
              placeholder="Buscar nombre, teléfono, email…"
              className="px-4 py-2 rounded-lg border border-granate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-dorado-400"
            />
            <button type="submit" className="px-4 py-2 bg-granate-500 text-white rounded-lg text-sm hover:bg-granate-600">
              Buscar
            </button>
          </form>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <StageChip href={qs({})} active={!stage} label="Todos" count={allCount} />
        {PIPELINE_STAGES.map((s) => (
          <StageChip
            key={s.key}
            href={qs({ stage: s.key })}
            active={stage === s.key}
            label={s.label}
            count={byStage.get(s.key) ?? 0}
            color={s.color}
          />
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-granate-100 shadow-warm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-crema-100 border-b border-granate-100">
            <tr className="text-left text-granate-700">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Teléfono</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium">Etiquetas</th>
              <th className="px-4 py-3 font-medium">Origen</th>
              <th className="px-4 py-3 font-medium text-right">Pedidos</th>
              <th className="px-4 py-3 font-medium text-right">Reservas</th>
              <th className="px-4 py-3 font-medium text-right">Total</th>
              <th className="px-4 py-3 font-medium">Última act.</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-granate-700/60">
                  {q || stage ? "Sin resultados para este filtro." : "Aún no hay clientes. Comparte el endpoint /api/webhook/lead con tu sitio web para empezar a capturar."}
                </td>
              </tr>
            ) : (
              rows.map((c) => {
                const tags = tagsByCustomer.get(c.id) ?? [];
                return (
                  <tr key={c.id} className="border-b border-granate-50 hover:bg-crema-50">
                    <td className="px-4 py-3">
                      <Link href={`/customers/${c.id}`} className="font-medium text-granate-800 hover:text-granate-600">
                        {c.name}
                      </Link>
                      {c.email && <div className="text-xs text-granate-700/60">{c.email}</div>}
                    </td>
                    <td className="px-4 py-3 text-granate-700">{c.phone}</td>
                    <td className="px-4 py-3">
                      <StageBadge stage={c.pipeline_stage} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {tags.length === 0 ? (
                          <span className="text-xs text-granate-700/40">—</span>
                        ) : (
                          tags.map((t) => (
                            <span
                              key={t.id}
                              className="px-1.5 py-0.5 rounded text-[10px] font-medium text-white"
                              style={{ backgroundColor: t.color }}
                            >
                              {t.name}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-granate-700/80 text-xs uppercase">{c.source}</td>
                    <td className="px-4 py-3 text-right text-granate-700">{c.total_orders}</td>
                    <td className="px-4 py-3 text-right text-granate-700">{c.total_reservations}</td>
                    <td className="px-4 py-3 text-right text-granate-800 font-medium">${new Intl.NumberFormat("es-CO").format(Number(c.total_spent))}</td>
                    <td className="px-4 py-3 text-granate-700/70 text-xs">{fmtDate(c.last_activity_at)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          {Array.from({ length: pages }, (_, i) => i + 1)
            .filter((p) => Math.abs(p - page) <= 2 || p === 1 || p === pages)
            .map((p, idx, arr) => {
              const prev = arr[idx - 1];
              const gap = prev && p - prev > 1;
              return (
                <span key={p} className="flex items-center gap-2">
                  {gap && <span className="text-granate-700/40">…</span>}
                  <Link
                    href={qs({ page: p, stage })}
                    className={`px-3 py-1 rounded text-sm ${
                      p === page ? "bg-granate-500 text-white" : "bg-white border border-granate-200 text-granate-700 hover:bg-crema-50"
                    }`}
                  >
                    {p}
                  </Link>
                </span>
              );
            })}
        </div>
      )}
    </div>
  );
}

function StageBadge({ stage }: { stage: string }) {
  const s = stageInfo(stage);
  return (
    <span className="px-2 py-0.5 rounded-full text-xs font-medium text-white whitespace-nowrap" style={{ backgroundColor: s.color }}>
      {s.label}
    </span>
  );
}

function StageChip({ href, active, label, count, color }: { href: string; active: boolean; label: string; count: number; color?: string }) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-sm border ${
        active ? "bg-granate-500 text-white border-granate-500" : "bg-white text-granate-700 border-granate-200 hover:bg-crema-50"
      }`}
    >
      {color && <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />}
      {label}
      <span className={active ? "text-white/80" : "text-granate-700/50"}>{count}</span>
    </Link>
  );
}

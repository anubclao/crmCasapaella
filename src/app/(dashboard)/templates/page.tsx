import { listTemplates } from "@/server/templates";
import { TemplateEditor } from "./editor";

const fmtDate = (d: string | Date | null | undefined) => {
  if (!d) return "—";
  const date = d instanceof Date ? d : new Date(d);
  if (isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("es-CO", { dateStyle: "short", timeStyle: "short" }).format(date);
};

const categoryColor: Record<string, string> = {
  transactional: "bg-blue-100 text-blue-700",
  marketing: "bg-granate-100 text-granate-700",
  utility: "bg-green-100 text-green-700",
};

const metaStatusColor: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  pending: "bg-dorado-100 text-dorado-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-granate-100 text-granate-700",
};

export default async function TemplatesPage() {
  const templates = await listTemplates();

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-granate-800">Plantillas de mensajes</h1>
          <p className="text-sm text-granate-700/60">
            Edita los mensajes transaccionales y de marketing. Usa <code className="bg-crema-100 px-1 rounded">{"{{variables}}"}</code> para personalizar.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {templates.length === 0 ? (
          <p className="text-granate-700/60 text-sm">Sin plantillas. La seed debió crear 3 por defecto.</p>
        ) : (
          templates.map((t) => {
            const variables = (t.variables ?? []) as string[];
            return (
              <div key={t.id} className="bg-white rounded-2xl border border-granate-100 shadow-warm p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <code className="text-sm bg-crema-100 px-2 py-0.5 rounded text-granate-800">{t.name}</code>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${categoryColor[t.category]}`}>
                        {t.category}
                      </span>
                      {t.metaStatus && (
                        <span className={`px-2 py-0.5 rounded text-[10px] font-medium uppercase ${metaStatusColor[t.metaStatus]}`}>
                          meta: {t.metaStatus}
                        </span>
                      )}
                      {!t.isActive && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-medium uppercase bg-gray-100 text-gray-700">
                          inactivo
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-granate-700/60 mt-1">
                      {t.language} · actualizado {fmtDate(t.updatedAt)}
                    </div>
                    {variables.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {variables.map((v) => (
                          <code key={v} className="text-[10px] bg-dorado-100 text-dorado-700 px-1.5 py-0.5 rounded">
                            {`{{${v}}}`}
                          </code>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <TemplateEditor id={t.id} initialBody={t.body} />
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

type ReadinessItem = { key: string; label: string; help: string };
type Readiness = { ok: boolean; missing: ReadinessItem[] };
type TemplateInfo = {
  name: string;
  category: "marketing" | "utility" | "authentication";
  language: string;
  variableCount: number;
  notes: string | null;
};
type Status =
  | {
      provider: "baileys";
      connected: boolean;
      qrCode: string | null;
      phoneNumber: string | null;
    }
  | { provider: "meta"; connected: boolean; phoneNumberId: string | null };

type ApiResponse = {
  ok: boolean;
  status: Status;
  meta: { readiness: Readiness; templates: TemplateInfo[] };
};

export default function WhatsAppPage() {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/whatsapp/status", {
        credentials: "same-origin",
      });
      if (!res.ok) {
        setError("No autorizado. Vuelve a iniciar sesión.");
        return;
      }
      const json = (await res.json()) as ApiResponse;
      setData(json);
      if (json.status.provider === "baileys" && json.status.qrCode) {
        const svg = await QRCode.toString(json.status.qrCode, {
          type: "svg",
          margin: 1,
          width: 280,
        });
        setQrSvg(svg);
      } else {
        setQrSvg(null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, []);

  if (error) {
    return (
      <div>
        <h1 className="font-display text-3xl text-granate-800 mb-1">
          Conexión WhatsApp
        </h1>
        <p className="text-sm text-granate-700/60 mb-6">
          Estado del proveedor y QR de autenticación
        </p>
        <div className="mb-4 p-3 rounded-lg bg-granate-50 border border-granate-200 text-granate-700 text-sm">
          {error}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div>
        <h1 className="font-display text-3xl text-granate-800 mb-1">
          Conexión WhatsApp
        </h1>
        <p className="text-sm text-granate-700/60 mb-6">Cargando…</p>
      </div>
    );
  }

  const { status, meta } = data;
  const isMeta = status.provider === "meta";
  const isBaileys = status.provider === "baileys";

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="font-display text-3xl text-granate-800 mb-1">
          Conexión WhatsApp
        </h1>
        <p className="text-sm text-granate-700/60">
          Estado del proveedor y configuración de la API
        </p>
      </div>

      {/* Status card */}
      <div className="bg-white rounded-2xl border border-granate-100 shadow-warm p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-granate-700/60">
              Proveedor activo
            </div>
            <div className="font-display text-xl text-granate-800">
              {isMeta ? "Meta Cloud API (Producción)" : "Baileys (Dev/MVP)"}
            </div>
          </div>
          <span
            className={`px-3 py-1 rounded-full text-xs font-medium ${
              status.connected
                ? "bg-green-100 text-green-700"
                : "bg-dorado-100 text-dorado-700"
            }`}
          >
            {status.connected ? "● Conectado" : "○ Desconectado"}
          </span>
        </div>

        {isMeta && status.connected && (
          <p className="text-sm text-granate-700">
            Phone Number ID:{" "}
            <code className="bg-crema-100 px-1 rounded">
              {status.phoneNumberId}
            </code>
          </p>
        )}

        {isBaileys && status.connected && (
          <p className="text-sm text-granate-700">
            Sesión activa como <strong>{status.phoneNumber}</strong>. Backup de{" "}
            <code className="bg-crema-100 px-1 rounded text-xs">
              auth_artifacts/baileys/
            </code>{" "}
            obligatorio.
          </p>
        )}

        {isBaileys && !status.connected && (
          <div className="mt-4">
            {qrSvg ? (
              <div className="text-center">
                <p className="text-sm text-granate-700 mb-3">
                  Escanea este código con la app de WhatsApp del celular del
                  restaurante:
                </p>
                <ol className="text-xs text-granate-700/80 space-y-1 mb-4 text-left max-w-xs mx-auto">
                  <li>1. Abre WhatsApp en el celular</li>
                  <li>
                    2. Menú ⋮ → <strong>Dispositivos vinculados</strong>
                  </li>
                  <li>
                    3. <strong>Vincular un dispositivo</strong>
                  </li>
                  <li>4. Apunta la cámara a este QR</li>
                </ol>
                <div
                  className="inline-block p-3 bg-white border-2 border-granate-200 rounded-xl"
                  dangerouslySetInnerHTML={{ __html: qrSvg }}
                />
                <p className="text-xs text-granate-700/60 mt-3">
                  ⚠ Baileys no es oficial. Riesgo de baneo. Migrá a Meta Cloud
                  antes de producción.
                </p>
              </div>
            ) : (
              <p className="text-sm text-granate-700/70">
                Generando QR… (refresca en unos segundos)
              </p>
            )}
          </div>
        )}
      </div>

      {/* Meta readiness panel (only when meta is selected) */}
      {isMeta && (
        <>
          <div
            className={`rounded-2xl border shadow-warm p-6 ${
              meta.readiness.ok
                ? "bg-green-50 border-green-200"
                : "bg-dorado-50 border-dorado-200"
            }`}
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-granate-700/60">
                  Readiness
                </div>
                <div className="font-display text-xl text-granate-800">
                  {meta.readiness.ok
                    ? "✓ Todo configurado"
                    : `Faltan ${meta.readiness.missing.length} variable(s) de entorno`}
                </div>
              </div>
            </div>

            {meta.readiness.missing.length > 0 && (
              <ul className="space-y-3 mt-4">
                {meta.readiness.missing.map((m) => (
                  <li
                    key={m.key}
                    className="bg-white rounded-lg p-3 border border-dorado-200"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-dorado-700 font-mono text-sm">
                        ●
                      </span>
                      <code className="bg-crema-100 px-2 py-0.5 rounded text-xs font-mono">
                        {m.key}
                      </code>
                      <span className="text-xs text-granate-700/70">
                        — {m.label}
                      </span>
                    </div>
                    <p className="text-xs text-granate-700/80 ml-5">{m.help}</p>
                  </li>
                ))}
              </ul>
            )}

            <details className="mt-4">
              <summary className="text-xs text-granate-700/70 cursor-pointer hover:text-granate-800">
                ¿Cómo se configura Meta Cloud API?
              </summary>
              <ol className="text-xs text-granate-700/80 space-y-2 mt-3 ml-4 list-decimal">
                <li>
                  <strong>Cuenta Meta Business:</strong> Ir a{" "}
                  <a
                    className="text-granate-600 underline"
                    href="https://business.facebook.com"
                    target="_blank"
                    rel="noreferrer"
                  >
                    business.facebook.com
                  </a>
                  , crear cuenta y verificar la empresa (1-3 días hábiles).
                </li>
                <li>
                  <strong>App de Meta + WhatsApp:</strong> En{" "}
                  <a
                    className="text-granate-600 underline"
                    href="https://developers.facebook.com"
                    target="_blank"
                    rel="noreferrer"
                  >
                    developers.facebook.com
                  </a>{" "}
                  crear app tipo "Business", agregar producto WhatsApp.
                </li>
                <li>
                  <strong>Número de teléfono:</strong> Verificar uno nuevo o
                  portar el actual (si usabas Baileys, primero cerrá la sesión:
                  WhatsApp → Dispositivos vinculados → Cerrar todos).
                </li>
                <li>
                  <strong>Credenciales:</strong> Copiar Phone Number ID, WABA
                  ID, y generar un System User Token permanente.
                </li>
                <li>
                  <strong>Templates:</strong> Crear los 3 templates listados
                  abajo en WhatsApp Manager (24-48h de aprobación, especialmente
                  marketing).
                </li>
                <li>
                  <strong>Webhook:</strong> Apuntar a{" "}
                  <code className="bg-crema-100 px-1 rounded">
                    {typeof window !== "undefined"
                      ? window.location.origin
                      : ""}
                    /api/webhook/whatsapp
                  </code>{" "}
                  con el mismo{" "}
                  <code className="bg-crema-100 px-1 rounded">
                    META_WA_WEBHOOK_VERIFY_TOKEN
                  </code>
                  .
                </li>
                <li>
                  <strong>Variables de entorno:</strong> Pegar en hPanel → Web
                  App → Environment variables, después <strong>Restart</strong>.
                </li>
              </ol>
            </details>
          </div>

          {/* Templates checklist */}
          <div className="bg-white rounded-2xl border border-granate-100 shadow-warm p-6">
            <div className="mb-4">
              <div className="text-xs uppercase tracking-wide text-granate-700/60">
                Templates registrados
              </div>
              <div className="font-display text-xl text-granate-800">
                {meta.templates.length} template(s) a crear en Meta
              </div>
              <p className="text-xs text-granate-700/60 mt-1">
                Cada uno debe existir en WhatsApp Manager con EXACTAMENTE el
                mismo nombre y la cantidad de variables indicada.
              </p>
            </div>

            <ul className="space-y-3">
              {meta.templates.map((t) => (
                <li
                  key={t.name}
                  className="border border-granate-100 rounded-lg p-3 hover:bg-crema-50 transition"
                >
                  <div className="flex items-center justify-between">
                    <code className="bg-crema-100 px-2 py-0.5 rounded text-xs font-mono">
                      {t.name}
                    </code>
                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className={`px-2 py-0.5 rounded-full ${
                          t.category === "marketing"
                            ? "bg-dorado-100 text-dorado-700"
                            : "bg-green-100 text-green-700"
                        }`}
                      >
                        {t.category}
                      </span>
                      <span className="bg-crema-100 px-2 py-0.5 rounded text-granate-700">
                        {t.language}
                      </span>
                      <span className="text-granate-700/70">
                        {t.variableCount} var
                      </span>
                    </div>
                  </div>
                  {t.notes && (
                    <p className="text-xs text-granate-700/70 mt-2">
                      {t.notes}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>

          {/* Rate limits reminder */}
          <div className="bg-crema-50 rounded-2xl border border-crema-200 p-5">
            <div className="font-display text-base text-granate-800 mb-2">
              Recomendaciones para evitar baneo
            </div>
            <ul className="text-xs text-granate-700/80 space-y-1.5 list-disc list-inside">
              <li>
                <strong>Solo transaccionales al inicio</strong> (utility):
                confirmación de reserva, pedido recibido. No requieren opt-in.
              </li>
              <li>
                <strong>Marketing solo a clientes que respondieron</strong> en
                los últimos 30 días, o que explícitamente aceptaron.
              </li>
              <li>
                <strong>Máximo 1 msg/segundo</strong> para marketing en números
                nuevos. Meta sube el límite según la calidad.
              </li>
              <li>
                <strong>Monitorear quality rating</strong> en WhatsApp Manager.
                Si baja a "LOW", Meta te avisa y eventualmente te bloquea.
              </li>
              <li>
                <strong>No enviar entre 21:00 y 09:00</strong> hora local del
                cliente.
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

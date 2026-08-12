"use client";

import { useEffect, useState, useRef } from "react";
import QRCode from "qrcode";

type Status =
  | { provider: "baileys"; connected: boolean; qrCode: string | null; phoneNumber: string | null }
  | { provider: "meta"; connected: boolean; phoneNumberId: string | null };

export default function WhatsAppPage() {
  const [status, setStatus] = useState<Status | null>(null);
  const [qrSvg, setQrSvg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  async function refresh() {
    try {
      const res = await fetch("/api/whatsapp/status", { credentials: "same-origin" });
      if (!res.ok) {
        setError("No autorizado. Vuelve a iniciar sesión.");
        return;
      }
      const data = await res.json();
      setStatus(data.status);
      if (data.status.provider === "baileys" && data.status.qrCode) {
        const svg = await QRCode.toString(data.status.qrCode, { type: "svg", margin: 1, width: 280 });
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
    const t = setInterval(refresh, 5000); // poll for new QR
    return () => clearInterval(t);
  }, []);

  return (
    <div>
      <h1 className="font-display text-3xl text-granate-800 mb-1">Conexión WhatsApp</h1>
      <p className="text-sm text-granate-700/60 mb-6">Estado del proveedor y QR de autenticación</p>

      {error && <div className="mb-4 p-3 rounded-lg bg-granate-50 border border-granate-200 text-granate-700 text-sm">{error}</div>}

      {status && (
        <div className="bg-white rounded-2xl border border-granate-100 shadow-warm p-6 max-w-xl">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="text-xs uppercase tracking-wide text-granate-700/60">Proveedor</div>
              <div className="font-display text-xl text-granate-800">
                {status.provider === "baileys" ? "Baileys (Dev/MVP)" : "Meta Cloud API (Prod)"}
              </div>
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                status.connected ? "bg-green-100 text-green-700" : "bg-dorado-100 text-dorado-700"
              }`}
            >
              {status.connected ? "● Conectado" : "○ Desconectado"}
            </span>
          </div>

          {status.provider === "baileys" && status.connected && (
            <p className="text-sm text-granate-700">
              Sesión activa como <strong>{status.phoneNumber}</strong>. La sesión se persiste en
              <code className="px-1 mx-1 bg-crema-100 rounded text-xs">auth_artifacts/baileys/</code>
              y sobrevive a reinicios.
            </p>
          )}

          {status.provider === "baileys" && !status.connected && (
            <div className="mt-4">
              {qrSvg ? (
                <div className="text-center">
                  <p className="text-sm text-granate-700 mb-3">
                    Escanea este código con la app de WhatsApp del celular del restaurante:
                  </p>
                  <ol className="text-xs text-granate-700/80 space-y-1 mb-4 text-left max-w-xs mx-auto">
                    <li>1. Abre WhatsApp en el celular</li>
                    <li>2. Menú ⋮ → <strong>Dispositivos vinculados</strong></li>
                    <li>3. <strong>Vincular un dispositivo</strong></li>
                    <li>4. Apunta la cámara a este QR</li>
                  </ol>
                  <div
                    className="inline-block p-3 bg-white border-2 border-granate-200 rounded-xl"
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  />
                  <p className="text-xs text-granate-700/60 mt-3">
                    El QR se renueva automáticamente cada 60 segundos.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-granate-700/70">Generando QR… (refresca en unos segundos)</p>
              )}
            </div>
          )}

          {status.provider === "meta" && (
            <p className="text-sm text-granate-700">
              {status.connected ? (
                <>Phone Number ID: <code className="bg-crema-100 px-1 rounded">{status.phoneNumberId}</code></>
              ) : (
                "Configura META_WA_PHONE_NUMBER_ID y META_WA_ACCESS_TOKEN en .env.production."
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

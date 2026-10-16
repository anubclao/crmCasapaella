"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { stageInfo } from "@/lib/pipeline";

type Analysis = {
  totalRows: number;
  toCreate: number;
  toUpdate: number;
  errors: Array<{ row: number; messages: string[] }>;
  ignoredColumns: string[];
  preview: Array<{
    row: number;
    action: "create" | "update";
    name: string;
    phone: string;
    email: string | null;
    birthDate: string | null;
    stage: string | null;
  }>;
};

type CommitResult = { created: number; updated: number; skipped: number };

const fmtDate = (iso: string | null) => (iso ? iso.split("-").reverse().join("/") : "—");

export function CustomerImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"analyzing" | "importing" | null>(null);

  async function send(f: File, mode: "preview" | "commit") {
    const body = new FormData();
    body.set("file", f);
    body.set("mode", mode);
    const res = await fetch("/api/customers/import", { method: "POST", body, credentials: "same-origin" });
    const data = await res.json().catch(() => ({ ok: false, error: "Respuesta inválida del servidor" }));
    if (!res.ok || !data.ok) throw new Error(data.error ?? "Error");
    return data;
  }

  async function onPick(f: File | null) {
    setFile(f);
    setAnalysis(null);
    setResult(null);
    setError(null);
    if (!f) return;
    setBusy("analyzing");
    try {
      setAnalysis(await send(f, "preview"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  async function onCommit() {
    if (!file) return;
    setBusy("importing");
    setError(null);
    try {
      setResult(await send(file, "commit"));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  }

  function reset() {
    setFile(null);
    setAnalysis(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  if (result) {
    return (
      <div className="bg-white rounded-2xl border border-granate-100 shadow-warm p-6 space-y-4">
        <h2 className="font-display text-2xl text-granate-800">✓ Importación terminada</h2>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Creados" value={result.created} tone="ok" />
          <Stat label="Actualizados" value={result.updated} tone="info" />
          <Stat label="Rechazados" value={result.skipped} tone={result.skipped ? "bad" : "muted"} />
        </div>
        <div className="flex gap-3">
          <Link href="/customers" className="px-4 py-2 text-sm rounded-lg bg-granate-500 text-white hover:bg-granate-600">
            Ver clientes
          </Link>
          <button onClick={reset} className="px-4 py-2 text-sm rounded-lg border border-granate-200 text-granate-700 hover:bg-granate-50">
            Importar otro archivo
          </button>
        </div>
      </div>
    );
  }

  const valid = analysis ? analysis.toCreate + analysis.toUpdate : 0;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-granate-100 shadow-warm p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="text-sm text-granate-800 space-y-1">
            <div className="font-medium">Columnas del archivo</div>
            <div className="text-granate-700/80">
              <b>Nombres*</b>, <b>Apellidos*</b>, <b>WhatsApp*</b>, Correo, Fecha de nacimiento (DD/MM/AAAA), Estado
            </div>
            <div className="text-xs text-granate-700/60">
              * Obligatorias. Si el WhatsApp ya existe, se actualiza ese cliente y las celdas vacías no borran sus datos.
            </div>
          </div>
          <a href="/api/customers/import/template" className="px-3 py-2 text-sm rounded-lg border border-granate-200 text-granate-700 hover:bg-crema-50 whitespace-nowrap">
            📄 Descargar plantilla
          </a>
        </div>

        <label className="block border-2 border-dashed border-granate-200 rounded-xl p-6 text-center cursor-pointer hover:bg-crema-50">
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="sr-only"
            onChange={(e) => onPick(e.target.files?.[0] ?? null)}
          />
          <div className="text-granate-800 font-medium">{file ? file.name : "Selecciona el archivo .xlsx o .csv"}</div>
          <div className="text-xs text-granate-700/60 mt-1">
            {busy === "analyzing" ? "Revisando el archivo…" : "Máximo 5 MB y 5000 clientes"}
          </div>
        </label>

        {error && <div className="p-3 rounded-lg bg-granate-50 border border-granate-200 text-granate-700 text-sm">{error}</div>}
      </div>

      {analysis && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Filas leídas" value={analysis.totalRows} tone="muted" />
            <Stat label="Nuevos" value={analysis.toCreate} tone="ok" />
            <Stat label="Se actualizan" value={analysis.toUpdate} tone="info" />
            <Stat label="Con errores" value={analysis.errors.length} tone={analysis.errors.length ? "bad" : "muted"} />
          </div>

          {analysis.ignoredColumns.length > 0 && (
            <div className="p-3 rounded-lg bg-crema-50 border border-dorado-400/40 text-sm text-granate-800">
              Columnas que no se importan: {analysis.ignoredColumns.join(", ")}
            </div>
          )}

          {analysis.errors.length > 0 && (
            <Section title={`Filas con errores (${analysis.errors.length}) — no se importarán`}>
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-crema-100">
                    <tr className="text-left text-granate-700">
                      <th className="px-3 py-2 font-medium w-20">Fila</th>
                      <th className="px-3 py-2 font-medium">Problema</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.errors.map((e) => (
                      <tr key={e.row} className="border-b border-granate-50 align-top">
                        <td className="px-3 py-2 text-granate-700">{e.row}</td>
                        <td className="px-3 py-2 text-granate-700">
                          {e.messages.map((m, i) => (
                            <div key={i}>{m}</div>
                          ))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-granate-700/60 mt-3">
                Puedes corregir el archivo y volver a subirlo, o importar solo las filas válidas.
              </p>
            </Section>
          )}

          {analysis.preview.length > 0 && (
            <Section title={`Vista previa${valid > analysis.preview.length ? ` (primeras ${analysis.preview.length} de ${valid})` : ""}`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-crema-100">
                    <tr className="text-left text-granate-700">
                      <th className="px-3 py-2 font-medium">Fila</th>
                      <th className="px-3 py-2 font-medium">Acción</th>
                      <th className="px-3 py-2 font-medium">Nombre</th>
                      <th className="px-3 py-2 font-medium">WhatsApp</th>
                      <th className="px-3 py-2 font-medium">Correo</th>
                      <th className="px-3 py-2 font-medium">Nacimiento</th>
                      <th className="px-3 py-2 font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {analysis.preview.map((p) => (
                      <tr key={p.row} className="border-b border-granate-50">
                        <td className="px-3 py-2 text-granate-700/70">{p.row}</td>
                        <td className="px-3 py-2">
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${p.action === "create" ? "bg-green-100 text-green-800" : "bg-blue-100 text-blue-800"}`}>
                            {p.action === "create" ? "Nuevo" : "Actualizar"}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-granate-800">{p.name}</td>
                        <td className="px-3 py-2 text-granate-700">{p.phone}</td>
                        <td className="px-3 py-2 text-granate-700">{p.email ?? "—"}</td>
                        <td className="px-3 py-2 text-granate-700">{fmtDate(p.birthDate)}</td>
                        <td className="px-3 py-2 text-granate-700">{p.stage ? stageInfo(p.stage).label : p.action === "create" ? "Nuevo" : "Sin cambio"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          )}

          <div className="flex items-center justify-end gap-3">
            <button onClick={reset} className="px-4 py-2 text-sm rounded-lg border border-granate-200 text-granate-700 hover:bg-granate-50">
              Cancelar
            </button>
            <button
              onClick={onCommit}
              disabled={valid === 0 || busy !== null}
              className="px-5 py-2 text-sm rounded-lg bg-granate-500 text-white font-medium shadow-warm hover:bg-granate-600 disabled:opacity-50"
            >
              {busy === "importing" ? "Importando…" : `Importar ${valid} cliente${valid === 1 ? "" : "s"}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

const TONES = {
  ok: "text-green-700",
  info: "text-blue-700",
  bad: "text-granate-600",
  muted: "text-granate-800",
} as const;

function Stat({ label, value, tone }: { label: string; value: number; tone: keyof typeof TONES }) {
  return (
    <div className="bg-white rounded-xl border border-granate-100 shadow-warm p-4">
      <div className="text-xs text-granate-700/60 uppercase">{label}</div>
      <div className={`font-display text-3xl ${TONES[tone]}`}>{value}</div>
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

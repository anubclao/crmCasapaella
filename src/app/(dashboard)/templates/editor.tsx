"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function TemplateEditor({ id, initialBody }: { id: number; initialBody: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(initialBody);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch(`/api/templates/${id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Error");
        return;
      }
      setSaved(true);
      setEditing(false);
      startTransition(() => router.refresh());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error de red");
    } finally {
      setBusy(false);
    }
  }

  if (!editing) {
    return (
      <div>
        <div className="p-3 rounded-lg bg-crema-50 border border-granate-100 text-sm text-granate-800 whitespace-pre-wrap">
          {initialBody}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-granate-600 hover:underline"
          >
            Editar
          </button>
          {saved && <span className="text-xs text-green-700">✓ Guardado</span>}
          {error && <span className="text-xs text-granate-600">{error}</span>}
        </div>
      </div>
    );
  }

  return (
    <div>
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={5}
        className="w-full px-3 py-2 rounded-lg border border-granate-200 focus:outline-none focus:ring-2 focus:ring-dorado-400 text-sm font-mono"
      />
      <div className="mt-2 flex items-center gap-2">
        <button
          onClick={save}
          disabled={busy}
          className="px-3 py-1.5 text-xs rounded bg-granate-500 text-white hover:bg-granate-600 disabled:opacity-50"
        >
          {busy ? "Guardando…" : "Guardar"}
        </button>
        <button
          onClick={() => { setBody(initialBody); setEditing(false); }}
          className="px-3 py-1.5 text-xs rounded border border-granate-200 text-granate-700 hover:bg-crema-50"
        >
          Cancelar
        </button>
        {error && <span className="text-xs text-granate-600">{error}</span>}
      </div>
    </div>
  );
}

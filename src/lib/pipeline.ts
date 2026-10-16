/**
 * Customer pipeline stages (funnel), in order.
 * Client-safe: no server imports, used by pages, forms and the importer.
 */
export const PIPELINE_STAGES = [
  { key: "nuevo", label: "Nuevo", color: "#6B7280" },
  { key: "contactado", label: "Contactado", color: "#2563EB" },
  { key: "interesado", label: "Interesado", color: "#7C3AED" },
  { key: "reservo", label: "Reservó", color: "#D97706" },
  { key: "cliente", label: "Cliente", color: "#059669" },
  { key: "frecuente", label: "Frecuente", color: "#C1272D" },
  { key: "inactivo", label: "Inactivo", color: "#9CA3AF" },
  { key: "perdido", label: "Perdido", color: "#4B5563" },
] as const;

export type PipelineStage = (typeof PIPELINE_STAGES)[number]["key"];

export const DEFAULT_STAGE: PipelineStage = "nuevo";

export const STAGE_KEYS = PIPELINE_STAGES.map((s) => s.key) as [PipelineStage, ...PipelineStage[]];

export function stageInfo(key: string | null | undefined) {
  return PIPELINE_STAGES.find((s) => s.key === key) ?? PIPELINE_STAGES[0];
}

/** Lowercase, strip accents and surrounding spaces: "Reservó " → "reservo". */
export function normalizeText(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
}

/** Match a stage typed by a person ("Reservó", "RESERVO", "reservo") to its key. */
export function parseStage(input: string): PipelineStage | null {
  const n = normalizeText(input);
  const hit = PIPELINE_STAGES.find((s) => s.key === n || normalizeText(s.label) === n);
  return hit?.key ?? null;
}

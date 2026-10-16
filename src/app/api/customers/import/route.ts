/**
 * POST /api/customers/import  (multipart/form-data, manager+)
 *   file: .xlsx or .csv
 *   mode: "preview" (default) → validation report, nothing is written
 *         "commit"            → writes the valid rows, skips the rest
 */
import { NextRequest, NextResponse } from "next/server";
import { authzErrorResponse, requireRole } from "@/lib/authz";
import { analyzeImport, commitImport, ImportFileError, MAX_IMPORT_BYTES } from "@/server/customer-import";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    await requireRole("manager");
  } catch (e) {
    const r = authzErrorResponse(e);
    if (r) return NextResponse.json(r, { status: r.status });
    throw e;
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: "Selecciona un archivo .xlsx o .csv" }, { status: 400 });
  }
  if (file.size > MAX_IMPORT_BYTES) {
    return NextResponse.json({ ok: false, error: "El archivo supera 5 MB." }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  try {
    if (form?.get("mode") === "commit") {
      const result = await commitImport(buffer, file.name);
      return NextResponse.json({ ok: true, ...result });
    }
    const analysis = await analyzeImport(buffer, file.name);
    return NextResponse.json({ ok: true, ...analysis });
  } catch (e) {
    if (e instanceof ImportFileError) {
      return NextResponse.json({ ok: false, error: e.message }, { status: 400 });
    }
    // eslint-disable-next-line no-console
    console.error("[customers/import] failed:", e);
    return NextResponse.json({ ok: false, error: "No se pudo importar. No se guardó ningún cliente." }, { status: 500 });
  }
}

/**
 * GET /api/whatsapp/status
 * Returns the current connection state of the WhatsApp provider, plus a
 * readiness check (for Meta) listing exactly which env vars are missing.
 * Manager or admin only.
 */
import { NextResponse } from "next/server";
import { getWhatsAppProvider } from "@/lib/whatsapp";
import { authzErrorResponse, requireRole } from "@/lib/authz";
import { checkMetaReadiness, listTemplates } from "@/lib/whatsapp/meta-config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole("manager");
  } catch (e) {
    const r = authzErrorResponse(e);
    if (r) return NextResponse.json(r, { status: r.status });
    throw e;
  }
  const wa = getWhatsAppProvider();
  const status = await wa.getStatus();
  const readiness = checkMetaReadiness();

  const templates = listTemplates().map((t) => ({
    name: t.name,
    category: t.category,
    language: t.language,
    variableCount: t.variables.length,
    notes: t.notes ?? null,
  }));

  return NextResponse.json({
    ok: true,
    status,
    meta: {
      readiness,
      templates,
    },
  });
}

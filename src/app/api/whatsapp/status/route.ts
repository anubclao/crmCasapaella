/**
 * GET /api/whatsapp/status
 * Returns the current connection state of the WhatsApp provider.
 * If Baileys, includes the QR code (to be rendered client-side as a QR image).
 * Manager or admin only.
 */
import { NextResponse } from "next/server";
import { getWhatsAppProvider } from "@/lib/whatsapp";
import { authzErrorResponse, requireRole } from "@/lib/authz";

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
  return NextResponse.json({ ok: true, status });
}

/**
 * GET  /api/templates — list
 * POST /api/templates — create
 * PATCH /api/templates — update body
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { listTemplates, createTemplate, updateTemplate } from "@/server/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const rows = await listTemplates();
  return NextResponse.json({ ok: true, templates: rows });
}

const createSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-z0-9_]+$/, "solo minúsculas, números y _"),
  category: z.enum(["transactional", "marketing", "utility"]),
  body: z.string().min(1).max(4096),
  language: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const raw = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  try {
    const id = await createTemplate(parsed.data);
    return NextResponse.json({ ok: true, id });
  } catch (e) {
    return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "error" }, { status: 500 });
  }
}

/**
 * PATCH /api/templates/[id] — update body or category
 * DELETE /api/templates/[id] — delete
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { updateTemplate, deleteTemplate } from "@/server/templates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z.object({
  body: z.string().min(1).max(4096).optional(),
  category: z.enum(["transactional", "marketing", "utility"]).optional(),
  isActive: z.union([z.literal(0), z.literal(1)]).optional(),
  metaStatus: z.enum(["draft", "pending", "approved", "rejected"]).optional(),
  metaTemplateId: z.string().optional(),
});

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const tid = Number(id);
  if (!Number.isFinite(tid)) return NextResponse.json({ ok: false, error: "invalid id" }, { status: 400 });
  const raw = await req.json().catch(() => null);
  const parsed = patchSchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  await updateTemplate(tid, parsed.data);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  await deleteTemplate(Number(id));
  return NextResponse.json({ ok: true });
}

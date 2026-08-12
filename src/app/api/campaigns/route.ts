/**
 * GET  /api/campaigns            — list (or use listCampaigns() server-side)
 * POST /api/campaigns            — create a campaign (draft or scheduled)
 * GET  /api/campaigns/audience   — count recipients for a given target
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import {
  createCampaign,
  countAudience,
  setCampaignRecipientsCount,
} from "@/server/campaigns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const createSchema = z.object({
  title: z.string().min(1).max(255),
  message: z.string().min(1).max(4096),
  targetType: z.enum(["all", "tag", "inactive_days"]),
  targetValue: z.string().optional(),
  templateName: z.string().optional(),
  scheduledAt: z.string().datetime().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const userId = Number((session.user as { id?: string }).id);
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ ok: false, error: "invalid session" }, { status: 401 });
  }

  const raw = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation", issues: parsed.error.issues }, { status: 400 });
  }
  const input = parsed.data;

  const id = await createCampaign({
    title: input.title,
    message: input.message,
    targetType: input.targetType,
    targetValue: input.targetValue,
    templateName: input.templateName,
    scheduledAt: input.scheduledAt ? new Date(input.scheduledAt) : undefined,
    createdBy: userId,
  });

  // Pre-calculate audience so the UI shows the recipient count immediately.
  const recipients = await countAudience({ type: input.targetType, value: input.targetValue });
  await setCampaignRecipientsCount(id, recipients);

  return NextResponse.json({ ok: true, id, recipients });
}

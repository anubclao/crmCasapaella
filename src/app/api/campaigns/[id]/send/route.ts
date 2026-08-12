/**
 * POST /api/campaigns/[id]/send
 * Promotes a draft (or scheduled-now-passed) campaign to `sending` and
 * triggers the first batch. The worker continues from there.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCampaign, setCampaignStatus } from "@/server/campaigns";
import { processCampaign } from "@/server/campaign-sender";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const cid = Number(id);
  if (!Number.isFinite(cid)) {
    return NextResponse.json({ ok: false, error: "invalid id" }, { status: 400 });
  }
  const campaign = await getCampaign(cid);
  if (!campaign) {
    return NextResponse.json({ ok: false, error: "not found" }, { status: 404 });
  }
  if (campaign.status !== "draft" && campaign.status !== "scheduled") {
    return NextResponse.json(
      { ok: false, error: `cannot send campaign in status: ${campaign.status}` },
      { status: 400 }
    );
  }
  await setCampaignStatus(cid, "sending");
  // Kick off the first batch synchronously so the user sees immediate
  // progress; the worker continues from there.
  const result = await processCampaign(cid, 5);
  return NextResponse.json({ ok: true, status: "sending", firstBatch: result });
}

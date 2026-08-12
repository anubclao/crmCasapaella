/**
 * POST /api/campaigns/[id]/cancel
 * Marks a campaign as cancelled. The worker checks this status before
 * each send and bails out cleanly.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getCampaign, setCampaignStatus } from "@/server/campaigns";

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
  if (campaign.status === "sent" || campaign.status === "cancelled") {
    return NextResponse.json(
      { ok: false, error: `cannot cancel campaign in status: ${campaign.status}` },
      { status: 400 }
    );
  }
  await setCampaignStatus(cid, "cancelled");
  return NextResponse.json({ ok: true, status: "cancelled" });
}

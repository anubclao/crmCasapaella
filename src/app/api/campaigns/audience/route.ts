/**
 * GET /api/campaigns/audience?type=all&value=...
 * Returns the count of recipients that match a given target spec.
 * Used by the campaign builder UI to show a live "X recipients" preview.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { countAudience } from "@/server/campaigns";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const type = url.searchParams.get("type") ?? "all";
  const value = url.searchParams.get("value") ?? undefined;
  if (type !== "all" && type !== "tag" && type !== "inactive_days") {
    return NextResponse.json({ ok: false, error: "invalid type" }, { status: 400 });
  }
  const count = await countAudience({ type, value: value ?? undefined });
  return NextResponse.json({ ok: true, count });
}

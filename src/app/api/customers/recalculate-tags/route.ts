/**
 * POST /api/customers/recalculate-tags
 * Triggers a full re-tag pass across all customers.
 * The daily cron does this automatically; this endpoint is the "Run now" button.
 */
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { recalculateAllTags } from "@/server/auto-tagging";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  if ((session.user as { role?: string }).role !== "admin") {
    return NextResponse.json({ ok: false, error: "solo admins" }, { status: 403 });
  }
  const result = await recalculateAllTags();
  return NextResponse.json({ ok: true, ...result });
}

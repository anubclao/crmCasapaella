/**
 * GET /api/customers?search=...&limit=20
 * Lightweight search for the typeahead in reservation/order forms.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listCustomers } from "@/server/customers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(req.url);
  const search = url.searchParams.get("search") ?? undefined;
  const limit = Math.min(50, Number(url.searchParams.get("limit") ?? 20));
  const rows = await listCustomers({ search, limit });
  return NextResponse.json({ ok: true, customers: rows });
}

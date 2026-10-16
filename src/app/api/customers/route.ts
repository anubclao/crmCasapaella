/**
 * GET  /api/customers?search=...&limit=20  — typeahead for reservation/order forms
 * POST /api/customers                      — create one customer (manager+)
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { authzErrorResponse, requireRole } from "@/lib/authz";
import { createCustomer, findCustomerByPhone, listCustomers } from "@/server/customers";
import { validateCustomerInput } from "@/server/customer-input";

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

export async function POST(req: NextRequest) {
  try {
    await requireRole("manager");
  } catch (e) {
    const r = authzErrorResponse(e);
    if (r) return NextResponse.json(r, { status: r.status });
    throw e;
  }

  const raw = await req.json().catch(() => null);
  const result = validateCustomerInput(raw ?? {});
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "Revisa los campos marcados", fieldErrors: result.errors }, { status: 400 });
  }

  const existing = await findCustomerByPhone(result.data.phone);
  if (existing) {
    return NextResponse.json(
      {
        ok: false,
        error: `Ya existe un cliente con ese WhatsApp: ${existing.name}`,
        fieldErrors: { phone: "Este WhatsApp ya está registrado" },
        existingId: existing.id,
      },
      { status: 409 }
    );
  }

  const id = await createCustomer(result.data, "manual");
  return NextResponse.json({ ok: true, id });
}

/**
 * PATCH /api/customers/:id — edit a customer (manager+).
 * The form sends the whole record; empty optional fields clear the value.
 */
import { NextRequest, NextResponse } from "next/server";
import { authzErrorResponse, requireRole } from "@/lib/authz";
import { findCustomerByPhone, getCustomer, updateCustomer } from "@/server/customers";
import { validateCustomerInput } from "@/server/customer-input";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireRole("manager");
  } catch (e) {
    const r = authzErrorResponse(e);
    if (r) return NextResponse.json(r, { status: r.status });
    throw e;
  }

  const id = Number((await params).id);
  if (!Number.isInteger(id) || !(await getCustomer(id))) {
    return NextResponse.json({ ok: false, error: "Cliente no encontrado" }, { status: 404 });
  }

  const raw = await req.json().catch(() => null);
  const result = validateCustomerInput(raw ?? {});
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: "Revisa los campos marcados", fieldErrors: result.errors }, { status: 400 });
  }

  const other = await findCustomerByPhone(result.data.phone);
  if (other && other.id !== id) {
    return NextResponse.json(
      {
        ok: false,
        error: `Ese WhatsApp ya pertenece a ${other.name}`,
        fieldErrors: { phone: "Este WhatsApp ya está registrado en otro cliente" },
        existingId: other.id,
      },
      { status: 409 }
    );
  }

  await updateCustomer(id, result.data);
  return NextResponse.json({ ok: true, id });
}

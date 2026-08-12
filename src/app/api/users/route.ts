/**
 * /api/users — list + create
 *
 * GET   /api/users         list (admin only)
 * POST  /api/users         create (admin only)
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { authzErrorResponse, requireRole } from "@/lib/authz";
import {
  createUser,
  generateTempPassword,
  getUserByEmail,
  hashPassword,
  listUsers,
} from "@/server/users";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireRole("admin");
  } catch (e) {
    const r = authzErrorResponse(e);
    if (r) return NextResponse.json(r, { status: r.status });
    throw e;
  }
  const users = await listUsers();
  return NextResponse.json({ ok: true, users });
}

const createSchema = z.object({
  email: z.string().email().max(255),
  name: z.string().min(1).max(255),
  role: z.enum(["admin", "manager", "staff"]),
});

export async function POST(req: NextRequest) {
  let admin;
  try {
    admin = await requireRole("admin");
  } catch (e) {
    const r = authzErrorResponse(e);
    if (r) return NextResponse.json(r, { status: r.status });
    throw e;
  }
  void admin;

  const raw = await req.json().catch(() => null);
  const parsed = createSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: "validation", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const existing = await getUserByEmail(parsed.data.email);
  if (existing) {
    return NextResponse.json(
      { ok: false, error: "email_already_exists" },
      { status: 409 },
    );
  }
  const tempPassword = generateTempPassword();
  const passwordHash = await hashPassword(tempPassword);
  const created = await createUser({ ...parsed.data, passwordHash });

  return NextResponse.json({
    ok: true,
    user: created,
    tempPassword, // shown once in the UI; admin shares it with the new user
  });
}

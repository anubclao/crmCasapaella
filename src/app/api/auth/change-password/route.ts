/**
 * POST /api/auth/change-password
 * Body: { currentPassword, newPassword }
 * Updates the authenticated user's password.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { query } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  const userId = (session.user as { id?: string }).id;
  if (!userId) {
    return NextResponse.json({ ok: false, error: "invalid session" }, { status: 401 });
  }

  const raw = await req.json().catch(() => null);
  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "validation" }, { status: 400 });
  }

  const rows = (await query("SELECT password_hash FROM users WHERE id = ? LIMIT 1", [Number(userId)])) as Array<{
    password_hash: string;
  }>;
  const user = rows[0];
  if (!user) {
    return NextResponse.json({ ok: false, error: "user not found" }, { status: 404 });
  }

  const ok = await bcrypt.compare(parsed.data.currentPassword, user.password_hash);
  if (!ok) {
    return NextResponse.json({ ok: false, error: "Contraseña actual incorrecta" }, { status: 400 });
  }

  const newHash = await bcrypt.hash(parsed.data.newPassword, 10);
  await query("UPDATE users SET password_hash = ? WHERE id = ?", [newHash, Number(userId)]);

  return NextResponse.json({ ok: true });
}

"use client";

import { signOut } from "next-auth/react";

export function Topbar({ userName, userEmail }: { userName?: string | null; userEmail?: string | null }) {
  return (
    <header className="bg-white border-b border-granate-100 px-8 py-4 flex items-center justify-between">
      <div>
        <h1 className="font-display text-2xl text-granate-800">Bienvenido{userName ? `, ${userName}` : ""}</h1>
        <p className="text-sm text-granate-700/60">Gestión de clientes y campañas de WhatsApp</p>
      </div>
      <div className="flex items-center gap-4">
        <div className="text-right">
          <div className="text-sm font-medium text-granate-800">{userName ?? "Staff"}</div>
          <div className="text-xs text-granate-700/60">{userEmail}</div>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="px-4 py-2 text-sm rounded-lg border border-granate-200 text-granate-700 hover:bg-granate-50 transition-colors"
        >
          Salir
        </button>
      </div>
    </header>
  );
}

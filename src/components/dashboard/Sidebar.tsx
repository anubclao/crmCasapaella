"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  {
    href: "/dashboard",
    label: "Resumen",
    icon: "📊",
    roles: ["admin", "manager", "staff"] as const,
  },
  {
    href: "/customers",
    label: "Clientes",
    icon: "👥",
    roles: ["admin", "manager", "staff"] as const,
  },
  {
    href: "/reservations",
    label: "Reservas",
    icon: "📅",
    roles: ["admin", "manager", "staff"] as const,
  },
  {
    href: "/orders",
    label: "Pedidos",
    icon: "🛵",
    roles: ["admin", "manager", "staff"] as const,
  },
  {
    href: "/campaigns",
    label: "Campañas",
    icon: "📣",
    roles: ["admin", "manager", "staff"] as const,
  },
  {
    href: "/messages",
    label: "Mensajes",
    icon: "💬",
    roles: ["admin", "manager", "staff"] as const,
  },
  {
    href: "/templates",
    label: "Plantillas",
    icon: "📝",
    roles: ["admin", "manager", "staff"] as const,
  },
  {
    href: "/whatsapp",
    label: "WhatsApp",
    icon: "📱",
    roles: ["admin", "manager"] as const,
  },
  { href: "/users", label: "Usuarios", icon: "👤", roles: ["admin"] as const },
  {
    href: "/settings",
    label: "Configuración",
    icon: "⚙️",
    roles: ["admin", "manager", "staff"] as const,
  },
];

export function Sidebar({ role }: { role: "admin" | "manager" | "staff" }) {
  const path = usePathname();
  return (
    <aside className="w-64 bg-carbon-100 text-crema-100 min-h-screen flex flex-col">
      <div className="px-6 py-6 border-b border-granate-900/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-granate-500 flex items-center justify-center overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/logoNew.png"
              alt="Casa Paella"
              className="w-full h-full object-cover"
            />
          </div>
          <div>
            <div className="font-display text-lg leading-tight">
              Casa Paella
            </div>
            <div className="text-xs text-crema-200/60">CRM</div>
          </div>
        </div>
      </div>
      <nav className="flex-1 py-4">
        {nav
          .filter((item) => (item.roles as readonly string[]).includes(role))
          .map((item) => {
            const active =
              path === item.href || path.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-6 py-2.5 text-sm transition-colors ${
                  active
                    ? "bg-granate-500/20 text-dorado-300 border-l-4 border-dorado-500"
                    : "text-crema-200/80 hover:bg-carbon-200 hover:text-crema-100"
                }`}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Link>
            );
          })}
      </nav>
      <div className="px-6 py-4 border-t border-granate-900/50 text-xs text-crema-200/40">
        v0.1.0 · {new Date().getFullYear()}
      </div>
    </aside>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Casa Paella — CRM",
  description: "Gestión de clientes y campañas de WhatsApp para Casa Paella",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

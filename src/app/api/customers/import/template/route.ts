/**
 * GET /api/customers/import/template — Excel template for the bulk import,
 * with an instructions sheet listing the valid pipeline stages.
 */
import { NextResponse } from "next/server";
import writeXlsxFile, { type SheetData } from "write-excel-file/node";
import { auth } from "@/lib/auth";
import { PIPELINE_STAGES } from "@/lib/pipeline";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEADER = { fontWeight: "bold", textColor: "#FFFFFF", backgroundColor: "#8B1A1F" } as const;

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });

  const headers = ["Nombres", "Apellidos", "WhatsApp", "Correo", "Fecha de nacimiento", "Estado"];
  const clientes: SheetData = [
    headers.map((value) => ({ value, ...HEADER })),
    [
      { value: "María José" },
      { value: "Gómez Pérez" },
      { value: "3001234567" },
      { value: "maria@ejemplo.com" },
      { value: new Date(Date.UTC(1990, 4, 23)), type: Date, format: "dd/mm/yyyy" },
      { value: "Nuevo" },
    ],
  ];

  const instrucciones: SheetData = [
    [{ value: "Campo", ...HEADER }, { value: "Obligatorio", ...HEADER }, { value: "Cómo llenarlo", ...HEADER }],
    [{ value: "Nombres" }, { value: "Sí" }, { value: "Uno o varios nombres. Solo letras." }],
    [{ value: "Apellidos" }, { value: "Sí" }, { value: "Uno o dos apellidos. Solo letras." }],
    [{ value: "WhatsApp" }, { value: "Sí" }, { value: "Celular de 10 dígitos (3001234567) o con indicativo (+57 300 123 4567). Si ya existe en el CRM, se actualiza ese cliente." }],
    [{ value: "Correo" }, { value: "No" }, { value: "nombre@dominio.com" }],
    [{ value: "Fecha de nacimiento" }, { value: "No" }, { value: "DD/MM/AAAA, por ejemplo 23/05/1990." }],
    [{ value: "Estado" }, { value: "No" }, { value: `Etapa del pipeline. Si se deja vacío: Nuevo. Valores: ${PIPELINE_STAGES.map((s) => s.label).join(", ")}.` }],
    [],
    [{ value: "Borra la fila de ejemplo antes de subir el archivo. Máximo 5000 clientes por archivo.", fontWeight: "bold" as const }],
  ];

  const buffer = await writeXlsxFile(
    [
      { sheet: "Clientes", data: clientes, columns: [{ width: 22 }, { width: 22 }, { width: 18 }, { width: 28 }, { width: 20 }, { width: 14 }], stickyRowsCount: 1 },
      { sheet: "Instrucciones", data: instrucciones, columns: [{ width: 22 }, { width: 13 }, { width: 90 }] },
    ]
  ).toBuffer();

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="plantilla-clientes.xlsx"',
    },
  });
}

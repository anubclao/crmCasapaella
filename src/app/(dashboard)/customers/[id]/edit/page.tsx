import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getCurrentRoleAsync, roleAtLeast } from "@/lib/authz";
import { birthDateISO, getCustomer } from "@/server/customers";
import { CustomerForm } from "@/components/customers/CustomerForm";

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const customerId = Number(id);
  if (!Number.isInteger(customerId)) notFound();
  if (!roleAtLeast(await getCurrentRoleAsync(), "manager")) redirect(`/customers/${customerId}`);
  const c = await getCustomer(customerId);
  if (!c) notFound();

  // Customers captured before names were split only have `name`: put it all
  // in Nombres so nothing is lost; staff completes Apellidos on first edit.
  const legacy = !c.first_name && !c.last_name;

  return (
    <div className="max-w-2xl">
      <Link href={`/customers/${c.id}`} className="text-sm text-granate-600 hover:underline">← Volver al cliente</Link>
      <h1 className="font-display text-3xl text-granate-800 mt-3 mb-1">Editar cliente</h1>
      <p className="text-sm text-granate-700/60 mb-6">
        {legacy ? "Este cliente se registró con el nombre completo en un solo campo: sepáralo en Nombres y Apellidos." : "Los campos con * son obligatorios."}
      </p>
      <CustomerForm
        customerId={c.id}
        initial={{
          firstName: legacy ? c.name : c.first_name ?? "",
          lastName: c.last_name ?? "",
          phone: c.phone,
          email: c.email ?? "",
          birthDate: birthDateISO(c.birth_date),
          stage: c.pipeline_stage,
          notes: c.notes ?? "",
        }}
      />
    </div>
  );
}

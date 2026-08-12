"use client";

import { useState, useTransition } from "react";

type UserRow = {
  id: number;
  email: string;
  name: string;
  role: "admin" | "manager" | "staff";
  is_active: number;
  created_at: string;
};

const ROLE_LABEL: Record<UserRow["role"], string> = {
  admin: "Admin",
  manager: "Manager",
  staff: "Staff",
};

const ROLE_BADGE: Record<UserRow["role"], string> = {
  admin: "bg-granate-100 text-granate-700 border border-granate-200",
  manager: "bg-dorado-100 text-dorado-700 border border-dorado-200",
  staff: "bg-crema-100 text-granate-700/70 border border-granate-100",
};

export function UsersClient({
  initialUsers,
  currentUserId,
}: {
  initialUsers: UserRow[];
  currentUserId: number;
}) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const r = await fetch("/api/users", { credentials: "same-origin" });
    if (r.ok) {
      const data = (await r.json()) as { users: UserRow[] };
      setUsers(data.users);
    }
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl text-granate-800">
            Usuarios y roles
          </h1>
          <p className="text-sm text-granate-700/60">
            Gestioná quién accede al CRM y qué puede hacer.
          </p>
        </div>
        <button
          onClick={() => {
            setError(null);
            setShowCreate(true);
          }}
          className="px-4 py-2 rounded-lg bg-granate-500 text-white font-medium shadow-warm hover:bg-granate-600"
        >
          + Nuevo usuario
        </button>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-granate-50 border border-granate-200 text-granate-700 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-2xl border border-granate-100 shadow-warm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-crema-100 border-b border-granate-100">
            <tr className="text-left text-granate-700">
              <th className="px-4 py-3 font-medium">Nombre</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Rol</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-12 text-center text-granate-700/60"
                >
                  Sin usuarios.
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-granate-50 hover:bg-crema-50"
                >
                  <td className="px-4 py-3 font-medium text-granate-800">
                    {u.name}
                    {u.id === currentUserId && (
                      <span className="ml-2 text-xs text-granate-700/50">
                        (vos)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-granate-700">{u.email}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-xs ${ROLE_BADGE[u.role]}`}
                    >
                      {ROLE_LABEL[u.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.is_active ? (
                      <span className="text-green-700 text-xs">● Activo</span>
                    ) : (
                      <span className="text-granate-700/50 text-xs">
                        ○ Desactivado
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <button
                        onClick={() => {
                          setError(null);
                          setEditingId(u.id);
                        }}
                        className="px-3 py-1 text-xs rounded border border-granate-200 text-granate-700 hover:bg-crema-50"
                      >
                        Editar
                      </button>
                      <ResetPasswordButton userId={u.id} onError={setError} />
                      {u.id !== currentUserId && (
                        <DisableButton
                          userId={u.id}
                          active={u.is_active === 1}
                          onDone={refresh}
                          onError={setError}
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="bg-crema-50 border border-granate-100 rounded-xl p-4 text-sm text-granate-700/80">
        <strong className="text-granate-800">Roles:</strong>
        <ul className="mt-2 space-y-1 list-disc list-inside">
          <li>
            <b>Admin</b> — todo el CRM + gestión de usuarios.
          </li>
          <li>
            <b>Manager</b> — editar clientes, plantillas, campañas; no gestiona
            usuarios.
          </li>
          <li>
            <b>Staff</b> — ver clientes y enviar mensajes manuales; no edita.
          </li>
        </ul>
      </div>

      {showCreate && (
        <CreateModal
          onClose={() => setShowCreate(false)}
          onCreated={async () => {
            setShowCreate(false);
            await refresh();
          }}
          onError={setError}
        />
      )}
      {editingId !== null && (
        <EditModal
          user={users.find((u) => u.id === editingId)!}
          currentUserId={currentUserId}
          onClose={() => setEditingId(null)}
          onSaved={async () => {
            setEditingId(null);
            await refresh();
          }}
          onError={setError}
        />
      )}
    </div>
  );
}

function inputCls() {
  return "w-full px-3 py-2 rounded-lg border border-granate-200 bg-white focus:outline-none focus:ring-2 focus:ring-dorado-400";
}

function CreateModal({
  onClose,
  onCreated,
  onError,
}: {
  onClose: () => void;
  onCreated: () => void | Promise<void>;
  onError: (e: string) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "manager" | "staff">("staff");
  const [busy, setBusy] = useState(false);
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    onError("");
    try {
      const r = await fetch("/api/users", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, role }),
      });
      const data = (await r.json()) as {
        ok: boolean;
        error?: string;
        tempPassword?: string;
      };
      if (!r.ok || !data.ok) {
        onError(
          data.error === "email_already_exists"
            ? "Ya existe un usuario con ese email."
            : (data.error ?? "Error al crear"),
        );
        return;
      }
      setTempPassword(data.tempPassword ?? null);
      startTransition(() => {
        void onCreated();
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} title="Nuevo usuario">
      {tempPassword ? (
        <div className="space-y-4">
          <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-sm">
            ✓ Usuario creado. Compartí esta contraseña temporal por WhatsApp (se
            muestra <b>una sola vez</b>):
          </div>
          <div className="p-4 rounded-lg bg-crema-100 border border-granate-200 text-center">
            <code className="text-lg font-mono text-granate-800 select-all">
              {tempPassword}
            </code>
          </div>
          <p className="text-xs text-granate-700/60">
            El usuario deberá cambiarla al iniciar sesión (o vos podés
            resetearla después desde esta misma pantalla).
          </p>
          <button
            onClick={onClose}
            className="w-full py-2 rounded-lg bg-granate-500 text-white font-medium hover:bg-granate-600"
          >
            Cerrar
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <Field label="Nombre">
            <input
              required
              className={inputCls()}
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={255}
            />
          </Field>
          <Field label="Email">
            <input
              required
              type="email"
              className={inputCls()}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={255}
            />
          </Field>
          <Field label="Rol">
            <select
              className={inputCls()}
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
            >
              <option value="staff">Staff (solo lectura + envío manual)</option>
              <option value="manager">
                Manager (edita clientes, campañas, plantillas)
              </option>
              <option value="admin">Admin (todo + gestión de usuarios)</option>
            </select>
          </Field>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-granate-200 text-granate-700"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={busy}
              className="px-4 py-2 text-sm rounded-lg bg-granate-500 text-white disabled:opacity-50"
            >
              {busy ? "Creando…" : "Crear usuario"}
            </button>
          </div>
        </form>
      )}
    </Modal>
  );
}

function EditModal({
  user,
  currentUserId,
  onClose,
  onSaved,
  onError,
}: {
  user: UserRow;
  currentUserId: number;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
  onError: (e: string) => void;
}) {
  const [name, setName] = useState(user.name);
  const [role, setRole] = useState<UserRow["role"]>(user.role);
  const [isActive, setIsActive] = useState(user.is_active === 1);
  const [busy, setBusy] = useState(false);
  const isSelf = user.id === currentUserId;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    onError("");
    try {
      const r = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, role, is_active: isActive ? 1 : 0 }),
      });
      const data = (await r.json()) as { ok: boolean; error?: string };
      if (!r.ok || !data.ok) {
        const map: Record<string, string> = {
          cannot_demote_or_disable_last_admin:
            "No podés degradar/desactivar al último admin activo.",
          not_found: "Usuario no encontrado.",
        };
        onError(map[data.error ?? ""] ?? data.error ?? "Error al guardar");
        return;
      }
      await onSaved();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} title={`Editar a ${user.name}`}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Nombre">
          <input
            required
            className={inputCls()}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={255}
          />
        </Field>
        <Field label="Rol">
          <select
            className={inputCls()}
            value={role}
            onChange={(e) => setRole(e.target.value as UserRow["role"])}
            disabled={isSelf}
          >
            <option value="staff">Staff</option>
            <option value="manager">Manager</option>
            <option value="admin">Admin</option>
          </select>
          {isSelf && (
            <p className="text-xs text-granate-700/60 mt-1">
              No podés cambiar tu propio rol.
            </p>
          )}
        </Field>
        <Field label="Estado">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              disabled={isSelf}
            />
            Activo (puede iniciar sesión)
          </label>
          {isSelf && (
            <p className="text-xs text-granate-700/60 mt-1">
              No podés desactivarte a vos mismo.
            </p>
          )}
        </Field>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-lg border border-granate-200 text-granate-700"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={busy}
            className="px-4 py-2 text-sm rounded-lg bg-granate-500 text-white disabled:opacity-50"
          >
            {busy ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ResetPasswordButton({
  userId,
  onError,
}: {
  userId: number;
  onError: (e: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [temp, setTemp] = useState<string | null>(null);

  async function go() {
    if (
      !confirm(
        "¿Resetear la contraseña de este usuario? Se generará una nueva contraseña temporal.",
      )
    )
      return;
    setBusy(true);
    onError("");
    try {
      const r = await fetch(`/api/users/${userId}/reset-password`, {
        method: "POST",
        credentials: "same-origin",
      });
      const data = (await r.json()) as {
        ok: boolean;
        error?: string;
        tempPassword?: string;
      };
      if (!r.ok || !data.ok) {
        onError(data.error ?? "Error al resetear");
        return;
      }
      setTemp(data.tempPassword ?? null);
    } finally {
      setBusy(false);
    }
  }

  if (temp) {
    return (
      <span
        className="text-xs font-mono text-granate-700 bg-crema-100 px-2 py-1 rounded select-all"
        title="Nueva contraseña temporal"
      >
        {temp}
      </span>
    );
  }
  return (
    <button
      onClick={go}
      disabled={busy}
      className="px-3 py-1 text-xs rounded border border-granate-200 text-granate-700 hover:bg-crema-50 disabled:opacity-50"
    >
      {busy ? "…" : "Reset pass"}
    </button>
  );
}

function DisableButton({
  userId,
  active,
  onDone,
  onError,
}: {
  userId: number;
  active: boolean;
  onDone: () => void | Promise<void>;
  onError: (e: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  async function go() {
    const msg = active
      ? "¿Desactivar este usuario? No podrá iniciar sesión."
      : "¿Reactivar este usuario?";
    if (!confirm(msg)) return;
    setBusy(true);
    onError("");
    try {
      const r = await fetch(`/api/users/${userId}`, {
        method: active ? "DELETE" : "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: active ? 0 : 1 }),
      });
      const data = (await r.json()) as { ok: boolean; error?: string };
      if (!r.ok || !data.ok) {
        const map: Record<string, string> = {
          cannot_disable_last_admin:
            "No podés desactivar al último admin activo.",
          not_found: "Usuario no encontrado.",
        };
        onError(map[data.error ?? ""] ?? data.error ?? "Error");
        return;
      }
      await onDone();
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      onClick={go}
      disabled={busy}
      className={`px-3 py-1 text-xs rounded border ${
        active
          ? "border-granate-300 text-granate-700 hover:bg-granate-50"
          : "border-green-300 text-green-700 hover:bg-green-50"
      } disabled:opacity-50`}
    >
      {busy ? "…" : active ? "Desactivar" : "Reactivar"}
    </button>
  );
}

function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl border border-granate-100 shadow-warm-lg w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display text-xl text-granate-800">{title}</h2>
          <button
            onClick={onClose}
            className="text-granate-700/60 hover:text-granate-800 text-xl leading-none"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="text-sm font-medium text-granate-800 mb-1">{label}</div>
      {children}
    </label>
  );
}

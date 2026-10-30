import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth/session";
import { ROLE_LABEL, type Role } from "@/lib/auth/roles";
import { cambiarRol } from "./actions";

export const metadata = { title: "Usuarios · Inspecciones MLP" };

export default async function UsuariosPage() {
  const session = await getSession();
  const supabase = await createClient();
  const { data: perfiles } = await supabase
    .from("profiles")
    .select("id, full_name, role, created_at")
    .order("created_at", { ascending: true });

  return (
    <section className="rounded-2xl border border-hair bg-white">
      <div className="border-b border-hair px-5 py-4">
        <h1 className="text-xl font-bold tracking-tight">Usuarios y roles</h1>
        <p className="text-sm text-sub">Solo un supervisor puede asignar roles. Las cuentas nuevas parten como técnico.</p>
      </div>
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left font-mono text-xs uppercase tracking-[0.06em] text-sub">
            <th className="px-5 py-2 font-medium">Nombre</th>
            <th className="px-5 py-2 font-medium">Rol</th>
            <th className="px-5 py-2 font-medium">Cambiar a</th>
          </tr>
        </thead>
        <tbody>
          {(perfiles ?? []).map((p) => {
            const role = p.role as Role;
            const otro: Role = role === "supervisor" ? "technician" : "supervisor";
            const propio = p.id === session?.id;
            return (
              <tr key={p.id} className="border-t border-hair">
                <td className="px-5 py-3 font-medium">{p.full_name || "Sin nombre"}</td>
                <td className="px-5 py-3">{ROLE_LABEL[role]}</td>
                <td className="px-5 py-3">
                  {propio ? (
                    <span className="text-sub">Su propia cuenta</span>
                  ) : (
                    <form action={cambiarRol}>
                      <input type="hidden" name="userId" value={p.id} />
                      <input type="hidden" name="role" value={otro} />
                      <button
                        type="submit"
                        className="rounded-lg border border-graf px-3 py-1.5 font-semibold hover:bg-paper focus-visible:outline-2 focus-visible:outline-cu"
                      >
                        {ROLE_LABEL[otro]}
                      </button>
                    </form>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

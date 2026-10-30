"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/auth/session";

const entrada = z.object({
  userId: z.string().uuid(),
  role: z.enum(["technician", "supervisor"]),
});

/**
 * Asigna un rol. Solo un supervisor puede hacerlo: lo exigen esta barrera, la policy de RLS
 * y el trigger guard_profile_role en la base de datos.
 */
export async function cambiarRol(formData: FormData) {
  const session = await requireRole("supervisor");
  const parsed = entrada.safeParse({ userId: formData.get("userId"), role: formData.get("role") });
  if (!parsed.success) return;
  // Evita que un supervisor se quite el acceso a sí mismo y deje el sistema sin supervisores.
  if (parsed.data.userId === session.id) return;

  const supabase = await createClient();
  await supabase.from("profiles").update({ role: parsed.data.role }).eq("id", parsed.data.userId);
  revalidatePath("/supervisor/usuarios");
}

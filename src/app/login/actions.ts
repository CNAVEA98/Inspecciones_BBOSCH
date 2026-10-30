"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { homeFor, safeNext, type Role } from "@/lib/auth/roles";

export type FormState = { error?: string; ok?: string } | undefined;

const credenciales = z.object({
  email: z.string().trim().email("Ingrese un correo válido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
});

const registro = credenciales.extend({
  fullName: z.string().trim().min(2, "Ingrese su nombre completo").max(80),
});

export async function iniciarSesion(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = credenciales.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error || !data.user) return { error: "Correo o contraseña incorrectos" };

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).single();
  const role = (profile?.role ?? "technician") as Role;
  const next = safeNext(String(formData.get("next") ?? ""));
  // Un destino de otra área se corrige por rol en el proxy.
  redirect(next ?? homeFor(role));
}

/** El registro crea siempre un técnico: el rol nunca viene del formulario. */
export async function registrarse(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = registro.safeParse({
    fullName: formData.get("fullName"),
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: { data: { full_name: parsed.data.fullName } },
  });
  if (error) return { error: "No se pudo crear la cuenta. Verifique los datos o intente iniciar sesión." };
  if (data.session) redirect("/tecnico");
  return { ok: "Cuenta creada. Revise su correo para confirmarla y luego inicie sesión." };
}

export async function cerrarSesion() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}

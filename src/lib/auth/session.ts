import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { homeFor, type Role } from "./roles";

export interface SessionProfile {
  id: string;
  email: string;
  fullName: string;
  role: Role;
}

/** Usuario verificado + perfil (el rol viene de la tabla profiles, nunca del cliente). */
export const getSession = cache(async (): Promise<SessionProfile | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .single();
  if (!profile) return null;
  return {
    id: user.id,
    email: user.email ?? "",
    fullName: profile.full_name || user.email || "Usuario",
    role: profile.role as Role,
  };
});

/** Barrera de autorización de los layouts: segunda línea tras el proxy, antes de RLS. */
export async function requireRole(role: Role): Promise<SessionProfile> {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== role) redirect(homeFor(session.role));
  return session;
}

export type Role = "technician" | "supervisor";

export const homeFor = (role: Role) => (role === "supervisor" ? "/supervisor" : "/tecnico");

/** Solo se aceptan rutas internas de las áreas protegidas como destino posterior al login. */
export function safeNext(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  return next.startsWith("/tecnico") || next.startsWith("/supervisor") ? next : null;
}

export const ROLE_LABEL: Record<Role, string> = {
  technician: "Técnico",
  supervisor: "Supervisor",
};

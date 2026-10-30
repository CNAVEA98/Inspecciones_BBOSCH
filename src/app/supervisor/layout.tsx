import Link from "next/link";
import { requireRole } from "@/lib/auth/session";
import { SignOutButton } from "@/components/shared/sign-out-button";

/** Área del supervisor: desktop-first, densa, navegable por teclado. */
export default async function SupervisorLayout({ children }: { children: React.ReactNode }) {
  const session = await requireRole("supervisor");
  const link =
    "rounded-lg px-3 py-2 text-sm font-semibold text-[#c9d0d6] hover:bg-graf-2 hover:text-white focus-visible:outline-2 focus-visible:outline-cu";
  return (
    <div className="min-h-[100dvh]">
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 bg-graf px-6 py-3 text-white">
        <span className="font-mono text-xs uppercase tracking-[0.12em] text-[#9aa4ad]">Inspecciones MLP</span>
        <nav aria-label="Principal" className="flex gap-1">
          <Link href="/supervisor" className={link}>
            Bandeja
          </Link>
          <Link href="/supervisor/usuarios" className={link}>
            Usuarios
          </Link>
        </nav>
        <span className="ml-auto text-sm text-[#c9d0d6]">{session.fullName}</span>
        <SignOutButton className="min-h-9 !px-3 text-sm text-white" />
      </header>
      <main className="mx-auto w-full max-w-[1400px] px-6 py-6">{children}</main>
    </div>
  );
}

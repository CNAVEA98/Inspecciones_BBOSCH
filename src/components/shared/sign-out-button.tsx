import { cerrarSesion } from "@/app/login/actions";

export function SignOutButton({ className = "" }: { className?: string }) {
  return (
    <form action={cerrarSesion}>
      <button
        type="submit"
        className={
          "min-h-12 rounded-xl border-[1.5px] border-current px-4 text-base font-semibold transition-transform active:scale-[0.98] " +
          className
        }
      >
        Salir
      </button>
    </form>
  );
}

"use client";

import { useActionState, useState } from "react";
import { iniciarSesion, registrarse, type FormState } from "./actions";

const campo =
  "min-h-14 w-full rounded-xl border-[1.5px] border-[#8f897e] bg-white px-4 text-lg text-graf " +
  "placeholder:text-sub focus:border-cu focus:outline-3 focus:outline-offset-1 focus:outline-cu/40";

function Mensaje({ state }: { state: FormState }) {
  if (!state?.error && !state?.ok) return null;
  const error = Boolean(state.error);
  return (
    <p
      role={error ? "alert" : "status"}
      className={
        "rounded-xl px-4 py-3 text-base font-medium " +
        (error ? "border border-[#bb0000] bg-[#fdecec] text-[#7a0000]" : "border border-[#1d7a46] bg-[#e1f2e8] text-[#0b4a28]")
      }
    >
      {state.error ?? state.ok}
    </p>
  );
}

export function LoginForm({ next }: { next?: string }) {
  const [modo, setModo] = useState<"entrar" | "crear">("entrar");
  const [loginState, loginAction, entrando] = useActionState(iniciarSesion, undefined);
  const [signupState, signupAction, creando] = useActionState(registrarse, undefined);

  const crear = modo === "crear";
  return (
    <div className="w-full max-w-md">
      <div role="tablist" aria-label="Acceso" className="mb-8 grid grid-cols-2 rounded-xl bg-[#ebe8e1] p-1">
        {(["entrar", "crear"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={modo === m}
            onClick={() => setModo(m)}
            className={
              "min-h-12 rounded-[10px] text-base font-semibold transition-colors " +
              (modo === m ? "bg-white text-graf shadow-[0_1px_2px_rgb(20_24_29/0.12)]" : "text-sub hover:text-graf")
            }
          >
            {m === "entrar" ? "Ingresar" : "Crear cuenta"}
          </button>
        ))}
      </div>

      <form action={crear ? signupAction : loginAction} className="flex flex-col gap-5" noValidate>
        {!crear && next ? <input type="hidden" name="next" value={next} /> : null}

        {crear ? (
          <div className="flex flex-col gap-2">
            <label htmlFor="fullName" className="text-sm font-semibold text-graf">
              Nombre completo
            </label>
            <input id="fullName" name="fullName" autoComplete="name" required className={campo} />
          </div>
        ) : null}

        <div className="flex flex-col gap-2">
          <label htmlFor="email" className="text-sm font-semibold text-graf">
            Correo electrónico
          </label>
          <input id="email" name="email" type="email" autoComplete="email" inputMode="email" required className={campo} />
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="password" className="text-sm font-semibold text-graf">
            Contraseña
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete={crear ? "new-password" : "current-password"}
            minLength={8}
            required
            aria-describedby="password-ayuda"
            className={campo}
          />
          <p id="password-ayuda" className="text-sm text-sub">
            Mínimo 8 caracteres.
          </p>
        </div>

        <Mensaje state={crear ? signupState : loginState} />

        <button
          type="submit"
          disabled={entrando || creando}
          className="min-h-14 rounded-xl bg-graf px-6 text-lg font-semibold text-white transition-transform hover:bg-graf-2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cu active:scale-[0.98] disabled:opacity-60"
        >
          {entrando || creando ? "Procesando" : crear ? "Crear cuenta" : "Ingresar"}
        </button>

        {crear ? (
          <p className="text-sm text-sub">
            Las cuentas nuevas son de técnico. Un supervisor puede cambiar el rol después.
          </p>
        ) : null}
      </form>
    </div>
  );
}

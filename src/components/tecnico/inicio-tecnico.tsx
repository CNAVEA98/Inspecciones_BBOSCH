"use client";

import Link from "next/link";
import { useTecnico } from "./tecnico-provider";
import { useLive } from "@/lib/tecnico/hooks";
import type { DraftRecord } from "@/lib/offline/db";
import { formatFechaHora } from "@/lib/fecha";

const ESTADO: Record<DraftRecord["state"], { texto: string; clase: string }> = {
  draft: { texto: "En curso", clase: "bg-cu-soft text-[#7a3d12]" },
  queued: { texto: "En cola de envío", clase: "bg-[#f1f0ec] text-graf" },
  sent: { texto: "Enviada", clase: "bg-[#e1f2e8] text-[#0b4a28]" },
};

export function InicioTecnico() {
  const { db, userId, catalog } = useTecnico();
  const borradores = useLive(
    () => db.drafts.where("technicianId").equals(userId).reverse().sortBy("updatedAt"),
    userId,
    [] as DraftRecord[],
  );

  const nombre = (lista: { id: string; name: string }[] | undefined, id: string) =>
    lista?.find((x) => x.id === id)?.name ?? "";

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/tecnico/nueva"
        className="flex min-h-16 items-center justify-center rounded-2xl bg-graf px-6 text-xl font-semibold text-white transition-transform hover:bg-graf-2 focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-cu active:scale-[0.98]"
      >
        Nueva inspección
      </Link>

      <section aria-labelledby="titulo-lista">
        <h1 id="titulo-lista" className="mb-3 text-2xl font-bold tracking-tight">
          Mis inspecciones
        </h1>
        {borradores.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-[#9a9488] bg-white p-6 text-lg text-sub">
            Aún no tiene inspecciones en este equipo. Toque &quot;Nueva inspección&quot; para empezar.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {borradores.map((d) => {
              const e = ESTADO[d.state];
              const equipo = nombre(catalog.catalog?.equipmentTypes, d.equipmentTypeId);
              const area = nombre(catalog.catalog?.areas, d.areaId);
              const contenido = (
                <>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-lg font-semibold">{d.header.tag || equipo || "Inspección"}</p>
                    <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-semibold ${e.clase}`}>{e.texto}</span>
                  </div>
                  <p className="mt-1 text-base text-sub">{[area, equipo].filter(Boolean).join(" · ")}</p>
                  <p className="mt-1 font-mono text-sm text-sub">
                    {d.folio ? `${d.folio} · ` : ""}
                    {formatFechaHora(d.updatedAt)}
                  </p>
                </>
              );
              const clase = "block rounded-2xl border border-hair bg-white p-4";
              return (
                <li key={d.id}>
                  {d.state === "draft" ? (
                    <Link href={`/tecnico/inspeccion/${d.id}`} className={`${clase} hover:border-graf focus-visible:outline-3 focus-visible:outline-cu`}>
                      {contenido}
                    </Link>
                  ) : (
                    <div className={clase}>{contenido}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

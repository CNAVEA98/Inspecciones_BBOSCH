"use client";

import { useRef, useState } from "react";
import { useTecnico } from "./tecnico-provider";
import { useLive, useObjectUrl } from "@/lib/tecnico/hooks";
import { deletePhoto, savePhoto } from "@/lib/tecnico/photos";

function Miniatura({ id, onRemove }: { id: string; onRemove: () => void }) {
  const { db } = useTecnico();
  const rec = useLive(() => db.photos.get(id), id, undefined);
  const url = useObjectUrl(rec?.blob);
  return (
    <span className="relative h-16 w-16 overflow-hidden rounded-xl border border-hair bg-[#f1f0ec]">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Foto adjunta" className="h-full w-full object-cover" />
      ) : null}
      <button
        type="button"
        aria-label="Quitar foto"
        onClick={onRemove}
        className="absolute right-0.5 top-0.5 grid size-6 place-items-center rounded-full bg-graf/80 text-sm leading-none text-white"
      >
        ×
      </button>
    </span>
  );
}

/** Adjunta fotos (cámara del teléfono): se comprimen y quedan guardadas en el equipo. */
export function PhotoField({
  inspectionId,
  ids,
  max,
  onChange,
}: {
  inspectionId: string;
  ids: string[];
  max: number;
  onChange: (ids: string[]) => void;
}) {
  const { db, userId } = useTecnico();
  const input = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string>();
  const [ocupado, setOcupado] = useState(false);

  const agregar = async (files: FileList | null) => {
    if (!files?.length) return;
    setOcupado(true);
    setError(undefined);
    try {
      const nuevos: string[] = [];
      for (const f of Array.from(files).slice(0, max - ids.length)) {
        nuevos.push(await savePhoto(db, userId, inspectionId, f));
      }
      onChange([...ids, ...nuevos]);
    } catch {
      setError("No se pudo guardar la foto. Intente de nuevo.");
    } finally {
      setOcupado(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      {ids.map((id) => (
        <Miniatura
          key={id}
          id={id}
          onRemove={() => {
            void deletePhoto(db, id);
            onChange(ids.filter((x) => x !== id));
          }}
        />
      ))}
      {ids.length < max ? (
        <>
          <button
            type="button"
            disabled={ocupado}
            onClick={() => input.current?.click()}
            className="min-h-14 rounded-xl border-[1.5px] border-dashed border-[#6f695f] bg-[#faf8f4] px-5 text-base font-semibold hover:border-cu hover:bg-cu-soft disabled:opacity-60"
          >
            {ocupado ? "Guardando" : ids.length ? "Agregar otra foto" : "Tomar foto"}
          </button>
          <input
            ref={input}
            type="file"
            accept="image/*"
            capture="environment"
            multiple={max > 1}
            hidden
            onChange={(e) => void agregar(e.target.files)}
          />
        </>
      ) : null}
      {error ? (
        <p role="alert" className="w-full text-sm font-medium text-[#7a0000]">
          {error}
        </p>
      ) : null}
    </div>
  );
}

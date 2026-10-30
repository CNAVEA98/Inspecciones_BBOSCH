"use client";

import { liveQuery } from "dexie";
import { useEffect, useRef, useState } from "react";

/** Suscribe un componente a una consulta de Dexie (se actualiza sola cuando cambia la base local). */
export function useLive<T>(query: () => Promise<T> | T, key: string, initial: T): T {
  const [value, setValue] = useState<T>(initial);
  const queryRef = useRef(query);
  useEffect(() => {
    queryRef.current = query;
  });
  useEffect(() => {
    const sub = liveQuery(() => queryRef.current()).subscribe({
      next: (v) => setValue(v),
      error: () => {},
    });
    return () => sub.unsubscribe();
  }, [key]);
  return value;
}

/** URL temporal para mostrar un Blob (se libera al desmontar). */
export function useObjectUrl(blob: Blob | undefined): string | undefined {
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return;
    const u = URL.createObjectURL(blob);
    const t = setTimeout(() => setUrl(u), 0);
    return () => {
      clearTimeout(t);
      URL.revokeObjectURL(u);
    };
  }, [blob]);
  return blob ? url : undefined;
}

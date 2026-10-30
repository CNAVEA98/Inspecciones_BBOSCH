const ZONA = "America/Santiago";

/** Fecha y hora en horario de Chile, p. ej. "17-10-2026 09:45". */
export function formatFechaHora(ms: number | string | Date): string {
  const d = new Date(ms);
  const f = new Intl.DateTimeFormat("es-CL", {
    timeZone: ZONA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(d);
  const p = Object.fromEntries(f.map((x) => [x.type, x.value]));
  return `${p.day}-${p.month}-${p.year} ${p.hour}:${p.minute}`;
}

/** Fecha de hoy (Chile) en formato ISO yyyy-mm-dd, para inputs type="date". */
export function hoyIso(): string {
  const p = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: ZONA, year: "numeric", month: "2-digit", day: "2-digit" })
      .formatToParts(new Date())
      .map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}

import type { MlpDB, OutboxRecord, PhotoRecord, SubmitPayload } from "./db";

/**
 * Error de transporte. `retryable=false` (p. ej. datos rechazados por el servidor) deja la entrada
 * en estado "failed" hasta que el usuario actúe; `retryable=true` (sin red, 5xx, sesión vencida) reintenta.
 */
export class TransportError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = "TransportError";
  }
}

export interface SubmitResult {
  id: string;
  folio: string | null;
  status: string;
  duplicate: boolean;
}

/** Operaciones remotas; en producción las implementa Supabase, en tests un servidor simulado. */
export interface Transport {
  /** Debe ser idempotente: subir dos veces la misma ruta no es un error. */
  uploadPhoto(photo: PhotoRecord): Promise<void>;
  /** Idempotente por inspection.id (la RPC devuelve duplicate=true si ya se envió). */
  submit(payload: SubmitPayload): Promise<SubmitResult>;
}

export const MAX_ATTEMPTS = 12;
const BASE_MS = 2_000;
const CAP_MS = 5 * 60_000;

/** Espera antes del reintento n (1-based): 2 s, 4 s, 8 s … con tope de 5 min. */
export function backoffMs(attempts: number): number {
  return Math.min(CAP_MS, BASE_MS * 2 ** Math.max(0, attempts - 1));
}

export interface EnqueueInput {
  payload: SubmitPayload;
  photoIds: string[];
}

/** Encola una inspección. Es idempotente: repetir el mismo id no crea otra entrada ni resetea los intentos. */
export async function enqueueSubmission(db: MlpDB, input: EnqueueInput, now = Date.now()): Promise<void> {
  const id = input.payload.inspection.id;
  await db.transaction("rw", db.outbox, db.drafts, async () => {
    const existing = await db.outbox.get(id);
    if (!existing) {
      const record: OutboxRecord = {
        id,
        payload: input.payload,
        photoIds: input.photoIds,
        status: "pending",
        attempts: 0,
        nextAttemptAt: now,
        createdAt: now,
      };
      await db.outbox.add(record);
    }
    await db.drafts.update(id, { state: "queued" });
  });
}

/** Reactiva una entrada fallida (acción explícita del usuario). */
export async function retryNow(db: MlpDB, id: string, now = Date.now()): Promise<void> {
  await db.outbox.update(id, { status: "pending", nextAttemptAt: now, attempts: 0, lastError: undefined });
}

export interface ProcessOptions {
  now?: () => number;
  /** Si es false no se intenta nada (sin red). */
  isOnline?: () => boolean;
}

export interface ProcessSummary {
  sent: string[];
  retry: string[];
  failed: string[];
  skipped: boolean;
}

// Evita dos pasadas simultáneas sobre la misma base (doble envío por eventos "online" repetidos).
const running = new WeakMap<MlpDB, Promise<ProcessSummary>>();

/** Procesa las entradas vencidas en orden de creación. Seguro de llamar varias veces a la vez. */
export function processOutbox(db: MlpDB, transport: Transport, opts: ProcessOptions = {}): Promise<ProcessSummary> {
  const current = running.get(db);
  if (current) return current;
  const run = doProcess(db, transport, opts).finally(() => running.delete(db));
  running.set(db, run);
  return run;
}

async function doProcess(db: MlpDB, transport: Transport, opts: ProcessOptions): Promise<ProcessSummary> {
  const now = opts.now ?? Date.now;
  const summary: ProcessSummary = { sent: [], retry: [], failed: [], skipped: false };

  if (opts.isOnline && !opts.isOnline()) {
    summary.skipped = true;
    return summary;
  }

  // Un envío que quedó "sending" por un cierre de la app se considera pendiente.
  await db.outbox.where("status").equals("sending").modify({ status: "pending" });

  const due = (await db.outbox.where("status").equals("pending").sortBy("createdAt")).filter(
    (e) => e.nextAttemptAt <= now(),
  );

  for (const entry of due) {
    await db.outbox.update(entry.id, { status: "sending" });
    try {
      await sendOne(db, transport, entry);
      await db.transaction("rw", db.outbox, db.drafts, async () => {
        await db.outbox.delete(entry.id);
        await db.drafts.update(entry.id, { state: "sent" });
      });
      summary.sent.push(entry.id);
    } catch (err) {
      const retryable = !(err instanceof TransportError) || err.retryable;
      const attempts = entry.attempts + 1;
      const message = err instanceof Error ? err.message : String(err);
      if (!retryable || attempts >= MAX_ATTEMPTS) {
        await db.outbox.update(entry.id, { status: "failed", attempts, lastError: message });
        summary.failed.push(entry.id);
      } else {
        await db.outbox.update(entry.id, {
          status: "pending",
          attempts,
          lastError: message,
          nextAttemptAt: now() + backoffMs(attempts),
        });
        summary.retry.push(entry.id);
        // Sin red todo lo demás fallaría igual: se corta la pasada y se reintenta luego.
        if (err instanceof TransportError && err.retryable) break;
      }
    }
  }
  return summary;
}

async function sendOne(db: MlpDB, transport: Transport, entry: OutboxRecord): Promise<void> {
  // 1) Fotos: primero al Storage (la ruta ya está fijada, así que reintentar no duplica).
  for (const photoId of entry.photoIds) {
    const photo = await db.photos.get(photoId);
    if (!photo) continue; // ya subida y limpiada, o descartada
    if (!photo.uploaded) {
      await transport.uploadPhoto(photo);
      await db.photos.update(photoId, { uploaded: true });
    }
  }
  // 2) Inspección completa en una sola RPC transaccional.
  const res = await transport.submit(entry.payload);
  if (res.folio) await db.drafts.update(entry.id, { folio: res.folio });
  // 3) Liberar el espacio de las fotos ya confirmadas.
  await db.photos.bulkDelete(entry.photoIds);
}

export type SyncState = "synced" | "pending" | "syncing" | "offline" | "attention";

export interface SyncSnapshot {
  state: SyncState;
  pending: number;
  failed: number;
}

/** Estado para el indicador visible de sincronización. */
export async function getSyncSnapshot(db: MlpDB, online: boolean, syncing = false): Promise<SyncSnapshot> {
  const entries = await db.outbox.toArray();
  const failed = entries.filter((e) => e.status === "failed").length;
  const pending = entries.length - failed;
  let state: SyncState = "synced";
  if (failed) state = "attention";
  else if (!online && pending) state = "offline";
  else if (syncing) state = "syncing";
  else if (pending) state = "pending";
  else if (!online) state = "offline";
  return { state, pending, failed };
}

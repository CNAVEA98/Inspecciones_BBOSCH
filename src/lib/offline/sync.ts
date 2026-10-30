import type { MlpDB } from "./db";
import { getSyncSnapshot, processOutbox, type SyncSnapshot, type Transport } from "./outbox";

const POLL_MS = 30_000;

/**
 * Orquesta la sincronización: al volver la red, al encolar y cada 30 s. Expone el estado
 * para el indicador visible de sincronización (useSyncExternalStore en la UI).
 */
export class SyncController {
  private listeners = new Set<() => void>();
  private snapshot: SyncSnapshot = { state: "synced", pending: 0, failed: 0 };
  private syncing = false;
  private timer: ReturnType<typeof setInterval> | undefined;

  constructor(
    private readonly db: MlpDB,
    private readonly transport: Transport,
    private readonly isOnline: () => boolean = () => (typeof navigator === "undefined" ? true : navigator.onLine),
  ) {}

  getSnapshot = () => this.snapshot;

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private async refresh() {
    this.snapshot = await getSyncSnapshot(this.db, this.isOnline(), this.syncing);
    this.listeners.forEach((l) => l());
  }

  /** Intenta enviar lo pendiente ahora. */
  async syncNow() {
    if (this.syncing) return;
    this.syncing = true;
    await this.refresh();
    try {
      await processOutbox(this.db, this.transport, { isOnline: this.isOnline });
    } finally {
      this.syncing = false;
      await this.refresh();
    }
  }

  /** Llamar tras encolar: actualiza el indicador y envía si hay red. */
  async notifyQueued() {
    await this.refresh();
    void this.syncNow();
  }

  start() {
    const onChange = () => void (this.isOnline() ? this.syncNow() : this.refresh());
    window.addEventListener("online", onChange);
    window.addEventListener("offline", onChange);
    this.timer = setInterval(() => void this.syncNow(), POLL_MS);
    void this.syncNow();
    return () => {
      window.removeEventListener("online", onChange);
      window.removeEventListener("offline", onChange);
      if (this.timer) clearInterval(this.timer);
    };
  }
}

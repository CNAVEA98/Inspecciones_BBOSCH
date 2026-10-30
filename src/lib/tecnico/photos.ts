import type { MlpDB } from "@/lib/offline/db";
import { compressImage } from "@/lib/offline/compress";
import { photoPath } from "./draft";

/** Comprime y guarda una foto en el equipo. Devuelve su id (UUID generado en el cliente). */
export async function savePhoto(db: MlpDB, userId: string, inspectionId: string, file: Blob): Promise<string> {
  const blob = await compressImage(file);
  const id = crypto.randomUUID();
  await db.photos.add({
    id,
    inspectionId,
    blob,
    mime: blob.type || "image/jpeg",
    sizeBytes: blob.size,
    storagePath: photoPath(userId, inspectionId, id, "jpg"),
    uploaded: false,
  });
  return id;
}

/** Guarda la firma dibujada (PNG, sin recomprimir). */
export async function saveSignature(db: MlpDB, userId: string, inspectionId: string, png: Blob): Promise<string> {
  const id = crypto.randomUUID();
  await db.photos.add({
    id,
    inspectionId,
    blob: png,
    mime: "image/png",
    sizeBytes: png.size,
    storagePath: photoPath(userId, inspectionId, id, "png"),
    uploaded: false,
  });
  return id;
}

export async function deletePhoto(db: MlpDB, id: string): Promise<void> {
  await db.photos.delete(id);
}

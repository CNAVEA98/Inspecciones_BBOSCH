import { z } from "zod";

const idSchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]*$/, "El id debe ser snake_case (a-z, 0-9, _)");

/** Estados de la nomenclatura de inspección del estándar. */
export const ESTADOS = ["BN", "ML", "NT", "NA", "NR"] as const;
export type Estado = (typeof ESTADOS)[number];

const baseItem = {
  id: idSchema,
  label: z.string().min(1),
  help: z.string().optional(),
};

/**
 * Ítem de verificación del estándar: estado BN/ML/NT/NA/NR, valor medido opcional con unidad,
 * observación y fotos. ML exige observación; NR exige motivo; la foto es opcional (se valida en validateAnswer).
 */
export const verificationItemSchema = z.object({
  ...baseItem,
  type: z.literal("verificacion"),
  /** Si está definido, el ítem pide un valor numérico (unit "" = sin unidad). */
  unit: z.string().optional(),
  min: z.number().optional(),
  max: z.number().optional(),
});

export const numberItemSchema = z
  .object({
    ...baseItem,
    required: z.boolean().default(true),
    type: z.literal("number"),
    unit: z.string().min(1),
    min: z.number().optional(),
    max: z.number().optional(),
  })
  .refine((v) => v.min === undefined || v.max === undefined || v.min <= v.max, {
    message: "min no puede ser mayor que max",
    path: ["min"],
  });

export const textItemSchema = z.object({
  ...baseItem,
  required: z.boolean().default(true),
  type: z.literal("text"),
  multiline: z.boolean().default(false),
});

export const photoItemSchema = z.object({
  ...baseItem,
  required: z.boolean().default(true),
  type: z.literal("photo"),
  maxPhotos: z.number().int().min(1).max(10).default(1),
});

export const nameplateItemSchema = z
  .object({
    ...baseItem,
    required: z.boolean().default(true),
    type: z.literal("nameplate"),
    fields: z
      .array(z.object({ key: idSchema, label: z.string().min(1), unit: z.string().optional() }))
      .min(1),
  })
  .refine((v) => new Set(v.fields.map((f) => f.key)).size === v.fields.length, {
    message: "Las claves de la placa deben ser únicas",
    path: ["fields"],
  });

export const itemSchema = z.discriminatedUnion("type", [
  verificationItemSchema,
  numberItemSchema,
  textItemSchema,
  photoItemSchema,
  nameplateItemSchema,
]);

export const sectionSchema = z.object({
  id: idSchema,
  title: z.string().min(1),
  items: z.array(itemSchema).min(1),
});

/** Campo de cabecera del formulario (TAG, OT, ubicación, etc.). */
export const headerFieldSchema = z.object({
  key: idSchema,
  label: z.string().min(1),
  input: z.enum(["text", "date", "time", "number"]).default("text"),
  options: z.array(z.string()).optional(),
  required: z.boolean().default(true),
});

/** Lectura destacada del informe (instrumento): referencia ítems por id. */
export const readingSchema = z.object({
  label: z.string().min(1),
  item: idSchema,
  /** Ítem con el máximo registrado y límite del equipo, para dibujar la barra. */
  maxItem: idSchema.optional(),
  limit: z.number().optional(),
});

export const templateSchema = z
  .object({
    title: z.string().min(1),
    note: z.string().optional(),
    meta: z
      .object({ norma: z.string().min(1), revision: z.string().min(1), titulo: z.string().min(1) })
      .optional(),
    nomenclature: z.string().optional(),
    header: z.array(headerFieldSchema).default([]),
    roles: z.array(z.string().min(1)).default([]),
    readings: z.array(readingSchema).default([]),
    sections: z.array(sectionSchema).min(1),
  })
  .superRefine((tpl, ctx) => {
    const seen = new Set<string>();
    tpl.sections.forEach((section, si) => {
      section.items.forEach((item, ii) => {
        if (seen.has(item.id)) {
          ctx.addIssue({
            code: "custom",
            message: `Id de ítem duplicado: ${item.id}`,
            path: ["sections", si, "items", ii, "id"],
          });
        }
        seen.add(item.id);
      });
    });
    tpl.readings.forEach((r, ri) => {
      for (const ref of [r.item, r.maxItem]) {
        if (ref && !seen.has(ref)) {
          ctx.addIssue({
            code: "custom",
            message: `La lectura referencia un ítem inexistente: ${ref}`,
            path: ["readings", ri],
          });
        }
      }
    });
    const keys = new Set<string>();
    tpl.header.forEach((h, hi) => {
      if (keys.has(h.key)) {
        ctx.addIssue({ code: "custom", message: `Campo de cabecera duplicado: ${h.key}`, path: ["header", hi, "key"] });
      }
      keys.add(h.key);
    });
  });

export type TemplateItem = z.infer<typeof itemSchema>;
export type TemplateSection = z.infer<typeof sectionSchema>;
export type FormTemplateSchema = z.infer<typeof templateSchema>;

/** Valor guardado en answers.value para un ítem de verificación. */
export interface VerificationValue {
  estado: Estado;
  valor?: number;
  obs?: string;
  /** IDs (UUID) de attachments. */
  fotos?: string[];
}

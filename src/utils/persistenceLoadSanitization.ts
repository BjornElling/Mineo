import { z } from 'zod';

type ZodSchema = z.ZodType;
export type UnknownPath = Array<string | number>;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

/**
 * Pakker et Zod-schema ud til dets inderste ZodObject eller ZodArray.
 *
 * ADVARSEL: Verificeret mod Zod 4.3.6. Bruger Zod's offentlige `.def`-felt (`type`, `in`, `out`) for at
 * traversere pipe-wrappere (z.preprocess / z.transform). Hvis Zod ændrer
 * sin `.def`-struktur for pipes, returnerer funktionen det umodificerede schema
 * lydløst — hvilket medfører at ukendte felter *ikke* strippes.
 * Verificer mod Zod-changelog ved opgradering.
 */
const unwrapSchema = (schema: ZodSchema): ZodSchema => {
  let current = schema;
  while (true) {
    if (
      current instanceof z.ZodOptional ||
      current instanceof z.ZodNullable ||
      current instanceof z.ZodDefault
    ) {
      current = current.def.innerType as ZodSchema;
      continue;
    }

    const currentDef = current.def as unknown as Record<string, unknown>;
    if (currentDef.type === 'pipe') {
      const inputSchema = currentDef.in;
      const outputSchema = currentDef.out;
      if (inputSchema instanceof z.ZodType) {
        const unwrappedInput = unwrapSchema(inputSchema);
        if (unwrappedInput instanceof z.ZodObject || unwrappedInput instanceof z.ZodArray) {
          current = unwrappedInput;
          continue;
        }
      }
      if (outputSchema instanceof z.ZodType) {
        const unwrappedOutput = unwrapSchema(outputSchema);
        if (unwrappedOutput instanceof z.ZodObject || unwrappedOutput instanceof z.ZodArray) {
          current = unwrappedOutput;
        } else {
          current = outputSchema;
        }
        continue;
      }
    }

    break;
  }

  return current;
};

const resolveObjectShape = (schema: z.ZodObject<z.ZodRawShape>): Record<string, ZodSchema> => {
  const shapeValue: unknown = (schema as unknown as { shape: unknown }).shape;
  const resolved = typeof shapeValue === 'function'
    ? (shapeValue as () => unknown)()
    : shapeValue;
  return isRecord(resolved) ? (resolved as Record<string, ZodSchema>) : {};
};

export const stripUnknownFieldsBySchema = (
  schema: ZodSchema,
  value: unknown
): { sanitized: unknown; unknownPaths: UnknownPath[] } => {
  const base = unwrapSchema(schema);

  if (base instanceof z.ZodObject) {
    if (!isRecord(value)) return { sanitized: value, unknownPaths: [] };

    const shape = resolveObjectShape(base as z.ZodObject<z.ZodRawShape>);
    const sanitized: Record<string, unknown> = {};
    const unknownPaths: UnknownPath[] = [];

    for (const [key, val] of Object.entries(value)) {
      const childSchema = shape[key];
      if (!childSchema) {
        unknownPaths.push([key]);
        continue;
      }

      const child = stripUnknownFieldsBySchema(childSchema, val);
      sanitized[key] = child.sanitized;
      for (const path of child.unknownPaths) {
        unknownPaths.push([key, ...path]);
      }
    }

    return { sanitized, unknownPaths };
  }

  if (base instanceof z.ZodArray) {
    if (!Array.isArray(value)) return { sanitized: value, unknownPaths: [] };

    const elementSchema = base.element as ZodSchema;
    const unknownPaths: UnknownPath[] = [];
    const sanitized = value.map((item, index) => {
      const child = stripUnknownFieldsBySchema(elementSchema, item);
      for (const path of child.unknownPaths) {
        unknownPaths.push([index, ...path]);
      }
      return child.sanitized;
    });

    return { sanitized, unknownPaths };
  }

  return { sanitized: value, unknownPaths: [] };
};

import { z } from 'zod';

type ZodSchema = z.ZodType;
export type UnknownPath = Array<string | number>;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

const cloneDefault = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(cloneDefault);
  if (isRecord(value)) {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = cloneDefault(val);
    }
    return out;
  }
  return value;
};

const unwrapSchema = (schema: ZodSchema): ZodSchema => {
  // Intentional: only unwrap simple wrappers we fully understand.
  // Treat effects/unions as opaque to avoid false-positive stripping.
  let current = schema;
  while (
    current instanceof z.ZodOptional ||
    current instanceof z.ZodNullable ||
    current instanceof z.ZodDefault
  ) {
    current = current.def.innerType as ZodSchema;
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

export const applyDefaultsDeep = (
  value: unknown,
  defaults: unknown
): unknown => {
  if (defaults === undefined) return value;
  if (value === undefined) return cloneDefault(defaults);

  if (Array.isArray(defaults)) {
    // Array defaults must be either [] (no defaults) or [elementDefault].
    // Empty array means "no defaults".
    if (defaults.length > 1) {
      throw new Error('Ugyldig default-konfiguration: Array defaults må kun indeholde 0 eller 1 element.');
    }
    if (!Array.isArray(value)) return value;
    if (defaults.length === 0) return value;
    const elementDefaults = defaults[0];
    if (!isRecord(elementDefaults)) return value;

    const updated = value.map((item) => {
      if (!isRecord(item)) return item;
      return applyDefaultsDeep(item, elementDefaults);
    });
    return updated;
  }

  if (isRecord(defaults) && isRecord(value)) {
    let changed = false;
    const next: Record<string, unknown> = { ...value };

    for (const [key, defVal] of Object.entries(defaults)) {
      if (defVal === undefined) continue;
      const current = value[key];
      const nextVal = applyDefaultsDeep(current, defVal);
      if (nextVal !== current) {
        next[key] = nextVal;
        changed = true;
      }
    }

    return changed ? next : value;
  }

  return value;
};

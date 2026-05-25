import { toJSONSchema, z } from 'zod';
import { fnv1a32 } from './fnv1a32';

type ZodType = z.ZodType;

const stableStringify = (value: unknown, seen = new WeakSet<object>()): string => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof RegExp) return `/${value.source}/${value.flags}`;
  if (Array.isArray(value)) {
    if (seen.has(value)) return '"[Circular]"';
    seen.add(value);
    const serialized = `[${value.map((item) => stableStringify(item, seen)).join(',')}]`;
    seen.delete(value);
    return serialized;
  }
  if (typeof value === 'object') {
    if (seen.has(value)) return '"[Circular]"';
    seen.add(value);
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const parts = keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key], seen)}`);
    seen.delete(value);
    return `{${parts.join(',')}}`;
  }
  throw new Error(`stableStringify: unsupported type ${typeof value}`);
};

const hashString = (value: string): string => {
  return `fnv1a-${fnv1a32(value).toString(16).padStart(8, '0')}`;
};

export const computeSchemaFingerprint = (schemas: Record<string, ZodType>): string => {
  const keys = Object.keys(schemas).sort();
  const body = keys.map((key) => {
    // Drift-sikringen afhænger af Zods JSON Schema-output. Ved Zod-opgradering
    // skal fingerprint-drift derfor klassificeres manuelt som enten reel
    // persisted schema-ændring eller toolchain-formatdrift.
    const jsonSchema = toJSONSchema(schemas[key], { io: 'input', unrepresentable: 'any' });
    return `${JSON.stringify(key)}:${stableStringify(jsonSchema)}`;
  }).join('|');
  return hashString(body);
};

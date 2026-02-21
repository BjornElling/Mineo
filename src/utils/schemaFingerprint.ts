import { toJSONSchema, z } from 'zod';

type ZodType = z.ZodType;

const stableStringify = (value: unknown): string => {
  if (value === null) return 'null';
  if (value === undefined) return 'undefined';
  if (typeof value === 'string') return JSON.stringify(value);
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value instanceof RegExp) return `/${value.source}/${value.flags}`;
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const keys = Object.keys(record).sort();
    const parts = keys.map((key) => `${key}:${stableStringify(record[key])}`);
    return `{${parts.join(',')}}`;
  }
  return typeof value;
};

const hashString = (value: string): string => {
  let hash = 2166136261;
  for (const ch of value) {
    hash ^= ch.codePointAt(0) ?? 0;
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16)}`;
};

export const computeSchemaFingerprint = (schemas: Record<string, ZodType>): string => {
  const keys = Object.keys(schemas).sort();
  const body = keys.map((key) => {
    const jsonSchema = toJSONSchema(schemas[key], { io: 'input', unrepresentable: 'any' });
    return `${key}:${stableStringify(jsonSchema)}`;
  }).join('|');
  return hashString(body);
};

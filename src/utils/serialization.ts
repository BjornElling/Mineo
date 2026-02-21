/**
 * Serialization layer for persisted form values.
 *
 * Runtime invariant:
 * - `undefined` serialiseres som `null` (JSON-kompatibelt)
 * - øvrige JSON-venlige primitive typer beholdes
 */

const serializeValue = (value: unknown): unknown => {
  if (value === undefined) return null;

  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map(serializeValue);
  }

  if (typeof value === 'object') {
    const obj: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      obj[key] = serializeValue(entry);
    }
    return obj;
  }

  return String(value);
};

export function serializeFormValues<T extends Record<string, unknown>>(values: T): Record<string, unknown> {
  const serialized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(values)) {
    serialized[key] = serializeValue(value);
  }
  return serialized;
}

export const nullToUndefinedDeep = (value: unknown): unknown => {
  if (value === null) return undefined;
  if (Array.isArray(value)) return value.map(nullToUndefinedDeep);
  // This helper intentionally assumes plain JSON-like objects used in persistence.
  // Do not pass class instances (e.g., Date), Maps, Sets, or objects with symbol keys.
  if (typeof value === 'object' && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = nullToUndefinedDeep(v);
    }
    return result;
  }
  return value;
};

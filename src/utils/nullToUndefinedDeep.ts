export const nullToUndefinedDeep = (value: unknown): unknown => {
  if (value === null) return undefined;
  if (Array.isArray(value)) return value.map(nullToUndefinedDeep);
  // Denne hjælper antager bevidst almindelige JSON-lignende objekter brugt i persistence.
  // Send ikke klasse-instanser (fx Date), Maps, Sets eller objekter med symbol-nøgler.
  if (typeof value === 'object' && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      result[k] = nullToUndefinedDeep(v);
    }
    return result;
  }
  return value;
};

export const nullToUndefinedDeep = (value: unknown): unknown => {
  if (value === null) return undefined;
  if (Array.isArray(value)) return value.map(nullToUndefinedDeep);
  // Denne hjælper antager bevidst almindelige JSON-lignende objekter brugt i persistence.
  // Send ikke klasse-instanser (fx Date), Maps, Sets eller objekter med symbol-nøgler.
  if (typeof value === 'object' && value !== null) {
    // fromEntries bevarer også en egen __proto__-nøgle som data. Tildeling til {}
    // ville ændre prototypen og kunne gøre filens skjulte felter til indlæst sagsdata.
    return Object.fromEntries(
      Object.entries(value).map(([key, child]) => [key, nullToUndefinedDeep(child)]),
    );
  }
  return value;
};

/**
 * Tjekker om en værdi indeholder meningsfulde data (ikke tom/null).
 */
export const isMeaningfulValue = (value: unknown): boolean => {
  const hasMeaningful = (
    candidate: unknown,
    depth: number,
    seen: WeakSet<object>
  ): boolean => {
    if (depth > 10) return false;
    if (candidate === null || candidate === undefined) return false;

    if (typeof candidate === 'string') {
      return candidate.trim().length > 0;
    }

    if (typeof candidate === 'boolean' || typeof candidate === 'number') {
      return true;
    }

    if (Array.isArray(candidate)) {
      return candidate.some((item) => hasMeaningful(item, depth + 1, seen));
    }

    if (typeof candidate === 'object') {
      if (seen.has(candidate)) return false;
      seen.add(candidate);
      return Object.values(candidate as Record<string, unknown>)
        .some((item) => hasMeaningful(item, depth + 1, seen));
    }

    return false;
  };

  return hasMeaningful(value, 0, new WeakSet<object>());
};

/**
 * Tæller antal felter med meningsfulde værdier i et data-objekt.
 * Håndterer nested strukturer og arrays.
 */
const countFieldsRecursive = (data: unknown, depth: number = 0): number => {
  // Sikkerhed mod uendelig rekursion
  if (depth > 10) {
    return 0;
  }

  if (!data) {
    return 0;
  }

  // Håndter arrays (fx rentekravRows)
  if (Array.isArray(data)) {
    return data.reduce((sum, item) => sum + countFieldsRecursive(item, depth + 1), 0);
  }

  // Håndter objekter
  if (typeof data === 'object') {
    let count = 0;

    for (const key of Object.keys(data as Record<string, unknown>)) {
      // Ignorer metadata og private nøgler
      if (key.startsWith('_')) {
        continue;
      }

      const value = (data as Record<string, unknown>)[key];

      // Hvis værdi er et objekt eller array, rekurser
      if (typeof value === 'object' && value !== null) {
        count += countFieldsRecursive(value, depth + 1);
      } else if (isMeaningfulValue(value)) {
        // Ellers tæl hvis meningsfuld
        count += 1;
      }
    }

    return count;
  }

  // Primitive værdier
  return isMeaningfulValue(data) ? 1 : 0;
};

/**
 * Tæller meningsfulde felter i en vilkårlig værdi — også når værdien selv er en
 * primitiv (et enkelt blad).
 *
 * `countFilledFields()` returnerer 0 for primitiver (den forventer et top-level
 * objekt med sektioner), så den kan ikke bruges til at tælle ét enkelt strippet
 * leaf-felt. Denne helper håndterer både et strippet enkeltfelt og et helt
 * strippet/droppet undertræ, så preflight kan opgøre præcist hvor mange
 * udfyldte felter der gik tabt.
 */
export const countMeaningfulFields = (value: unknown): number => {
  if (value !== null && typeof value === 'object') {
    return countFieldsRecursive(value);
  }
  return isMeaningfulValue(value) ? 1 : 0;
};

/**
 * Tæller totalt antal felter med meningsfulde værdier i hele datasættet.
 */
export const countFilledFields = (data: unknown): number => {
  if (!data || typeof data !== 'object') {
    return 0;
  }

  // Tæl alle data-sektioner (undtagen metadata)
  let totalCount = 0;

  for (const [key, value] of Object.entries(data)) {
    // Spring metadata over
    if (key.startsWith('_')) {
      continue;
    }

    totalCount += countFieldsRecursive(value);
  }

  return totalCount;
};

/**
 * Tjekker om datasættet indeholder egentligt brugerindhold.
 */
export const hasRealData = (data: unknown): boolean => {
  return countFilledFields(data) > 0;
};

/**
 * Tjekker om en værdi indeholder meningsfulde data (ikke tom/null).
 *
 * @param {*} value - Værdi der skal tjekkes
 * @returns {boolean} True hvis værdien er meningsfuld, ellers false
 */
export const isMeaningfulValue = (value) => {
  if (value === null || value === undefined) {
    return false;
  }

  if (typeof value === 'string') {
    return value.trim().length > 0;
  }

  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === 'object') {
    return Object.keys(value).length > 0;
  }

  if (typeof value === 'boolean') {
    return true; // Booleans tæller altid
  }

  if (typeof value === 'number') {
    return true; // Tal tæller altid (inkl. 0)
  }

  return false;
};

/**
 * Tæller antal felter med meningsfulde værdier i et data-objekt.
 * Håndterer nested strukturer og arrays.
 *
 * @param {*} data - Data der skal tælles
 * @param {number} depth - Nuværende rekursions-dybde (til sikkerhed)
 * @returns {number} Antal felter med meningsfulde værdier
 */
const countFieldsRecursive = (data, depth = 0) => {
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

    for (const key of Object.keys(data)) {
      // Ignorer metadata og private nøgler
      if (key.startsWith('_')) {
        continue;
      }

      const value = data[key];

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
 * Tæller totalt antal felter med meningsfulde værdier i hele datasættet.
 *
 * @param {Object} data - Komplet datasæt fra sessionStorage
 * @returns {number} Total antal felter med data
 */
export const countFilledFields = (data) => {
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
 * Indsamler alle data fra sessionStorage.
 * Scanner alle mineo_* keys og strukturerer data per menupunkt.
 *
 * @returns {Object} Komplet datasæt fra alle menupunkter
 */
export const collectAllData = () => {
  const allData = {};

  // Scan alle sessionStorage keys
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);

    // Kun interesseret i mineo_* keys
    if (key && key.startsWith('mineo_')) {
      const pageKey = key.replace('mineo_', '');

      try {
        const value = sessionStorage.getItem(key);
        if (value) {
          allData[pageKey] = JSON.parse(value);
        }
      } catch (error) {
        console.error(`Fejl ved parsing af sessionStorage key '${key}':`, error);
        // Spring denne key over ved fejl
      }
    }
  }

  return allData;
};

/**
 * Tjekker om datasættet indeholder egentligt brugerindhold.
 *
 * @param {Object} data - Data der skal valideres
 * @returns {boolean} False hvis alle sektioner er tomme, ellers true
 */
export const hasRealData = (data) => {
  if (!data || typeof data !== 'object') {
    return false;
  }

  // Filtrer metadata-nøgler fra
  const contentKeys = Object.keys(data).filter(k => !k.startsWith('_'));

  if (contentKeys.length === 0) {
    return false;
  }

  // Tjek om mindst én sektion har meningsfuldt indhold
  for (const key of contentKeys) {
    const section = data[key];

    if (typeof section === 'object' && section !== null) {
      for (const value of Object.values(section)) {
        if (isMeaningfulValue(value)) {
          return true;
        }
      }
    }
  }

  return false;
};

/**
 * Rydder alle mineo_* keys fra sessionStorage.
 * Bruges før indlæsning af ny fil for at sikre tomme felter overskrives.
 */
export const clearAllData = () => {
  const keysToRemove = [];

  // Samle alle mineo_* keys
  for (let i = 0; i < sessionStorage.length; i++) {
    const key = sessionStorage.key(i);
    if (key && key.startsWith('mineo_')) {
      keysToRemove.push(key);
    }
  }

  // Fjern alle keys (gør det i separat loop for at undgå iterator-problemer)
  keysToRemove.forEach(key => {
    sessionStorage.removeItem(key);
  });

  console.log(`Ryddet ${keysToRemove.length} mineo_* keys fra sessionStorage`);
};

/**
 * Gemmer data til sessionStorage.
 *
 * @param {Object} data - Data der skal gemmes
 */
export const saveDataToSessionStorage = (data) => {
  if (!data || typeof data !== 'object') {
    throw new Error('Ugyldig data - skal være et objekt');
  }

  // Gem hver sektion til sessionStorage
  for (const [pageKey, pageData] of Object.entries(data)) {
    // Spring metadata over
    if (pageKey.startsWith('_')) {
      continue;
    }

    try {
      sessionStorage.setItem(`mineo_${pageKey}`, JSON.stringify(pageData));
    } catch (error) {
      console.error(`Fejl ved gemning af ${pageKey} til sessionStorage:`, error);
      throw new Error(`Kunne ikke gemme ${pageKey}`);
    }
  }
};

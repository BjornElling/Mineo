/**
 * Logger til debugging af gem/hent-funktionalitet.
 * Kun aktiv i development mode.
 */

const isDevelopment = process.env.NODE_ENV === 'development';

/**
 * Formaterer timestamp til læsbart format
 */
const getTimestamp = () => {
  const now = new Date();
  return now.toLocaleTimeString('da-DK', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    fractionalSecondDigits: 3,
  });
};

/**
 * Logger debug-besked
 */
export const logDebug = (...args) => {
  if (isDevelopment) {
    console.log(`[${getTimestamp()}] [DEBUG]`, ...args);
  }
};

/**
 * Logger info-besked
 */
export const logInfo = (...args) => {
  if (isDevelopment) {
    console.info(`[${getTimestamp()}] [INFO]`, ...args);
  }
};

/**
 * Logger warning-besked
 */
export const logWarning = (...args) => {
  if (isDevelopment) {
    console.warn(`[${getTimestamp()}] [WARNING]`, ...args);
  }
};

/**
 * Logger error-besked (altid aktiv, også i production)
 */
export const logError = (...args) => {
  console.error(`[${getTimestamp()}] [ERROR]`, ...args);
};

/**
 * Logger start af operation
 */
export const logOperationStart = (operationName) => {
  logInfo(`=== START: ${operationName} ===`);
};

/**
 * Logger afslutning af operation
 */
export const logOperationEnd = (operationName, success = true) => {
  if (success) {
    logInfo(`=== SUCCESS: ${operationName} ===`);
  } else {
    logError(`=== FAILED: ${operationName} ===`);
  }
};

/**
 * Logger data-statistik
 */
export const logDataStats = (data, label = 'Data') => {
  if (!isDevelopment) return;

  const sections = Object.keys(data).filter(k => !k.startsWith('_'));
  logDebug(`${label} indeholder ${sections.length} sektioner:`, sections);

  sections.forEach(section => {
    const sectionData = data[section];
    if (typeof sectionData === 'object' && sectionData !== null) {
      const fieldCount = Object.keys(sectionData).length;
      logDebug(`  - ${section}: ${fieldCount} felter`);
    }
  });
};

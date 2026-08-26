/** Den nyeste container-version, som nye `.eo`-filer skrives med. */
export const FILE_FORMAT_VERSION = '1.0.0' as const;

/**
 * Alle container-versioner, som Mineo fortsat skal kunne indlæse.
 *
 * Listen er med vilje historisk og må kun udvides. Et fremtidigt bump af
 * `FILE_FORMAT_VERSION` skal føje den gamle version til en adapterstrategi og
 * til denne liste, før den nye version kan udgives. Ellers ville et versionsbump
 * tavst gøre tidligere gemte `.eo`-filer ulæselige.
 */
export const SUPPORTED_FILE_FORMAT_VERSIONS = ['1.0.0'] as const;
export type SupportedFileFormatVersion = typeof SUPPORTED_FILE_FORMAT_VERSIONS[number];

/**
 * Maksimum filstørrelse for .eo filer (1 MB).
 * Beskytter mod memory-problemer ved indlæsning af store filer.
 * .eo filer indeholder kun tekstdata og forventes at være < 100 KB.
 */
export const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB i bytes

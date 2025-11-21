/**
 * Version Configuration (autogenereret)
 *
 * Redigér IKKE filen manuelt.
 * Format: YYYY.MM.BUILD
 */

export const VERSION = '2025.11.29';
export const BUILD_DATE = '2025-11-21T11:38:19.896Z';

/**
 * Filformat version - ændres kun hvis datastrukturen ændres.
 * Bruges til at validere kompatibilitet mellem forskellige versioner af programmet.
 */
export const FILE_FORMAT_VERSION = '1.0.0';

/**
 * Maksimum filstørrelse for .eo filer (1 MB).
 * Beskytter mod memory-problemer ved indlæsning af store filer.
 * .eo filer indeholder kun tekstdata og forventes at være < 100 KB.
 */
export const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1 MB i bytes

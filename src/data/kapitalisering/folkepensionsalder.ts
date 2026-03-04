import type { ISODateString } from '../../types/branded';
import { toISODateString } from '../../types/branded';

// Folkepensionsalder baseret på fødselsdato.
// Manuelt vedligeholdt — opdateres kun ved lovændring.
//
// Struktur: hvert interval angiver fra hvilken fødselsdato (inklusiv) en given
// folkepensionsalder gælder. Intervaller er sorteret stigende efter fødselsdatoFra.
// Det seneste matchende interval (fødselsdato >= fødselsdatoFra) vinder.
// Det sidste interval er åbent og dækker alle fødselsdatoer fra og med angivne dato.
//
// Ved fremtidige lovændringer: tilføj et nyt element sidst i arrayet.

export interface FolkepensionsalderInterval {
  /** Første fødselsdato (inklusiv) dette interval gælder for. ISO 8601. */
  foedselsdatoFra: ISODateString
  /** Folkepensionsalder i hele år. */
  folkepensionsalder: 67 | 68 | 69 | 70
}

export const folkepensionsalderIntervaller: FolkepensionsalderInterval[] = [
  { foedselsdatoFra: toISODateString('1955-07-01'), folkepensionsalder: 67 },
  { foedselsdatoFra: toISODateString('1963-01-01'), folkepensionsalder: 68 },
  { foedselsdatoFra: toISODateString('1967-01-01'), folkepensionsalder: 69 },
  { foedselsdatoFra: toISODateString('1971-01-01'), folkepensionsalder: 70 }
]

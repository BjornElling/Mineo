import { isISODateString } from '../../types/branded';

/**
 * Test-sikkerhedsnet for dokument-output-kontraktens datoregel (§A8): programmets egne
 * datoer formateres ved kilden og må aldrig nå dokumentet som rå ISO (ÅÅÅÅ-MM-DD).
 *
 * Reglen håndhæves i testene – ikke ved runtime: kanalerne kan ikke skelne en lækket
 * programdato fra brugerens fritekst (fx journalnummeret «AES-2024-01-15»), som skal
 * gengives tegn for tegn.
 *
 * Lookbehind/lookahead på cifre sikrer, at kun en isoleret 4-2-2-dato rammes – aldrig en
 * del af et længere tal (fx «2024-001234»). En dansk dato (DD-MM-ÅÅÅÅ) matcher ikke.
 */
const ISO_DATE_TOKEN = /(?<!\d)\d{4}-\d{2}-\d{2}(?!\d)/g;

/** Alle gyldige, bare ISO-datoer i teksten (tom = ingen lækage). */
export const findRawIsoDates = (value: string): readonly string[] =>
  (value.match(ISO_DATE_TOKEN) ?? []).filter((token) => isISODateString(token));

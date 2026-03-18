/**
 * FALLBACK: Folkepensionsalder baseret på kapitaliseringsdato og fødselsdato.
 *
 * ╔══════════════════════════════════════════════════════════════════════════════╗
 * ║  VIGTIGT: DETTE ER EN FALLBACK — IKKE DEN AUTORITATIVE KILDE.              ║
 * ║                                                                              ║
 * ║  Det forudsætningsvise udgangspunkt er ALTID at udlæse folkepensionsalderen ║
 * ║  direkte af kapitaliseringsbekendtgørelsen via resolveKapitaliseringTabelvalg║
 * ║  i eetKapitaliseringOpslag.ts. Denne fil må kun konsulteres, når det opslag ║
 * ║  returnerer null, og kun for at undgå at beregningen fejler fuldstændigt.   ║
 * ╚══════════════════════════════════════════════════════════════════════════════╝
 *
 * BEVIDST IKKE KOBLET IND I BEREGNINGEN
 *
 * Denne fil eksporterer en funktion men er ikke importeret noget sted i
 * beregningslogikken. Det er en bevidst beslutning:
 *
 * `resolveKapitaliseringTabelvalg` returnerer null, når skadesdato/fødselsdato
 * ikke matcher nogen post i bekendtgørelsens tabelvalg-data. I det tilfælde
 * mangler ikke blot folkepensionsalderen — hele tabelvalget mangler, herunder
 * hvilket tabel-ID der skal benyttes til faktortabellen. En
 * folkepensionsalder-fallback kan ikke reparere dette, fordi beregningen
 * stadig ikke ville vide hvilken faktortabel der skal bruges.
 *
 * De steder i eetKapitaliseringCalculation.ts der modtager null fra
 * resolveKapitaliseringTabelvalg stopper beregningen med en fejlmeddelelse
 * frem for at producere et potentielt forkert tal. Det er det korrekte valg
 * for et trust-kritisk system.
 *
 * Filen bevares som:
 *   1. Dokumentation af folkepensionsalderens historiske udvikling udledt
 *      direkte fra bekendtgørelserne.
 *   2. Reservekapacitet, hvis der i fremtiden opstår et afgrænset scenarie
 *      hvor folkepensionsalderen er det eneste der mangler og kan substitueres
 *      forsvarligt — men det kræver en eksplicit, begrundet beslutning.
 *
 * ---
 *
 * DATAGRUNDLAG
 *
 * Matrixen herunder er udledt ved systematisk gennemgang af alle 32
 * kapitaliseringsbekendtgørelser og -vejledninger i
 * src/data/kapitalisering/kapitaliseringsTabeller/ (BEK/VEJ 2003–2026).
 *
 * Dimensionerne er:
 *   - Kapitaliseringsdato (= hvornår kapitaliseres; afgrænset af bekendtgørelsens
 *     gyldigFra/gyldigTil)
 *   - Fødselsdato
 *
 * Folkepensionsalderen for en given person har ændret sig over tid, efterhånden
 * som Folketinget har hævet aldersgrænsen. Fallbacken afspejler dette ved at
 * koble opslagsdatoen til det tidspunkt, bekendtgørelsen var gældende.
 *
 * ---
 *
 * MØNSTERET FRA BEKENDTGØRELSERNE
 *
 * Nedenstående er bekendtgørelsernes faktiske indhold pr. kapitaliseringsperiode
 * for skader under lov om arbejdsskadesikring (post-2011-ordning medmindre andet
 * fremgår). Kun fødselsdatoer der optræder eksplicit i bekendtgørelsen er vist;
 * fødselsdatoer der ikke optræder er ikke et hul men afspejler at persongruppen
 * allerede har passeret folkepensionsalderen og er ude af beregningens scope.
 *
 *  Kapitaliseringsperiode  │ Kilde(r)        │ Fødselsdatogrænser → folkepensionsalder
 *  ────────────────────────┼─────────────────┼────────────────────────────────────────
 *  2004-01–2009-06-30      │ 1068/2003       │ ≥1978-04-01 (alt): 65 år
 *  2007-07–2009-06-30      │ 678/2007,       │ ≥2007-07-01 (alt): 65 år
 *                          │ 1263/2007,      │
 *                          │ 1047/2008       │
 *  2009-07–2010-12-31      │ 440/2009,       │ ≥1960-07-01: 67 │ ≥1960-01-01: 66,5
 *                          │ 449/2009,       │ ≥1959-07-01: 66 │ ≥1959-01-01: 65,5
 *                          │ 1022/2009       │ <1959-01-01: 65
 *  2011-01–2011-12-31      │ 1220/2010 (post)│ ≥1960-07-01: 67 │ ≥1960-01-01: 66,5
 *                          │ 1221/2010 (pre) │ ≥1959-07-01: 66 │ ≥1959-01-01: 65,5
 *                          │                 │ (ingen <1959 i post-2011-ordning)
 *  2012-01–2015-02-28      │ 1358/2011,      │ ≥1955-07-01: 67 │ ≥1955-01-01: 66,5
 *                          │ 1403/2011,      │ ≥1954-07-01: 66 │ ≥1954-01-01: 65,5
 *                          │ 990/2012,       │
 *                          │ 1202/2013,      │
 *                          │ 1275/2014       │
 *  2015-03–2017-12-31      │ 199/2015,       │ ≥1955-07-01: 67 │ ≥1955-01-01: 66,5
 *                          │ 1663/2015,      │ ≥1954-07-01: 66 │ ≥1954-01-01: 65,5
 *                          │ 1664/2015,      │
 *                          │ 1275/2016       │
 *  2018-01–2018-12-31      │ 1156/2017       │ ≥1963-01-01: 68 │ ≥1955-07-01: 67
 *                          │                 │ ≥1955-01-01: 66,5 │ ≥1954-07-01: 66
 *  2019-01–2019-12-31      │ 1233/2018       │ ≥1963-01-01: 68 │ ≥1955-07-01: 67
 *                          │                 │ ≥1955-01-01: 66,5
 *  2020-01–2020-12-30      │ 9921/2019       │ ≥1963-01-01: 68 │ ≥1955-07-01: 67
 *  2020-12-31              │ 9870/2020       │ ≥1967-01-01: 69 │ ≥1963-01-01: 68
 *                          │                 │ ≥1955-07-01: 67
 *  2021-01–2025-12-31      │ 9741/2020,      │ ≥1967-01-01: 69 │ ≥1963-01-01: 68
 *                          │ 9864/2021,      │ ≥1955-07-01: 67
 *                          │ 10141/2022,     │
 *                          │ 9820/2023,      │
 *                          │ 9376/2024,      │
 *                          │ 10029-2024      │
 *  2026-01–                │ 10056/2025      │ ≥1971-01-01: 70 │ ≥1967-01-01: 69
 *                          │                 │ ≥1963-01-01: 68 │ ≥1955-07-01: 67
 *
 * Note om 2009–2011-grænsen for 67 år: BEK 440/2009–1221/2010 anvender 1960-07-01
 * som nedre fødselsdatogrænse for "67 år". Fra BEK 1358/2011 er grænsen permanent
 * 1955-07-01. Denne forskel er bevaret 1:1 i matrixen.
 */

import type { ISODateString } from '../../types/branded';

export type FolkepensionsalderFallback = Readonly<{
  folkepensionsalderMaaneder: number;
  folkepensionsalderLabel: string;
}>;

const FP65: FolkepensionsalderFallback = { folkepensionsalderMaaneder: 780, folkepensionsalderLabel: '65 år' };
const FP65_5: FolkepensionsalderFallback = { folkepensionsalderMaaneder: 786, folkepensionsalderLabel: '65,5 år' };
const FP66: FolkepensionsalderFallback = { folkepensionsalderMaaneder: 792, folkepensionsalderLabel: '66 år' };
const FP66_5: FolkepensionsalderFallback = { folkepensionsalderMaaneder: 798, folkepensionsalderLabel: '66,5 år' };
const FP67: FolkepensionsalderFallback = { folkepensionsalderMaaneder: 804, folkepensionsalderLabel: '67 år' };
const FP68: FolkepensionsalderFallback = { folkepensionsalderMaaneder: 816, folkepensionsalderLabel: '68 år' };
const FP69: FolkepensionsalderFallback = { folkepensionsalderMaaneder: 828, folkepensionsalderLabel: '69 år' };
const FP70: FolkepensionsalderFallback = { folkepensionsalderMaaneder: 840, folkepensionsalderLabel: '70 år' };

/**
 * FALLBACK-opslag på folkepensionsalder ud fra kapitaliseringsdato og fødselsdato.
 *
 * Afspejler hvad den gældende kapitaliseringsbekendtgørelse angav på
 * kapitaliseringsdatoen for den givne fødselsdato.
 *
 * Returnerer null når:
 * - kombinationen af kapitaliseringsdato og fødselsdato ikke kan kortlægges til
 *   en folkepensionsalder ud fra bekendtgørelsernes historiske data, fx fordi
 *   personen allerede passerede folkepensionsalderen på kapitliseringsdatoen og
 *   dermed ikke optræder i nogen bekendtgørelses tabelvalg.
 */
export const folkepensionsalderFallback = (
  kapitaliseringsdato: ISODateString,
  fodselsdato: ISODateString
): FolkepensionsalderFallback | null => {
  // 2026+: 10056/2025 (gyldig fra 2026-01-01)
  if (kapitaliseringsdato >= ('2026-01-01' as ISODateString)) {
    if (fodselsdato >= ('1971-01-01' as ISODateString)) return FP70;
    if (fodselsdato >= ('1967-01-01' as ISODateString)) return FP69;
    if (fodselsdato >= ('1963-01-01' as ISODateString)) return FP68;
    if (fodselsdato >= ('1955-07-01' as ISODateString)) return FP67;
    return null;
  }

  // 2021-01-01–2025-12-31: 9741/2020, 9864/2021, 10141/2022, 9820/2023, 9376/2024, 10029-2024
  if (kapitaliseringsdato >= ('2021-01-01' as ISODateString)) {
    if (fodselsdato >= ('1967-01-01' as ISODateString)) return FP69;
    if (fodselsdato >= ('1963-01-01' as ISODateString)) return FP68;
    if (fodselsdato >= ('1955-07-01' as ISODateString)) return FP67;
    return null;
  }

  // 2020-12-31 (én dag): 9870/2020
  if (kapitaliseringsdato >= ('2020-12-31' as ISODateString)) {
    if (fodselsdato >= ('1967-01-01' as ISODateString)) return FP69;
    if (fodselsdato >= ('1963-01-01' as ISODateString)) return FP68;
    if (fodselsdato >= ('1955-07-01' as ISODateString)) return FP67;
    return null;
  }

  // 2020-01-01–2020-12-30: 9921/2019
  if (kapitaliseringsdato >= ('2020-01-01' as ISODateString)) {
    if (fodselsdato >= ('1963-01-01' as ISODateString)) return FP68;
    if (fodselsdato >= ('1955-07-01' as ISODateString)) return FP67;
    return null;
  }

  // 2019-01-01–2019-12-31: 1233/2018
  if (kapitaliseringsdato >= ('2019-01-01' as ISODateString)) {
    if (fodselsdato >= ('1963-01-01' as ISODateString)) return FP68;
    if (fodselsdato >= ('1955-07-01' as ISODateString)) return FP67;
    if (fodselsdato >= ('1955-01-01' as ISODateString)) return FP66_5;
    return null;
  }

  // 2018-01-01–2018-12-31: 1156/2017
  if (kapitaliseringsdato >= ('2018-01-01' as ISODateString)) {
    if (fodselsdato >= ('1963-01-01' as ISODateString)) return FP68;
    if (fodselsdato >= ('1955-07-01' as ISODateString)) return FP67;
    if (fodselsdato >= ('1955-01-01' as ISODateString)) return FP66_5;
    if (fodselsdato >= ('1954-07-01' as ISODateString)) return FP66;
    return null;
  }

  // 2012-01-01–2017-12-31: 1358/2011, 1403/2011, 990/2012, 1202/2013, 1275/2014,
  //                         199/2015, 1663/2015, 1664/2015, 1275/2016
  // (post-2011-ordning; pre-2011 dækkes af 1403/2011 og 198/2015 med samme grænser)
  if (kapitaliseringsdato >= ('2012-01-01' as ISODateString)) {
    if (fodselsdato >= ('1955-07-01' as ISODateString)) return FP67;
    if (fodselsdato >= ('1955-01-01' as ISODateString)) return FP66_5;
    if (fodselsdato >= ('1954-07-01' as ISODateString)) return FP66;
    if (fodselsdato >= ('1954-01-01' as ISODateString)) return FP65_5;
    return null;
  }

  // 2011-01-01–2011-12-31: 1220/2010 (post-2011) og 1221/2010 (pre-2011)
  // Grænsen for 67 år er her 1960-07-01 (ikke 1955-07-01 som fra 2012)
  if (kapitaliseringsdato >= ('2011-01-01' as ISODateString)) {
    if (fodselsdato >= ('1960-07-01' as ISODateString)) return FP67;
    if (fodselsdato >= ('1960-01-01' as ISODateString)) return FP66_5;
    if (fodselsdato >= ('1959-07-01' as ISODateString)) return FP66;
    if (fodselsdato >= ('1959-01-01' as ISODateString)) return FP65_5;
    // Pre-2011-ordning (1221/2010) dækker ældre fødselsdatoer ned til ~1958
    if (fodselsdato >= ('1900-01-01' as ISODateString)) return FP65;
    return null;
  }

  // 2009-07-01–2010-12-31: 440/2009, 449/2009, 1022/2009
  if (kapitaliseringsdato >= ('2009-07-01' as ISODateString)) {
    if (fodselsdato >= ('1960-07-01' as ISODateString)) return FP67;
    if (fodselsdato >= ('1960-01-01' as ISODateString)) return FP66_5;
    if (fodselsdato >= ('1959-07-01' as ISODateString)) return FP66;
    if (fodselsdato >= ('1959-01-01' as ISODateString)) return FP65_5;
    if (fodselsdato >= ('1900-01-01' as ISODateString)) return FP65;
    return null;
  }

  // 2004-01-01–2009-06-30: 1068/2003, 678/2007, 1263/2007, 1047/2008
  // Alle fødselsdatoer: 65 år (enkelt-tabel, ingen kohorteopdeling)
  if (kapitaliseringsdato >= ('2004-01-01' as ISODateString)) {
    if (fodselsdato >= ('1900-01-01' as ISODateString)) return FP65;
    return null;
  }

  // Kapitaliseringsdatoer før 2004: ingen bekendtgørelser i datasættet
  return null;
};

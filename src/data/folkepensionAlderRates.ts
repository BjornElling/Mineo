import type { ISODateString } from '../types/branded';
import { dateToISO, parseISODate } from '../types/branded';
import { addDays, addMonths } from '../utils/dateUtils';

/**
 * Folkepensionsalder som funktion af fødselsdato og opslagsdato.
 *
 * Kilde: Lov om social pension §1a samt overgangsregler (L 485/2009, L 395/2015, L 710/2020).
 * Dækning: opslagsdatoer fra 1. januar 2003 og frem.
 */

export type FolkepensionAlderEntry = Readonly<{
  foedselsdatoFra: ISODateString | null;  // Inklusiv — null = ingen nedre grænse
  foedselsdatoTil: ISODateString | null;  // Inklusiv — null = ingen øvre grænse
  alderMaaneder: number;
  alderLabel: string;
}>;

export type ResolvedFolkepensionAlder = Readonly<{
  alderMaaneder: number;
  alderLabel: string;
}>;

export type FolkepensionAlderPeriode = Readonly<{
  opslagsdatoFra: ISODateString;          // Inklusiv
  opslagsdatoTil: ISODateString | null;   // Inklusiv — null = gælder frem til næste lovændring
  entries: readonly FolkepensionAlderEntry[];
}>;

// Hjælper: konverterer tabelrækker til FolkepensionAlderEntry[]
// Kolonner: [ foedselsdatoFra | foedselsdatoTil | alderMaaneder | alderLabel ]
// null i foedselsdatoFra/Til = ingen grænse
type FpAlderRaekke = readonly [
  foedselsdatoFra: string | null,
  foedselsdatoTil: string | null,
  alderMaaneder: number,
  alderLabel: string,
];

const fp = (rows: readonly FpAlderRaekke[]): readonly FolkepensionAlderEntry[] =>
  rows.map(([fra, til, maaneder, label]) => ({
    foedselsdatoFra: fra !== null ? (fra as ISODateString) : null,
    foedselsdatoTil: til !== null ? (til as ISODateString) : null,
    alderMaaneder: maaneder,
    alderLabel: label,
  }));

// Måneder: 65 = 780 · 65½ = 786 · 66 = 792 · 66½ = 798 · 67 = 804 · 68 = 816 · 69 = 828 · 70 = 840

export const folkepensionAlderPerioder: readonly FolkepensionAlderPeriode[] = [

  // ─── 2003-01-01 – 2009-06-30 ────────────────────────────────────────────────
  // Før L 485 (2009): 65 år for alle født 1. juli 1939 eller senere; 67 år for tidligere årgange
  {
    opslagsdatoFra: '2003-01-01' as ISODateString,
    opslagsdatoTil: '2009-06-30' as ISODateString,
    entries: fp([
      // Fødselsdato fra  │ Fødselsdato til  │ Mdr. │ Label
      [ null,               '1939-06-30',       804,   '67 år'   ],
      [ '1939-07-01',       null,                780,   '65 år'   ],
    ]),
  },

  // ─── 2009-07-01 – 2015-12-28 ────────────────────────────────────────────────
  // L 485 (2009): indfasning fra 65 til 67 år for årgange 1954–1955
  {
    opslagsdatoFra: '2009-07-01' as ISODateString,
    opslagsdatoTil: '2015-12-28' as ISODateString,
    entries: fp([
      // Fødselsdato fra  │ Fødselsdato til  │ Mdr. │ Label
      [ null,               '1953-12-31',       780,   '65 år'   ],
      [ '1954-01-01',       '1954-06-30',        786,   '65,5 år' ],
      [ '1954-07-01',       '1954-12-31',        792,   '66 år'   ],
      [ '1955-01-01',       '1955-06-30',        798,   '66,5 år' ],
      [ '1955-07-01',       null,                804,   '67 år'   ],
    ]),
  },

  // ─── 2015-12-29 – 2020-12-30 ────────────────────────────────────────────────
  // L 395 (2015): indfasning til 68 år for årgange fra 1963
  {
    opslagsdatoFra: '2015-12-29' as ISODateString,
    opslagsdatoTil: '2020-12-30' as ISODateString,
    entries: fp([
      // Fødselsdato fra  │ Fødselsdato til  │ Mdr. │ Label
      [ null,               '1953-12-31',       780,   '65 år'   ],
      [ '1954-01-01',       '1954-06-30',        786,   '65,5 år' ],
      [ '1954-07-01',       '1954-12-31',        792,   '66 år'   ],
      [ '1955-01-01',       '1955-06-30',        798,   '66,5 år' ],
      [ '1955-07-01',       '1962-12-31',        804,   '67 år'   ],
      [ '1963-01-01',       null,                816,   '68 år'   ],
    ]),
  },

  // ─── 2020-12-31 – 2025-12-30 ────────────────────────────────────────────────
  // L 710 (2020): indfasning til 69 år for årgange fra 1967
  {
    opslagsdatoFra: '2020-12-31' as ISODateString,
    opslagsdatoTil: '2025-12-30' as ISODateString,
    entries: fp([
      // Fødselsdato fra  │ Fødselsdato til  │ Mdr. │ Label
      [ null,               '1953-12-31',       780,   '65 år'   ],
      [ '1954-01-01',       '1954-06-30',        786,   '65,5 år' ],
      [ '1954-07-01',       '1954-12-31',        792,   '66 år'   ],
      [ '1955-01-01',       '1955-06-30',        798,   '66,5 år' ],
      [ '1955-07-01',       '1962-12-31',        804,   '67 år'   ],
      [ '1963-01-01',       '1966-12-31',        816,   '68 år'   ],
      [ '1967-01-01',       null,                828,   '69 år'   ],
    ]),
  },

  // ─── 2025-12-31 og frem ─────────────────────────────────────────────────────
  // L 710 (2020): indfasning til 70 år for årgange fra 1971
  // opslagsdatoTil er null: næste periodeskift kendes ikke (fremtidig lovændring)
  {
    opslagsdatoFra: '2025-12-31' as ISODateString,
    opslagsdatoTil: null,
    entries: fp([
      // Fødselsdato fra  │ Fødselsdato til  │ Mdr. │ Label
      [ null,               '1953-12-31',       780,   '65 år'   ],
      [ '1954-01-01',       '1954-06-30',        786,   '65,5 år' ],
      [ '1954-07-01',       '1954-12-31',        792,   '66 år'   ],
      [ '1955-01-01',       '1955-06-30',        798,   '66,5 år' ],
      [ '1955-07-01',       '1962-12-31',        804,   '67 år'   ],
      [ '1963-01-01',       '1966-12-31',        816,   '68 år'   ],
      [ '1967-01-01',       '1970-12-31',        828,   '69 år'   ],
      [ '1971-01-01',       null,                840,   '70 år'   ],
    ]),
  },
];

/**
 * Slår folkepensionsalderen op for en given fødselsdato og opslagsdato.
 *
 * @returns entry med alderMaaneder og alderLabel, eller null hvis opslagsdatoen
 *   ligger uden for den dækkede periode (før 2003-01-01 eller efter seneste slutdato).
 */
export const getFolkepensionAlder = (
  foedselsdato: ISODateString,
  opslagsdato: ISODateString
): ResolvedFolkepensionAlder | null => {
  const periode = folkepensionAlderPerioder
    .filter((p) => p.opslagsdatoFra <= opslagsdato)
    .reduce<FolkepensionAlderPeriode | null>((latest, current) => {
      if (!latest) return current;
      return current.opslagsdatoFra > latest.opslagsdatoFra ? current : latest;
    }, null);

  if (!periode) return null;
  if (periode.opslagsdatoTil !== null && opslagsdato > periode.opslagsdatoTil) return null;

  const entry = periode.entries.find((e) => {
    if (e.foedselsdatoFra !== null && foedselsdato < e.foedselsdatoFra) return false;
    if (e.foedselsdatoTil !== null && foedselsdato > e.foedselsdatoTil) return false;
    return true;
  });

  return entry
    ? {
      alderMaaneder: entry.alderMaaneder,
      alderLabel: entry.alderLabel,
    }
    : null;
};

export const getFolkepensionAlderMaaneder = (
  foedselsdato: ISODateString,
  opslagsdato: ISODateString
): number | null => getFolkepensionAlder(foedselsdato, opslagsdato)?.alderMaaneder ?? null;

export const getFolkepensionsdato = (
  foedselsdato: ISODateString,
  opslagsdato: ISODateString
): ISODateString | undefined => {
  const folkepensionAlder = getFolkepensionAlder(foedselsdato, opslagsdato);
  const birthDate = parseISODate(foedselsdato);
  if (!folkepensionAlder || !birthDate) return undefined;
  return dateToISO(addMonths(birthDate, folkepensionAlder.alderMaaneder));
};

export const getDagenFoerFolkepensionsdato = (
  foedselsdato: ISODateString,
  opslagsdato: ISODateString
): ISODateString | undefined => {
  const folkepensionsdato = getFolkepensionsdato(foedselsdato, opslagsdato);
  const parsed = folkepensionsdato ? parseISODate(folkepensionsdato) : null;
  return parsed ? dateToISO(addDays(parsed, -1)) : undefined;
};

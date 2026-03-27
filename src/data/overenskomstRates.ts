/**
 * Overenskomstmæssige satser for løn og tillæg 2005 ->
 *
 * Denne fil indeholder satser fra kollektive overenskomster mellem
 * lønmodtagerorganisationer og arbejdsgiverorganisationer.
 *
 * Struktur:
 * - Hver overenskomst har metadata (navn, parter) og historiske satser
 * - Satser er organiseret kronologisk med præcis ikrafttrædelsesdato
 * - Tillæg kan være null (findes ikke i overenskomsten) eller 0 (findes men er 0 kr)
 */

import { toDanishDateString, type DanishDateString } from '../types/branded';
import { addDays, addMonths, formatDanishDate, parseDanishDate } from '../utils/dateUtils';
import { getReguleringsDatoIntervalForOffentligLoen } from './offentligLoenLookup';
import type { OffentligOverenskomstType } from './offentligLoenTypes';

// ===== TYPE DEFINITIONER =====

/**
 * Branded type for overenskomst-ID
 */
export type OverenskomstId = string & { readonly __brand: 'OverenskomstId' };

/**
 * Helper-funktion til at oprette valideret OverenskomstId
 */
const toOverenskomstId = (id: string): OverenskomstId => {
  if (!id || id.trim().length === 0) {
    throw new Error(`Ugyldig overenskomst-ID: "${id}"`);
  }
  return id.trim().toLowerCase() as OverenskomstId;
};

export type OverenskomstRef = Readonly<{
  baseId: OverenskomstId;
}>;

// Obsolete suffix from a previous data format; still handled for saved cases that may contain it.
const OBSOLETE_SH_DAGE_LOEN_SUFFIX = '-almindelig-loen-paa-sh-dage';

const resolveOverenskomstRefFromString = (rawId: string): OverenskomstRef | undefined => {
  const normalized = rawId.trim().toLowerCase();
  if (normalized.length === 0) return undefined;

  if (!normalized.endsWith(OBSOLETE_SH_DAGE_LOEN_SUFFIX)) {
    return { baseId: toOverenskomstId(normalized) };
  }

  const baseCandidate = normalized.slice(0, -OBSOLETE_SH_DAGE_LOEN_SUFFIX.length);
  if (baseCandidate.length === 0) return undefined;

  return { baseId: toOverenskomstId(baseCandidate) };
};

/**
 * En enkelt satsperiode med præcis ikrafttrædelsesdato
 */
export interface OverenskomstPeriodeSats {
  readonly fraDato: DanishDateString;           // Ikrafttrædelsesdato, fx '01-03-2024'
  readonly grundloen: number | null;            // Kr./time - null hvis ikke relevant
  readonly shSoSats: number | null;             // SH/SO-procent (0.069 = 6,9%)
  readonly fritvalg: number | null;             // Fritvalg-procent
  readonly agPension: number | null;            // Arbejdsgiver pension-procent
  readonly sfgg: number | null;                 // Standard SFGG kr./time
  readonly sfggFaglKbh: number | null;          // Diff. SFGG: Faglært København
  readonly sfggFaglProv: number | null;         // Diff. SFGG: Faglært provins
  readonly sfggUfaglKbh: number | null;         // Diff. SFGG: Ufaglært København
  readonly sfggUfaglProv: number | null;        // Diff. SFGG: Ufaglært provins
}

/**
 * Metadata for en overenskomst
 */
export interface OverenskomstMeta {
  readonly id: OverenskomstId;
  readonly navn: string;
  readonly loenmodtagerOrg: ReadonlyArray<string>;  // Kan have flere parter
  readonly arbejdsgiverOrg: ReadonlyArray<string>;  // Kan have flere parter
  readonly grundloenAngivetPer: GrundloenAngivetPer;
  readonly sfggPolicy: OverenskomstSfggPolicy;
}

export type OverenskomstSfggPolicy = Readonly<{
  readonly fravigerFerielov: boolean;
  readonly model: 'ferielov' | 'direkte_sats';
  readonly direkteSatsErDifferentieret: boolean;
  readonly bortfalderUnderArbejdsgiverbetaltSygeloen: boolean;
  readonly referenceperiodeLabel: string | null;
}>;

/**
 * Komplet overenskomst med metadata og satser
 */
export interface Overenskomst {
  readonly meta: OverenskomstMeta;
  readonly satser: ReadonlyArray<OverenskomstPeriodeSats>; // Nyeste foerst
  readonly shDageAlmindeligLoenRegel?: ShDageAlmindeligLoenRegel;
}

export type ReguleringsDatoInterval = Readonly<{
  fraDato: DanishDateString;
  tilDato: DanishDateString;
}>;

export type GrundloenAngivetPer = 'Time' | 'Måned';

type OffentligOverenskomstMeta = OverenskomstMeta & Readonly<{
  offentligType: OffentligOverenskomstType;
}>;

type OffentligOverenskomstSatser = Readonly<{
  id: OverenskomstId;
  satser: ReadonlyArray<OverenskomstPeriodeSats>; // Nyeste foerst
  shDageAlmindeligLoenRegel?: ShDageAlmindeligLoenRegel;
}>;

type ShDageAlmindeligLoenRegel = Readonly<{
  readonly fritvalgDelta?: number;              // Decimal-procentpoint (0.01 = +1,00 %-point)
  readonly shSoDelta?: number;                  // Decimal-procentpoint (0.01 = +1,00 %-point)
  readonly shSoOverride?: number | null;        // Decimal-procent (0.069 = 6,9 %) eller null
}>;

// ===== HELPER FUNKTIONER =====

/**
 * Kort helper til at oprette DanishDateString
 */
const d = (dateStr: string): DanishDateString => toDanishDateString(dateStr);

export const OFFENTLIG_REGULERING_MIN_DATO: DanishDateString = d('01-01-2012');
/**
 * Konverterer DanishDateString (DD-MM-YYYY) til et sammenligneligt tal (YYYYMMDD).
 *
 * Undgår Date/timezone edge cases og giver deterministiske sammenligninger.
 */
const danishDateToNumber = (dato: DanishDateString): number => {
  const [day, month, year] = dato.split('-').map(Number);
  return year * 10000 + month * 100 + day;
};

export const isOffentligReguleringsDatoGyldig = (dato: DanishDateString): boolean =>
  danishDateToNumber(dato) >= danishDateToNumber(OFFENTLIG_REGULERING_MIN_DATO);

export const assertOffentligReguleringsDatoGyldig = (dato: DanishDateString): void => {
  if (isOffentligReguleringsDatoGyldig(dato)) return;
  throw new Error(
    `Offentlig overenskomst kan ikke reguleres før ${OFFENTLIG_REGULERING_MIN_DATO}`
  );
};

/**
 * Type for base properties i satserFromTable
 * Alle properties er optional, da kun de fælles værdier skal angives
 * Inkluderer nu også kolonner der kan være null i tabellen
 */
type OverenskomstSatsBase = Partial<Omit<
  OverenskomstPeriodeSats,
  | 'fraDato'
  | 'grundloen'
  | 'agPension'
>>;

/**
 * Type for table rows i satserFromTable
 * Variabelt antal felter - kun de kolonner der ikke er i base
 */
type OverenskomstSatsTableRow = readonly [
  fraDato: string,
  grundloen: number | null,
  ...rest: ReadonlyArray<number | null>
];

/**
 * Helper-funktion til at konvertere tabel-format til fulde sats-objekter
 */
const satserFromTable = (
  base: OverenskomstSatsBase,
  rows: ReadonlyArray<OverenskomstSatsTableRow>,
): ReadonlyArray<OverenskomstPeriodeSats> => {
  const baseFieldCount = [
    base.shSoSats,
    base.fritvalg,
    base.sfgg,
    base.sfggFaglKbh,
    base.sfggFaglProv,
    base.sfggUfaglKbh,
    base.sfggUfaglProv,
  ].filter((value) => value !== undefined).length;
  const expectedRowLength = 2 + (8 - baseFieldCount);

  return rows.map((row) => {
    if (row.length !== expectedRowLength) {
      throw new Error(
        `Ugyldigt antal kolonner i overenskomst-tabel. Forventede ${expectedRowLength}, fik ${row.length}. Base: ${JSON.stringify(base)}. Row: ${JSON.stringify(row)}`
      );
    }

    const [fraDatoStr, grundloen, ...rest] = row;

      // Bestem hvilke felter der er inkluderet i rækken baseret på base
      let idx = 0;
      const shSoSats = base.shSoSats !== undefined ? base.shSoSats : (rest[idx++] ?? null);
      const fritvalg = base.fritvalg !== undefined ? base.fritvalg : (rest[idx++] ?? null);
      const agPension = rest[idx++] ?? null;
      const sfgg = base.sfgg !== undefined ? base.sfgg : (rest[idx++] ?? null);
      const sfggFaglKbh = base.sfggFaglKbh !== undefined ? base.sfggFaglKbh : (rest[idx++] ?? null);
      const sfggFaglProv = base.sfggFaglProv !== undefined ? base.sfggFaglProv : (rest[idx++] ?? null);
      const sfggUfaglKbh = base.sfggUfaglKbh !== undefined ? base.sfggUfaglKbh : (rest[idx++] ?? null);
      const sfggUfaglProv = base.sfggUfaglProv !== undefined ? base.sfggUfaglProv : (rest[idx++] ?? null);

    return {
      fritvalg,
      sfgg,
      fraDato: d(fraDatoStr),
      grundloen,
      shSoSats,
      agPension,
      sfggFaglKbh,
      sfggFaglProv,
      sfggUfaglKbh,
      sfggUfaglProv,
    };
  });
};

// ===== OVERENSKOMST DATA =====

/**
 * Alle overenskomster med deres satser
 */
const offentligeOverenskomster: ReadonlyArray<OffentligOverenskomstMeta> = [
  {
    offentligType: 'KL',
    id: toOverenskomstId('kl-overenskomst'),
    navn: 'KL-overenskomsten',
    loenmodtagerOrg: ['Forhandlingsfællesskabet'],
    arbejdsgiverOrg: ['KL'],
    grundloenAngivetPer: 'Måned',
    sfggPolicy: {
      fravigerFerielov: false,
      model: 'ferielov',
      direkteSatsErDifferentieret: false,
      bortfalderUnderArbejdsgiverbetaltSygeloen: false,
      referenceperiodeLabel: '4 uger',
    },
  },
  {
    offentligType: 'RLTN',
    id: toOverenskomstId('rltn-overenskomst'),
    navn: 'RLTN-overenskomsten',
    loenmodtagerOrg: ['Forhandlingsfællesskabet'],
    arbejdsgiverOrg: ['RLTN'],
    grundloenAngivetPer: 'Måned',
    sfggPolicy: {
      fravigerFerielov: false,
      model: 'ferielov',
      direkteSatsErDifferentieret: false,
      bortfalderUnderArbejdsgiverbetaltSygeloen: false,
      referenceperiodeLabel: '4 uger',
    },
  },
  {
    offentligType: 'KL',
    id: toOverenskomstId('laerer-overenskomsten'),
    navn: 'Læreroverenskomsten',
    loenmodtagerOrg: ['Lærernes Centralorganisation'],
    arbejdsgiverOrg: ['KL'],
    grundloenAngivetPer: 'Måned',
    sfggPolicy: {
      fravigerFerielov: false,
      model: 'ferielov',
      direkteSatsErDifferentieret: false,
      bortfalderUnderArbejdsgiverbetaltSygeloen: false,
      referenceperiodeLabel: '4 uger',
    },
  },
];

const offentligeOverenskomstSatser: ReadonlyArray<OffentligOverenskomstSatser> = [
  {
    id: toOverenskomstId('laerer-overenskomsten'),
    satser: satserFromTable(
      {
        shSoSats: null,
        sfgg: null,
        sfggFaglKbh: null,
        sfggFaglProv: null,
        sfggUfaglKbh: null,
        sfggUfaglProv: null,
      },
      [
        // fraDato          │ Grundløn   │ Fritvalg │ AG-pens.
        ['01-04-2025',       null,         0.0146,    0.1730 ],
        ['01-04-2022',       null,         0.0138,    0.1730 ],
        ['01-04-2019',       null,         0.0083,    0.1730 ],
        ['01-01-2012',       null,         0.0064,    0.1730 ],
      ]
    ),
  },
];

export const overenskomster: ReadonlyArray<Overenskomst> = [
  // Bygge-/anlægsoverenskomsten
  {
    meta: {
      id:               toOverenskomstId('bygge-anlaeg'),
      navn:             'Bygge-/anlægsoverenskomsten',
      loenmodtagerOrg:  ['3F'],
      arbejdsgiverOrg:  ['Dansk Industri', 'Dansk Byggeri'],
      grundloenAngivetPer: 'Time',
      sfggPolicy: {
        fravigerFerielov: true,
        model: 'direkte_sats',
        direkteSatsErDifferentieret: true,
        bortfalderUnderArbejdsgiverbetaltSygeloen: true,
        referenceperiodeLabel: null,
      },
    },
    shDageAlmindeligLoenRegel: { shSoDelta: -0.059 },
    satser: satserFromTable(
      { fritvalg: null, sfgg: null },
      [
        // fraDato          │ Grundløn         │ SH/SO-sats          │ AG-pens.         │ SFGG Fagl.Kbh    │ SFGG Fagl.Prov   │ SFGG Ufagl.Kbh   │ SFGG Ufagl.Prov
        ['01-03-2027',            153.40,             0.167,            0.1115,            217.20,            202.40,            191.40,            192.45 ],
        ['01-03-2026',            149.90,             0.157,            0.1115,            217.20,            202.40,            191.40,            192.45 ],
        ['01-05-2025',            146.40,             0.147,            0.1115,            217.20,            202.40,            191.40,            192.45 ],
        ['01-01-2025',            142.65,             0.147,            0.1015,            217.20,            202.40,            191.40,            192.45 ],
        ['01-03-2024',            142.65,             0.147,            0.1015,            207.90,            195.90,            184.45,            186.45 ],
        ['01-06-2023',            138.15,             0.129,            0.1015,            204.25,            190.75,            185.40,            183.90 ],
        ['01-03-2023',            138.15,             0.129,            0.0815,            204.25,            190.75,            185.40,            183.90 ],
        ['01-03-2022',            133.65,             0.129,            0.0815,            201.50,            187.20,            179.60,            179.60 ],
        ['01-01-2021',            131.15,             0.119,            0.0815,            199.75,            184.60,            176.60,            178.45 ],
        ['01-05-2020',            128.65,             0.109,            0.0815,            198.40,            182.90,            173.00,            175.40 ],
        ['01-03-2019',            126.15,             0.099,            0.0815,            191.60,            178.70,            170.35,            172.50 ],
        ['01-03-2018',            124.15,             0.093,            0.0815,            186.40,            174.80,            168.50,            170.65 ],
        ['01-03-2017',            122.15,             0.086,            0.0815,            183.90,            172.05,            166.20,            169.25 ],
        ['01-03-2016',            120.15,             0.079,            0.0815,            180.25,            168.95,            164.10,            168.30 ],
        ['01-03-2015',            118.35,             0.076,            0.0815,            182.00,            167.45,            162.70,            167.15 ],
        ['01-03-2014',            116.70,             0.072,            0.0815,            182.85,            166.50,            167.75,            163.55 ],
        ['01-03-2013',            115.20,             0.069,            0.0815,            180.15,            164.25,            163.15,            162.25 ],
        ['01-03-2012',            113.85,             0.069,            0.0815,            179.15,            164.65,            159.30,            156.65 ],
        ['01-03-2011',            112.50,             0.069,            0.0800,            177.80,            163.95,            157.30,            158.15 ]
      ]
    ),

  },

  // Bygningsoverenskomsten
  {
    meta: {
      id:               toOverenskomstId('bygningsoverenskomsten'),
      navn:             'Bygningsoverenskomsten',
      loenmodtagerOrg:  ['3F'],
      arbejdsgiverOrg:  ['Dansk Industri', 'Dansk Byggeri'],
      grundloenAngivetPer: 'Time',
      sfggPolicy: {
        fravigerFerielov: true,
        model: 'direkte_sats',
        direkteSatsErDifferentieret: true,
        bortfalderUnderArbejdsgiverbetaltSygeloen: true,
        referenceperiodeLabel: null,
      },
    },
    shDageAlmindeligLoenRegel: { shSoDelta: -0.059 },
    satser: satserFromTable(
      { fritvalg: null, sfgg: null },
      [
        // fraDato          │ Grundløn         │ SH/SO-sats          │ AG-pens.         │ SFGG Fagl.Kbh    │ SFGG Fagl.Prov   │ SFGG Ufagl.Kbh   │ SFGG Ufagl.Prov
        ['01-03-2027',            153.15,             0.167,            0.1115,            217.20,            202.40,            191.40,            192.45 ],
        ['01-03-2026',            149.65,             0.157,            0.1115,            217.20,            202.40,            191.40,            192.45 ],
        ['01-05-2025',            146.15,             0.147,            0.1115,            217.20,            202.40,            191.40,            192.45 ],
        ['01-01-2025',            142.40,             0.147,            0.1015,            217.20,            202.40,            191.40,            192.45 ],
        ['01-03-2024',            142.40,             0.147,            0.1015,            207.90,            195.90,            184.45,            186.45 ],
        ['01-06-2023',            137.90,             0.129,            0.1015,            204.25,            190.75,            185.40,            183.90 ],
        ['01-03-2023',            137.90,             0.129,            0.0815,            204.25,            190.75,            185.40,            183.90 ],
        ['01-03-2022',            133.40,             0.129,            0.0815,            201.50,            187.20,            179.60,            179.60 ],
        ['01-01-2021',            130.90,             0.119,            0.0815,            199.75,            184.60,            176.60,            178.45 ],
        ['01-05-2020',            128.40,             0.109,            0.0815,            198.40,            182.90,            173.00,            175.40 ],
        ['01-03-2019',            125.90,             0.099,            0.0815,            191.60,            178.70,            170.35,            172.50 ],
        ['01-03-2018',            123.90,             0.093,            0.0815,            186.40,            174.80,            168.50,            170.65 ],
        ['01-03-2017',            121.90,             0.086,            0.0815,            183.90,            172.05,            166.20,            169.25 ],
        ['01-03-2016',            119.90,             0.079,            0.0815,            180.25,            168.95,            164.10,            168.30 ],
        ['01-03-2015',            118.10,             0.076,            0.0815,            182.00,            167.45,            162.70,            167.15 ],
        ['01-03-2014',            116.45,             0.072,            0.0815,            182.85,            166.50,            167.75,            163.55 ],
        ['01-03-2013',            114.95,             0.069,            0.0815,            180.15,            164.25,            163.15,            162.25 ],
        ['01-03-2012',            113.60,             0.069,            0.0815,            179.15,            164.65,            159.30,            156.65 ],
        ['01-03-2011',            112.25,             0.069,            0.0800,            177.80,            163.95,            157.30,            158.15 ]
      ]
    ),

  },

  // El-overenskomsten
  {
    meta: {
      id:               toOverenskomstId('el-overenskomsten'),
      navn:             'El-overenskomsten',
      loenmodtagerOrg:  ['Dansk El-Forbund'],
      arbejdsgiverOrg:  ['Dansk Industri', 'Dansk Byggeri'],
      grundloenAngivetPer: 'Time',
      sfggPolicy: {
        fravigerFerielov: true,
        model: 'direkte_sats',
        direkteSatsErDifferentieret: true,
        bortfalderUnderArbejdsgiverbetaltSygeloen: true,
        referenceperiodeLabel: null,
      },
    },
    satser: satserFromTable(
      { sfgg: null },
      [
        // fraDato          │ Grundløn         │ SH/SO-sats          │ Fritvalg            │ AG-pens.         │ SFGG Fagl.Kbh    │ SFGG Fagl.Prov   │ SFGG Ufagl.Kbh   │ SFGG Ufagl.Prov
        ['01-03-2027',            146.85,             0.099,              0.0700,            0.1115,            217.20,            202.40,            191.40,            192.45 ],
        ['01-03-2026',            143.35,             0.099,              0.0600,            0.1115,            217.20,            202.40,            191.40,            192.45 ],
        ['01-05-2025',            139.85,             0.099,              0.0500,            0.1115,            217.20,            202.40,            191.40,            192.45 ],
        ['01-03-2024',            136.10,             0.099,              0.0500,            0.1015,            207.90,            195.90,            184.45,            186.45 ],
        ['01-01-2024',            136.10,             0.099,              0.0300,            0.1015,            204.25,            190.75,            185.40,            183.90 ],
        ['01-06-2023',            131.60,             0.099,              0.0300,            0.1015,            204.25,            190.75,            185.40,            183.90 ],
        ['01-05-2023',            131.60,             0.099,              0.0300,            0.0815,            204.25,            190.75,            185.40,            183.90 ],
        ['01-03-2022',            127.10,             0.099,              0.0300,            0.0815,            201.50,            187.20,            179.60,            179.60 ],
        ['01-01-2021',            124.60,             0.099,              0.0200,            0.0815,            199.75,            184.60,            176.60,            178.45 ],
        ['01-05-2020',            122.10,             0.099,              0.0100,            0.0815,            198.40,            182.90,            173.00,            175.40 ]
      ]
    ),
  },

  // Elektrikeroverenskomsten
  {
    meta: {
      id:               toOverenskomstId('elektrikeroverenskomsten'),
      navn:             'Elektrikeroverenskomsten',
      loenmodtagerOrg:  ['Dansk El-Forbund'],
      arbejdsgiverOrg:  ['Tekniq'],
      grundloenAngivetPer: 'Time',
      sfggPolicy: {
        fravigerFerielov: true,
        model: 'ferielov',
        direkteSatsErDifferentieret: false,
        bortfalderUnderArbejdsgiverbetaltSygeloen: false,
        referenceperiodeLabel: '3 måneder',
      },
    },
    satser: satserFromTable(
      { sfgg: null, sfggFaglKbh: null, sfggFaglProv: null, sfggUfaglKbh: null, sfggUfaglProv: null },
      [
        // fraDato          │ Grundløn         │ SH/SO-sats          │ Fritvalg            │ AG-pens.
        ['01-03-2027',            145.75,             0.062,              0.1100,            0.1100 ],
        ['01-03-2026',            142.25,             0.062,              0.1100,            0.1100 ],
        ['01-05-2025',            138.75,             0.062,              0.1000,            0.1100 ],
        ['01-03-2025',            138.75,             0.062,              0.1000,            0.1000 ],
        ['01-03-2024',            135.00,             0.062,              0.0900,            0.1000 ],
        ['01-06-2023',            130.50,             0.062,              0.0700,            0.1000 ],
        ['01-03-2023',            130.50,             0.062,              0.0700,            0.0800 ],
        ['01-03-2022',            126.00,             0.062,              0.0700,            0.0800 ],
        ['01-03-2021',            123.50,             0.062,              0.0600,            0.0800 ],
        ['01-03-2020',            121.00,             0.062,              0.0500,            0.0800 ],
        ['01-03-2019',            118.50,             0.062,              0.0400,            0.0800 ],
        ['01-03-2018',            116.50,             0.062,              0.0340,            0.0800 ],
        ['01-03-2017',            114.50,             0.062,              0.0270,            0.0800 ],
        ['01-03-2016',            112.50,             0.062,              0.0200,            0.0800 ],
        ['01-03-2015',            110.70,             0.062,              0.0170,            0.0800 ],
        ['01-03-2014',            109.05,             0.062,              0.0130,            0.0800 ]
      ]
    ),
  },

  // Fællesoverenskomsten (DIO II)
  {
    meta: {
      id:               toOverenskomstId('faellesoverenskomsten-dio-ii'),
      navn:             'Fællesoverenskomsten (DIO II)',
      loenmodtagerOrg:  ['3F'],
      arbejdsgiverOrg:  ['Dansk Industri'],
      grundloenAngivetPer: 'Time',
      sfggPolicy: {
        fravigerFerielov: true,
        model: 'direkte_sats',
        direkteSatsErDifferentieret: false,
        bortfalderUnderArbejdsgiverbetaltSygeloen: false,
        referenceperiodeLabel: null,
      },
    },
    satser: satserFromTable(
      { fritvalg: null, sfggFaglKbh: null, sfggFaglProv: null, sfggUfaglKbh: null, sfggUfaglProv: null },
      [
        // fraDato          │ Grundløn         │ SH/SO-sats          │ AG-pens.         │ SFGG
        ['01-03-2027',            162.95,            0.0675,            0.1100,            164.70 ],
        ['01-03-2026',            158.45,            0.0675,            0.1100,            160.53 ],
        ['01-05-2025',            153.70,            0.0675,            0.1100,            156.14 ],
        ['01-03-2025',            153.70,            0.0675,            0.1000,            156.14 ],
        ['01-03-2024',            148.70,            0.0675,            0.1000,            151.52 ],
        ['01-06-2023',            142.95,            0.0675,            0.1000,            146.20 ],
        ['01-03-2023',            142.95,            0.0675,            0.0800,            146.20 ],
        ['01-03-2022',            136.95,            0.0675,            0.0800,            140.65 ],
        ['01-03-2021',            133.80,            0.0675,            0.0800,            137.73 ],
        ['01-03-2020',            130.60,            0.0675,            0.0800,            134.77 ],
        ['01-03-2019',            127.40,            0.0675,            0.0800,            131.81 ],
        ['01-03-2018',            124.90,            0.0675,            0.0800,            129.50 ],
        ['01-03-2017',            122.40,            0.0675,            0.0800,            127.19 ],
        ['01-03-2016',            119.90,            0.0675,            0.0800,            124.88 ],
        ['01-03-2015',            117.50,            0.0675,            0.0800,            122.66 ],
        ['01-03-2014',            115.25,            0.0675,            0.0800,            120.57 ],
        ['01-03-2013',            113.15,            0.0675,            0.0800,            118.63 ],
        ['01-03-2012',            111.30,            0.0675,            0.0800,            116.92 ],
        ['01-03-2011',            109.70,            0.0675,            0.0800,            115.44 ]
      ]
    ),
  },

  // Glasoverenskomsten
  {
    meta: {
      id:               toOverenskomstId('glasoverenskomsten'),
      navn:             'Glasoverenskomsten',
      loenmodtagerOrg:  ['3F'],
      arbejdsgiverOrg:  ['Glarmesterlauget'],
      grundloenAngivetPer: 'Time',
      sfggPolicy: {
        fravigerFerielov: true,
        model: 'direkte_sats',
        direkteSatsErDifferentieret: true,
        bortfalderUnderArbejdsgiverbetaltSygeloen: true,
        referenceperiodeLabel: null,
      },
    },
    satser: satserFromTable(
      { fritvalg: null, sfgg: null },
      [
        // fraDato          │ Grundløn         │ SH/SO-sats          │ AG-pens.         │ SFGG Fagl.Kbh    │ SFGG Fagl.Prov   │ SFGG Ufagl.Kbh   │ SFGG Ufagl.Prov
        ['01-03-2027',            153.15,             0.167,            0.1115,            217.20,            202.40,            191.40,            192.45 ],
        ['01-03-2026',            149.65,             0.157,            0.1115,            217.20,            202.40,            191.40,            192.45 ],
        ['01-05-2025',            146.15,             0.147,            0.1115,            217.20,            202.40,            191.40,            192.45 ],
        ['01-01-2025',            142.40,             0.147,            0.1015,            217.20,            202.40,            191.40,            192.45 ],
        ['01-03-2024',            142.40,             0.147,            0.1015,            207.90,            195.90,            184.45,            186.45 ],
        ['01-06-2023',            137.90,             0.129,            0.1015,            204.25,            190.75,            185.40,            183.90 ],
        ['01-03-2023',            137.90,             0.129,            0.0815,            204.25,            190.75,            185.40,            183.90 ],
        ['01-03-2022',            133.40,             0.129,            0.0815,            201.50,            187.20,            179.60,            179.60 ],
        ['01-01-2021',            130.90,             0.119,            0.0815,            199.75,            184.60,            176.60,            178.45 ],
        ['01-05-2020',            128.40,             0.109,            0.0815,            198.40,            182.90,            173.00,            175.40 ],
        ['01-03-2019',            125.90,             0.099,            0.0815,            191.60,            178.70,            170.35,            172.50 ],
        ['01-03-2018',            123.90,             0.093,            0.0815,            186.40,            174.80,            168.50,            170.65 ],
        ['01-03-2017',            121.90,             0.086,            0.0815,            183.90,            172.05,            166.20,            169.25 ],
        ['01-03-2016',            119.90,             0.079,            0.0815,            180.25,            168.95,            164.10,            168.30 ],
        ['01-03-2015',            118.10,             0.076,            0.0815,            182.00,            167.45,            162.70,            167.15 ],
        ['01-03-2014',            116.45,             0.072,            0.0815,            182.85,            166.50,            167.75,            163.55 ],
        ['01-03-2013',            114.95,             0.069,            0.0815,            180.15,            164.25,            163.15,            162.25 ],
        ['01-03-2012',            113.60,             0.069,            0.0815,            179.15,            164.65,            159.30,            156.65 ],
        ['01-03-2011',            112.25,             0.069,            0.0800,            177.80,            163.95,            157.30,            158.15 ]
      ]
    ),
  },

  // Hoteloverenskomsten
  {
    meta: {
      id:               toOverenskomstId('hoteloverenskomsten'),
      navn:             'Hoteloverenskomsten',
      loenmodtagerOrg:  ['3F'],
      arbejdsgiverOrg:  ['Horesta'],
      grundloenAngivetPer: 'Time',
      sfggPolicy: {
        fravigerFerielov: false,
        model: 'ferielov',
        direkteSatsErDifferentieret: false,
        bortfalderUnderArbejdsgiverbetaltSygeloen: false,
        referenceperiodeLabel: '4 uger',
      },
    },
    satser: satserFromTable(
      { fritvalg: null, shSoSats: null, sfgg: null, sfggFaglKbh: null, sfggFaglProv: null, sfggUfaglKbh: null, sfggUfaglProv: null },
      [
        // fraDato          │ Grundløn         │ AG-pens.
        ['01-03-2027',            168.92,            0.1115 ],
        ['01-03-2026',            165.07,            0.1115 ],
        ['01-05-2025',            161.22,            0.1115 ],
        ['01-03-2024',            157.10,            0.1015 ],
        ['01-06-2023',            152.15,            0.1015 ],
        ['01-03-2023',            152.15,            0.0815 ],
        ['01-03-2022',            147.20,            0.0815 ],
        ['01-03-2021',            144.45,            0.0815 ],
        ['01-03-2020',            141.70,            0.0815 ],
        ['01-03-2019',            138.95,            0.0815 ],
        ['01-03-2018',            136.75,            0.0815 ],
        ['01-03-2017',            134.55,            0.0815 ],
        ['01-03-2016',            132.35,            0.0815 ],
        ['01-03-2015',            130.37,            0.0815 ],
        ['01-03-2014',            128.55,            0.0815 ],
        ['01-03-2013',            126.90,            0.0800 ],
        ['01-03-2012',            125.42,            0.0800 ],
        ['01-03-2011',            123.93,            0.0800 ]
      ]
    ),
  },

  // Industri- og VVS-overenskomsten
  {
    meta: {
      id:               toOverenskomstId('industri-og-vvs-overenskomsten'),
      navn:             'Industri- og VVS-overenskomsten',
      loenmodtagerOrg:  ['Dansk Metal', '3F', 'Blik&Rør'],
      arbejdsgiverOrg:  ['Tekniq'],
      grundloenAngivetPer: 'Time',
      sfggPolicy: {
        fravigerFerielov: true,
        model: 'ferielov',
        direkteSatsErDifferentieret: false,
        bortfalderUnderArbejdsgiverbetaltSygeloen: false,
        referenceperiodeLabel: '3 måneder',
      },
    },
    shDageAlmindeligLoenRegel: { fritvalgDelta: -0.04 },
    satser: satserFromTable(
      { shSoSats: null, sfgg: null, sfggFaglKbh: null, sfggFaglProv: null, sfggUfaglKbh: null, sfggUfaglProv: null },
      [
        // fraDato          │ Grundløn         │ Fritvalg            │ AG-pens.
        ['01-03-2027',            146.90,            0.1750,            0.1100 ],
        ['01-03-2026',            143.40,            0.1650,            0.1100 ],
        ['01-05-2025',            139.90,            0.1550,            0.1100 ],
        ['01-03-2024',            136.15,            0.1550,            0.1000 ]
      ]
    ),
  },

  // Industri-, træ- og møbeloverenskomsten
  {
    meta: {
      id:               toOverenskomstId('industri-trae-og-moebeloverenskomsten'),
      navn:             'Industri-, træ- og møbeloverenskomsten',
      loenmodtagerOrg:  ['3F'],
      arbejdsgiverOrg:  ['Dansk Industri'],
      grundloenAngivetPer: 'Time',
      sfggPolicy: {
        fravigerFerielov: false,
        model: 'ferielov',
        direkteSatsErDifferentieret: false,
        bortfalderUnderArbejdsgiverbetaltSygeloen: false,
        referenceperiodeLabel: '4 uger',
      },
    },
    shDageAlmindeligLoenRegel: { shSoDelta: -0.049 },
    satser: satserFromTable(
      { fritvalg: null, sfgg: null, sfggFaglKbh: null, sfggFaglProv: null, sfggUfaglKbh: null, sfggUfaglProv: null },
      [
        // fraDato          │ Grundløn         │ SH/SO-sats          │ AG-pens.
        ['01-03-2027',            146.90,             0.169,            0.1115 ],
        ['01-03-2026',            143.40,             0.159,            0.1115 ],
        ['01-05-2025',            139.90,             0.149,            0.1115 ],
        ['01-03-2024',            138.10,             0.149,            0.1015 ],
        ['01-06-2023',            133.60,             0.129,            0.1015 ],
        ['01-03-2023',            133.60,             0.129,            0.0815 ],
        ['01-03-2022',            129.10,             0.129,            0.0815 ],
        ['01-01-2021',            126.60,             0.119,            0.0815 ],
        ['01-05-2020',            124.10,             0.109,            0.0815 ],
        ['01-03-2019',            121.60,             0.099,            0.0815 ],
        ['01-03-2018',            119.60,             0.093,            0.0815 ],
        ['01-03-2017',            117.60,             0.086,            0.0815 ],
        ['01-03-2016',            115.60,             0.079,            0.0815 ],
        ['01-03-2015',            113.80,             0.076,            0.0815 ],
        ['01-03-2014',            112.15,             0.072,            0.0815 ],
        ['01-03-2013',            110.65,             0.069,            0.0815 ],
        ['01-03-2012',            109.30,             0.069,            0.0815 ],
        ['01-03-2011',            107.95,             0.069,            0.0800 ]
      ]
    ),

  },

  // Industriens overenskomst
  {
    meta: {
      id:               toOverenskomstId('industriens-overenskomst'),
      navn:             'Industriens overenskomst',
      loenmodtagerOrg:  ['CO-Industri', '3F', 'Blik&Rør', 'Dansk El-Forbund', 'Dansk Metal', 'HK Privat', 'Malerforbundet', 'Teknisk Landsforbund', 'Serviceforbundet', 'Dansk Jernbaneforbund'],
      arbejdsgiverOrg:  ['Dansk Industri'],
      grundloenAngivetPer: 'Time',
      sfggPolicy: {
        fravigerFerielov: true,
        model: 'ferielov',
        direkteSatsErDifferentieret: false,
        bortfalderUnderArbejdsgiverbetaltSygeloen: true,
        referenceperiodeLabel: '3 måneder',
      },
    },
    shDageAlmindeligLoenRegel: { fritvalgDelta: -0.04 },
    satser: satserFromTable(
      { shSoSats: null, sfgg: null, sfggFaglKbh: null, sfggFaglProv: null, sfggUfaglKbh: null, sfggUfaglProv: null },
      [
        // fraDato          l Grundl>n         l Fritvalg         l AG-pens.
        ['01-03-2027',            146.90,            0.1500,            0.1100 ],
        ['01-03-2026',            143.40,            0.1400,            0.1100 ],
        ['01-05-2025',            139.90,            0.1300,            0.1100 ],
        ['01-03-2024',            136.15,            0.1300,            0.1000 ],
        ['01-06-2023',            131.65,            0.1100,            0.1000 ],
        ['01-03-2023',            131.65,            0.1100,            0.0800 ],
        ['01-03-2022',            127.15,            0.1100,            0.0800 ],
        ['01-03-2021',            124.65,            0.1000,            0.0800 ],
        ['01-03-2020',            122.15,            0.0900,            0.0800 ],
        ['01-03-2019',            119.65,            0.0800,            0.0800 ],
        ['01-03-2018',            117.65,            0.0740,            0.0800 ],
        ['01-03-2017',            115.65,            0.0670,            0.0800 ],
        ['01-03-2016',            113.65,            0.0600,            0.0800 ],
        ['01-03-2015',            111.85,            0.0570,            0.0800 ],
        ['01-03-2014',            110.20,            0.0530,            0.0800 ],
        ['01-03-2013',            108.70,            0.0500,            0.0800 ],
        ['01-03-2012',            107.35,            0.0500,            0.0800 ],
        ['01-03-2011',            106.00,            0.0500,            0.0800 ]
      ]
    ),

  },

  // Landsoverenskomsten (AKT)
  {
    meta: {
      id:               toOverenskomstId('landsoverenskomsten-akt'),
      navn:             'Landsoverenskomsten (AKT)',
      loenmodtagerOrg:  ['3F'],
      arbejdsgiverOrg:  ['Dansk Industri'],
      grundloenAngivetPer: 'Time',
      sfggPolicy: {
        fravigerFerielov: false,
        model: 'ferielov',
        direkteSatsErDifferentieret: false,
        bortfalderUnderArbejdsgiverbetaltSygeloen: false,
        referenceperiodeLabel: '4 uger',
      },
    },
    satser: satserFromTable(
      { fritvalg: null, sfgg: null, shSoSats: null, sfggFaglKbh: null, sfggFaglProv: null, sfggUfaglKbh: null, sfggUfaglProv: null },
      [
        // fraDato          │ Grundløn         │ AG-pens.
        ['01-03-2027',            176.72,            0.1100 ],
        ['01-03-2026',            172.22,            0.1100 ],
        ['01-05-2025',            167.47,            0.1100 ],
        ['01-03-2025',            167.47,            0.1000 ],
        ['01-03-2024',            162.47,            0.1000 ],
        ['01-06-2023',            156.72,            0.1000 ],
        ['01-03-2022',            150.72,            0.0800 ],
        ['01-03-2021',            147.57,            0.0800 ],
        ['01-03-2020',            144.37,            0.0800 ],
        ['01-03-2019',            142.36,            0.0800 ],
        ['01-03-2018',            139.86,            0.0800 ],
        ['01-03-2017',            137.36,            0.0800 ],
        ['01-03-2016',            134.86,            0.0800 ],
        ['01-03-2015',            132.46,            0.0800 ],
        ['01-03-2014',            130.21,            0.0800 ],
        ['01-03-2013',            126.92,            0.0800 ],
        ['01-03-2012',            125.07,            0.0800 ],
        ['01-03-2011',            124.66,            0.0800 ]
      ]
    ),
  },

  // Låsesmedeoverenskomsten
  {
    meta: {
      id:               toOverenskomstId('laasesmedeoverenskomsten'),
      navn:             'Låsesmedeoverenskomsten',
      loenmodtagerOrg:  ['Dansk Metal', '3F'],
      arbejdsgiverOrg:  ['Låsesmedeforeningen'],
      grundloenAngivetPer: 'Time',
      sfggPolicy: {
        fravigerFerielov: true,
        model: 'ferielov',
        direkteSatsErDifferentieret: false,
        bortfalderUnderArbejdsgiverbetaltSygeloen: false,
        referenceperiodeLabel: '3 måneder',
      },
    },
    shDageAlmindeligLoenRegel: { fritvalgDelta: -0.04 },
    satser: satserFromTable(
      { shSoSats: null, sfgg: null, sfggFaglKbh: null, sfggFaglProv: null, sfggUfaglKbh: null, sfggUfaglProv: null },
      [
        // fraDato          │ Grundløn         │ Fritvalg            │ AG-pens.
        ['01-03-2027',            146.90,            0.1750,            0.1100 ],
        ['01-03-2026',            143.40,            0.1650,            0.1100 ],
        ['01-05-2025',            139.90,            0.1550,            0.1100 ],
        ['01-03-2024',            136.15,            0.1550,            0.1000 ]
      ]
    ),
  },

  // Maskinhandler-overenskomsten
  {
    meta: {
      id:               toOverenskomstId('maskinhandler-overenskomsten'),
      navn:             'Maskinhandler-overenskomsten',
      loenmodtagerOrg:  ['Dansk Metal', '3F'],
      arbejdsgiverOrg:  ['DM-Arbejdsgiver'],
      grundloenAngivetPer: 'Time',
      sfggPolicy: {
        fravigerFerielov: true,
        model: 'ferielov',
        direkteSatsErDifferentieret: false,
        bortfalderUnderArbejdsgiverbetaltSygeloen: false,
        referenceperiodeLabel: '3 måneder',
      },
    },
    shDageAlmindeligLoenRegel: { fritvalgDelta: -0.045 },
    satser: satserFromTable(
      { shSoSats: null, sfgg: null, sfggFaglKbh: null, sfggFaglProv: null, sfggUfaglKbh: null, sfggUfaglProv: null },
      [
        // fraDato          │ Grundløn         │ Fritvalg            │ AG-pens.
        ['01-03-2027',            146.90,            0.1900,            0.1150 ],
        ['01-03-2026',            143.40,            0.1800,            0.1150 ],
        ['01-05-2025',            139.90,            0.1700,            0.1150 ],
        ['01-03-2024',            136.15,            0.1700,            0.1050 ]
      ]
    ),
  },

  // Mejerioverenskomsten
  {
    meta: {
      id:               toOverenskomstId('mejeribranchens-faellesoverenskomst'),
      navn:             'Mejeribranchens Fællesoverenskomst',
      loenmodtagerOrg:  ['NNF', '3F'],
      arbejdsgiverOrg:  ['Dansk Industri'],
      grundloenAngivetPer: 'Time',
      sfggPolicy: {
        fravigerFerielov: false,
        model: 'ferielov',
        direkteSatsErDifferentieret: false,
        bortfalderUnderArbejdsgiverbetaltSygeloen: false,
        referenceperiodeLabel: '4 uger',
      },
    },
    satser: satserFromTable(
      { fritvalg: null, sfgg: null, shSoSats: null, sfggFaglKbh: null, sfggFaglProv: null, sfggUfaglKbh: null, sfggUfaglProv: null },
      [
        // fraDato          │ Grundløn         │ AG-pens.
        ['01-03-2027',            201.97,            0.1166 ],
        ['01-03-2026',            190.62,            0.1166 ],
        ['01-03-2025',            185.62,            0.1166 ],
        ['01-03-2024',            180.62,            0.1066 ],
        ['01-06-2023',            174.87,            0.1066 ],
        ['01-03-2023',            174.87,            0.0866 ],
        ['01-03-2022',            168.87,            0.0866 ],
        ['01-03-2021',            165.72,            0.0866 ],
        ['01-03-2020',            162.52,            0.0866 ],
        ['01-03-2019',            159.32,            0.0866 ],
        ['01-03-2018',            156.82,            0.0866 ],
        ['01-03-2017',            154.32,            0.0866 ],
        ['01-03-2016',            151.82,            0.0866 ],
        ['01-03-2015',            149.42,            0.0866 ],
        ['01-03-2014',            147.17,            0.0866 ],
        ['01-03-2013',            145.47,            0.0866 ],
        ['01-03-2012',            143.22,            0.0866 ],
        ['01-03-2011',            140.97,            0.0866 ]
      ]
    ),
  },

  // Metal-Transport overenskomsten
  {
    meta: {
      id:               toOverenskomstId('metal-transport-overenskomsten'),
      navn:             'Metal-Transport overenskomsten',
      loenmodtagerOrg:  ['Dansk Metal'],
      arbejdsgiverOrg:  ['Dansk Industri'],
      grundloenAngivetPer: 'Time',
      sfggPolicy: {
        fravigerFerielov: false,
        model: 'ferielov',
        direkteSatsErDifferentieret: false,
        bortfalderUnderArbejdsgiverbetaltSygeloen: false,
        referenceperiodeLabel: '4 uger',
      },
    },
    satser: satserFromTable(
      { fritvalg: null, sfgg: null, sfggFaglKbh: null, sfggFaglProv: null, sfggUfaglKbh: null, sfggUfaglProv: null },
      [
        // fraDato          │ Grundløn         │ SH/SO-sats          │ AG-pens.
        ['01-03-2027',            149.64,             0.110,            0.1100 ],
        ['01-03-2026',            146.08,             0.100,            0.1100 ],
        ['01-05-2025',            142.51,             0.090,            0.1100 ],
        ['01-03-2025',            142.51,             0.090,            0.1000 ]
      ]
    ),
  },

  // Mureroverenskomsten
  {
    meta: {
      id:               toOverenskomstId('mureroverenskomsten'),
      navn:             'Mureroverenskomsten',
      loenmodtagerOrg:  ['3F'],
      arbejdsgiverOrg:  ['Dansk Industri', 'Dansk Byggeri'],
      grundloenAngivetPer: 'Time',
      sfggPolicy: {
        fravigerFerielov: true,
        model: 'direkte_sats',
        direkteSatsErDifferentieret: true,
        bortfalderUnderArbejdsgiverbetaltSygeloen: true,
        referenceperiodeLabel: null,
      },
    },
    shDageAlmindeligLoenRegel: { shSoDelta: -0.059 },
    satser: satserFromTable(
      { fritvalg: null, sfgg: null },
      [
        // fraDato          │ Grundløn         │ SH/SO-sats          │ AG-pens.         │ SFGG Fagl.Kbh    │ SFGG Fagl.Prov   │ SFGG Ufagl.Kbh   │ SFGG Ufagl.Prov
        ['01-03-2027',            153.15,             0.167,            0.1115,            217.20,            202.40,            191.40,            192.45 ],
        ['01-03-2026',            149.65,             0.157,            0.1115,            217.20,            202.40,            191.40,            192.45 ],
        ['01-05-2025',            146.15,             0.147,            0.1115,            217.20,            202.40,            191.40,            192.45 ],
        ['01-01-2025',            142.40,             0.147,            0.1015,            217.20,            202.40,            191.40,            192.45 ],
        ['01-03-2024',            142.40,             0.147,            0.1015,            207.90,            195.90,            184.45,            186.45 ],
        ['01-06-2023',            137.90,             0.129,            0.1015,            204.25,            190.75,            185.40,            183.90 ],
        ['01-03-2023',            137.90,             0.129,            0.0815,            204.25,            190.75,            185.40,            183.90 ],
        ['01-03-2022',            133.40,             0.129,            0.0815,            201.50,            187.20,            179.60,            179.60 ],
        ['01-01-2021',            130.90,             0.119,            0.0815,            199.75,            184.60,            176.60,            178.45 ],
        ['01-05-2020',            128.40,             0.109,            0.0815,            198.40,            182.90,            173.00,            175.40 ],
        ['01-03-2019',            125.90,             0.099,            0.0815,            191.60,            178.70,            170.35,            172.50 ],
        ['01-03-2018',            123.90,             0.093,            0.0815,            186.40,            174.80,            168.50,            170.65 ],
        ['01-03-2017',            121.90,             0.086,            0.0815,            183.90,            172.05,            166.20,            169.25 ],
        ['01-03-2016',            119.90,             0.079,            0.0815,            180.25,            168.95,            164.10,            168.30 ],
        ['01-03-2015',            118.10,             0.076,            0.0815,            182.00,            167.45,            162.70,            167.15 ],
        ['01-03-2014',            116.45,             0.072,            0.0815,            182.85,            166.50,            167.75,            163.55 ],
        ['01-03-2013',            114.95,             0.069,            0.0815,            180.15,            164.25,            163.15,            162.25 ],
        ['01-03-2012',            113.60,             0.069,            0.0815,            179.15,            164.65,            159.30,            156.65 ],
        ['01-03-2011',            112.25,             0.069,            0.0800,            177.80,            163.95,            157.30,            158.15 ]
      ]
    ),

  },

  // Postoverenskomsten
  {
    meta: {
      id:               toOverenskomstId('postoverenskomsten'),
      navn:             'Postoverenskomsten',
      loenmodtagerOrg:  ['3F'],
      arbejdsgiverOrg:  ['Postnord'],
      grundloenAngivetPer: 'Time',
      sfggPolicy: {
        fravigerFerielov: true,
        model: 'ferielov',
        direkteSatsErDifferentieret: false,
        bortfalderUnderArbejdsgiverbetaltSygeloen: true,
        referenceperiodeLabel: '3 måneder',
      },
    },
    shDageAlmindeligLoenRegel: { shSoOverride: 0 },
    satser: satserFromTable(
      { fritvalg: null, sfgg: null, sfggFaglKbh: null, sfggFaglProv: null, sfggUfaglKbh: null, sfggUfaglProv: null },
      [
        // fraDato          │ Grundløn         │ SH/SO-sats          │ AG-pens.
        ['01-03-2024',            136.15,            0.0350,            0.1200 ],
        ['01-03-2023',            131.65,            0.0350,            0.1200 ],
        ['01-03-2022',            127.15,            0.0350,            0.1200 ],
        ['01-03-2021',            124.65,            0.0350,            0.1200 ],
        ['01-03-2020',            122.15,            0.0350,            0.1200 ],
        ['01-03-2019',            119.65,            0.0350,            0.1200 ],
        ['01-03-2018',            117.65,            0.0350,            0.1200 ],
        ['01-03-2017',            115.65,            0.0350,            0.1200 ],
        ['01-03-2016',            113.65,            0.0350,            0.1200 ],
        ['01-03-2015',            111.85,            0.0350,            0.1200 ],
        ['01-03-2014',            110.20,            0.0350,            0.1200 ],
        ['01-03-2013',            108.70,            0.0350,            0.1200 ],
        ['01-03-2012',            107.35,            0.0350,            0.1200 ],
        ['01-03-2011',            106.00,            0.0350,            0.1200 ]
      ]
    ),

  },

  // Serviceoverenskomsten
  {
    meta: {
      id:               toOverenskomstId('serviceoverenskomsten-sba'),
      navn:             'Serviceoverenskomsten (SBA)',
      loenmodtagerOrg:  ['3F'],
      arbejdsgiverOrg:  ['Dansk Industri'],
      grundloenAngivetPer: 'Time',
      sfggPolicy: {
        fravigerFerielov: false,
        model: 'ferielov',
        direkteSatsErDifferentieret: false,
        bortfalderUnderArbejdsgiverbetaltSygeloen: false,
        referenceperiodeLabel: '4 uger',
      },
    },
    satser: satserFromTable(
      { fritvalg: null, sfgg: null, sfggFaglKbh: null, sfggFaglProv: null, sfggUfaglKbh: null, sfggUfaglProv: null },
      [
        // fraDato          │ Grundløn         │ SH/SO-sats          │ AG-pens.
        ['15-03-2027',            172.00,             0.052,            0.1115 ],
        ['15-03-2026',            167.50,             0.052,            0.1115 ],
        ['15-03-2025',            162.75,             0.052,            0.1015 ],
        ['01-03-2024',            151.28,             0.052,            0.1015 ],
        ['01-06-2023',            145.53,             0.052,            0.1015 ],
        ['01-03-2023',            145.53,             0.052,            0.0815 ],
        ['01-03-2022',            139.53,             0.052,            0.0815 ],
        ['01-03-2021',            136.38,             0.052,            0.0815 ],
        ['01-03-2020',            133.18,             0.052,            0.0815 ],
        ['01-03-2019',            129.98,             0.052,            0.0815 ],
        ['01-03-2018',            127.48,             0.052,            0.0815 ],
        ['01-03-2017',            124.98,             0.052,            0.0815 ],
        ['01-03-2016',            122.48,             0.052,            0.0815 ],
        ['01-03-2015',            120.08,             0.052,            0.0815 ],
        ['01-03-2014',            117.83,             0.052,            0.0815 ],
        ['01-03-2013',            115.73,             0.052,            0.0815 ],
        ['01-03-2012',            113.88,             0.052,            0.0815 ],
        ['01-03-2011',            112.28,             0.052,            0.0800 ]
      ]
    ),
  },

  // Transportoverenskomsten (ATL)
  {
    meta: {
      id:               toOverenskomstId('transportoverenskomsten-atl'),
      navn:             'Transportoverenskomsten (ATL)',
      loenmodtagerOrg:  ['3F'],
      arbejdsgiverOrg:  ['Dansk Industri'],
      grundloenAngivetPer: 'Time',
      sfggPolicy: {
        fravigerFerielov: true,
        model: 'direkte_sats',
        direkteSatsErDifferentieret: false,
        bortfalderUnderArbejdsgiverbetaltSygeloen: false,
        referenceperiodeLabel: null,
      },
    },
    satser: satserFromTable(
      { fritvalg: null, sfggFaglKbh: null, sfggFaglProv: null, sfggUfaglKbh: null, sfggUfaglProv: null },
      [
        // fraDato          │ Grundløn         │ SH/SO-sats          │ AG-pens.         │ SFGG
        ['01-03-2027',            164.15,            0.0675,            0.1100,            164.70 ],
        ['01-03-2026',            159.65,            0.0675,            0.1100,            160.53 ],
        ['01-05-2025',            154.90,            0.0675,            0.1100,            156.14 ],
        ['01-03-2025',            154.90,            0.0675,            0.1000,            156.14 ],
        ['01-03-2024',            149.90,            0.0675,            0.1000,            151.52 ],
        ['01-06-2023',            144.15,            0.0675,            0.1000,            146.20 ],
        ['01-03-2023',            144.15,            0.0675,            0.0800,            146.20 ],
        ['01-03-2022',            138.15,            0.0675,            0.0800,            140.65 ],
        ['01-03-2021',            135.00,            0.0675,            0.0800,            137.73 ],
        ['01-03-2020',            131.80,            0.0675,            0.0800,            134.77 ],
        ['01-03-2019',            128.60,            0.0675,            0.0800,            131.81 ],
        ['01-03-2018',            126.10,            0.0675,            0.0800,            129.50 ],
        ['01-03-2017',            123.60,            0.0675,            0.0800,            127.19 ],
        ['01-03-2016',            121.10,            0.0675,            0.0800,            124.88 ],
        ['01-03-2015',            118.70,            0.0675,            0.0800,            122.66 ],
        ['01-03-2014',            116.45,            0.0675,            0.0800,            120.57 ],
        ['01-03-2013',            114.35,            0.0675,            0.0800,            118.63 ],
        ['01-03-2012',            112.50,            0.0675,            0.0800,            116.92 ],
        ['01-03-2011',            110.90,            0.0675,            0.0800,            115.44 ]
      ]
    ),
  },

  // Transportoverenskomsten (DTL)
  {
    meta: {
      id:               toOverenskomstId('transportoverenskomsten-dtl'),
      navn:             'Transportoverenskomsten (DTL)',
      loenmodtagerOrg:  ['3F'],
      arbejdsgiverOrg:  ['DTL-A'],
      grundloenAngivetPer: 'Time',
      sfggPolicy: {
        fravigerFerielov: true,
        model: 'direkte_sats',
        direkteSatsErDifferentieret: false,
        bortfalderUnderArbejdsgiverbetaltSygeloen: false,
        referenceperiodeLabel: null,
      },
    },
    satser: satserFromTable(
      { fritvalg: null, sfggFaglKbh: null, sfggFaglProv: null, sfggUfaglKbh: null, sfggUfaglProv: null },
      [
        // fraDato          │ Grundløn         │ SH/SO-sats          │ AG-pens.         │ SFGG
        ['01-03-2027',            164.15,            0.0675,            0.1100,            164.70 ],
        ['01-03-2026',            159.65,            0.0675,            0.1100,            160.53 ],
        ['01-05-2025',            154.90,            0.0675,            0.1100,            156.14 ],
        ['01-03-2025',            154.90,            0.0675,            0.1000,            156.14 ],
        ['01-03-2024',            149.90,            0.0675,            0.1000,            151.52 ],
        ['01-06-2023',            144.15,            0.0675,            0.1000,            146.20 ],
        ['01-03-2023',            144.15,            0.0675,            0.0800,            146.20 ],
        ['01-03-2022',            138.15,            0.0675,            0.0800,            140.65 ],
        ['01-03-2021',            135.00,            0.0675,            0.0800,            137.73 ],
        ['01-03-2020',            131.80,            0.0675,            0.0800,            134.77 ],
        ['01-03-2019',            128.60,            0.0675,            0.0800,            131.81 ],
        ['01-03-2018',            126.10,            0.0675,            0.0800,            129.50 ],
        ['01-03-2017',            123.60,            0.0675,            0.0800,            127.19 ],
        ['01-03-2016',            121.10,            0.0675,            0.0800,            124.88 ],
        ['01-03-2015',            118.70,            0.0675,            0.0800,            122.66 ],
        ['01-03-2014',            116.45,            0.0675,            0.0800,            120.57 ],
        ['01-03-2013',            114.35,            0.0675,            0.0800,            118.63 ],
        ['01-03-2012',            112.50,            0.0675,            0.0800,            116.92 ],
        ['01-03-2011',            110.90,            0.0675,            0.0800,            115.44 ]
      ]
    ),
  },

];

const overenskomstById = new Map<OverenskomstId, Overenskomst>();
for (const overenskomst of overenskomster) {
  if (overenskomstById.has(overenskomst.meta.id)) {
    throw new Error(`Duplicate overenskomst-ID: "${overenskomst.meta.id}"`);
  }
  overenskomstById.set(overenskomst.meta.id, overenskomst);
}

const offentligOverenskomstTypeById = new Map<OverenskomstId, OffentligOverenskomstType>();
for (const offentligMeta of offentligeOverenskomster) {
  if (offentligOverenskomstTypeById.has(offentligMeta.id)) {
    throw new Error(`Duplicate offentlig overenskomst-ID: "${offentligMeta.id}"`);
  }
  offentligOverenskomstTypeById.set(offentligMeta.id, offentligMeta.offentligType);
}

const offentligOverenskomstSatserById = new Map<OverenskomstId, OffentligOverenskomstSatser>();
const offentligOverenskomstIds = new Set(offentligeOverenskomster.map((meta) => meta.id));
for (const entry of offentligeOverenskomstSatser) {
  if (!offentligOverenskomstIds.has(entry.id)) {
    throw new Error(`Offentlig overenskomst-satser refererer ukendt ID: "${entry.id}"`);
  }
  if (offentligOverenskomstSatserById.has(entry.id)) {
    throw new Error(`Duplicate offentlig overenskomst-satser-ID: "${entry.id}"`);
  }
  offentligOverenskomstSatserById.set(entry.id, entry);
}

const overenskomstMetaById = new Map<OverenskomstId, OverenskomstMeta>();
const registerMeta = (meta: OverenskomstMeta, source: string): void => {
  if (overenskomstMetaById.has(meta.id)) {
    throw new Error(`Duplicate overenskomst-meta (${source}): "${meta.id}"`);
  }
  overenskomstMetaById.set(meta.id, meta);
};
overenskomster.forEach((ok) => registerMeta(ok.meta, 'standard'));
offentligeOverenskomster.forEach((meta) => registerMeta(meta, 'offentlig'));

const overenskomstMetaSortedByNavn: ReadonlyArray<OverenskomstMeta> = (() => {
  const collator = new Intl.Collator('da-DK', { usage: 'sort', sensitivity: 'base', numeric: true });
  return Array.from(overenskomstMetaById.values())
    .slice()
    .sort((a, b) => {
      const byName = collator.compare(a.navn, b.navn);
      if (byName !== 0) return byName;
      return collator.compare(a.id as string, b.id as string);
    });
})();

const hasDirekteSfggSats = (satser: ReadonlyArray<OverenskomstPeriodeSats>): boolean =>
  satser.some((sats) =>
    [sats.sfgg, sats.sfggFaglKbh, sats.sfggFaglProv, sats.sfggUfaglKbh, sats.sfggUfaglProv]
      .some((value) => value !== null)
  );

const hasDifferentieretSfggSats = (satser: ReadonlyArray<OverenskomstPeriodeSats>): boolean =>
  satser.some((sats) =>
    [sats.sfggFaglKbh, sats.sfggFaglProv, sats.sfggUfaglKbh, sats.sfggUfaglProv]
      .some((value) => value !== null)
  );

const inferFravigerFerielovFromPolicy = (policy: OverenskomstSfggPolicy): boolean =>
  policy.model === 'direkte_sats'
  || policy.bortfalderUnderArbejdsgiverbetaltSygeloen
  || (policy.referenceperiodeLabel !== null && policy.referenceperiodeLabel !== '4 uger');

const assertValidSfggPolicy = (
  meta: OverenskomstMeta,
  satser?: ReadonlyArray<OverenskomstPeriodeSats>
): void => {
  const { sfggPolicy } = meta;

  if (inferFravigerFerielovFromPolicy(sfggPolicy) !== sfggPolicy.fravigerFerielov) {
    throw new Error(`Ugyldig SFGG-policy for overenskomst: "${meta.id}"`);
  }

  if (sfggPolicy.model === 'direkte_sats' && sfggPolicy.referenceperiodeLabel !== null) {
    throw new Error(`Direkte SFGG-sats må ikke have referenceperiode på overenskomst: "${meta.id}"`);
  }

  if (sfggPolicy.model === 'ferielov' && sfggPolicy.referenceperiodeLabel === null) {
    throw new Error(`Ferielovsmodel skal have referenceperiode på overenskomst: "${meta.id}"`);
  }

  if (!satser) return;

  if (hasDirekteSfggSats(satser) !== (sfggPolicy.model === 'direkte_sats')) {
    throw new Error(`SFGG-model matcher ikke satsdata for overenskomst: "${meta.id}"`);
  }

  if (hasDifferentieretSfggSats(satser) !== sfggPolicy.direkteSatsErDifferentieret) {
    throw new Error(`SFGG-differentiering matcher ikke satsdata for overenskomst: "${meta.id}"`);
  }
};

overenskomster.forEach((overenskomst) => assertValidSfggPolicy(overenskomst.meta, overenskomst.satser));
offentligeOverenskomster.forEach((meta) =>
  assertValidSfggPolicy(meta, offentligOverenskomstSatserById.get(meta.id)?.satser)
);

// ===== OPSLAGS-FUNKTIONER =====

/**
 * Find overenskomst by ID
 */
export const getOverenskomst = (id: OverenskomstId): Overenskomst | undefined => {
  const ref = resolveOverenskomstRefFromString(id as string);
  if (!ref) return undefined;
  return overenskomstById.get(ref.baseId);
};

/**
 * Find overenskomst-metadata ud fra et (evt. uvalideret) ID.
 *
 * Bruges typisk til UI label-opslag, hvor ID'et kommer fra persisted state
 * (og derfor ikke nødvendigvis er type-branded som OverenskomstId).
 */
export const getOverenskomstMetaById = (id: string): OverenskomstMeta | undefined => {
  const ref = resolveOverenskomstRefFromString(id);
  if (!ref) return undefined;
  return overenskomstMetaById.get(ref.baseId);
};

export const resolveOverenskomstNameOnlyDisplay = (id: string | undefined): string => {
  const trimmed = id?.trim();
  if (!trimmed) return '-';
  const meta = getOverenskomstMetaById(trimmed);
  return meta?.navn ?? trimmed;
};

export const getGrundloenAngivetPerForOverenskomst = (
  rawId: string,
  tafBeregnesSom?: 'Måneder' | 'Arbejdsdage'
): GrundloenAngivetPer | undefined => {
  const meta = getOverenskomstMetaById(rawId);
  if (!meta) return undefined;

  // Offentlige overenskomster (KL/RLTN) styres i runtime af brugerens valg
  // af TAF-beregningsenhed. Meta-feltet fungerer derfor som fallback/default.
  const offentligType = getOffentligOverenskomstTypeById(rawId);
  if ((offentligType === 'KL' || offentligType === 'RLTN') && tafBeregnesSom) {
    return tafBeregnesSom === 'Måneder' ? 'Måned' : 'Time';
  }

  return meta.grundloenAngivetPer;
};

/**
 * Filtrer overenskomster efter organisation
 *
 * Returnerer alle overenskomster hvor den givne organisation er part
 * (enten som lønmodtager- eller arbejdsgiverorganisation)
 */
export const getOverenskomsterByOrg = (
  loenmodtagerOrg?: string,
  arbejdsgiverOrg?: string
): ReadonlyArray<OverenskomstMeta> => {
  return overenskomstMetaSortedByNavn
    .filter((meta) => {
      const matchLoenmodtager = !loenmodtagerOrg || meta.loenmodtagerOrg.includes(loenmodtagerOrg);
      const matchArbejdsgiver = !arbejdsgiverOrg || meta.arbejdsgiverOrg.includes(arbejdsgiverOrg);
      return matchLoenmodtager && matchArbejdsgiver;
    });
};

/**
 * Hent alle unikke lønmodtagerorganisationer
 */
export const getAlleLoenmodtagerOrg = (): ReadonlyArray<string> => {
  const orgs = new Set<string>();
  overenskomstMetaSortedByNavn.forEach((meta) => {
    meta.loenmodtagerOrg.forEach((org) => orgs.add(org));
  });
  return Array.from(orgs).sort();
};

/**
 * Hent alle unikke arbejdsgiverorganisationer
 */
export const getAlleArbejdsgiverOrg = (): ReadonlyArray<string> => {
  const orgs = new Set<string>();
  overenskomstMetaSortedByNavn.forEach((meta) => {
    meta.arbejdsgiverOrg.forEach((org) => orgs.add(org));
  });
  return Array.from(orgs).sort();
};

export const getOffentligOverenskomstTypeById = (rawId: string): OffentligOverenskomstType | undefined => {
  const ref = resolveOverenskomstRefFromString(rawId);
  if (!ref) return undefined;
  return offentligOverenskomstTypeById.get(ref.baseId);
};

export const getOverenskomstSfggPolicy = (rawId: string): OverenskomstSfggPolicy | undefined => {
  const ref = resolveOverenskomstRefFromString(rawId);
  if (!ref) return undefined;
  return overenskomstMetaById.get(ref.baseId)?.sfggPolicy;
};

export const isOffentligOverenskomstId = (rawId: string): boolean =>
  Boolean(getOffentligOverenskomstTypeById(rawId));

const getOffentligTillaegsSatserForAlmindeligLoenPaaShDage = (
  entry: OffentligOverenskomstSatser,
  applyRule: boolean
): ReadonlyArray<OverenskomstPeriodeSats> => {
  if (!applyRule) return entry.satser;
  const regel = entry.shDageAlmindeligLoenRegel;
  if (!regel) return entry.satser;
  return entry.satser.map((sats) => applyShDageAlmindeligLoenRegel(sats, regel));
};

export const getOffentligTillaegsSatserForDato = (
  rawId: string,
  dato: DanishDateString,
  applyAlmindeligLoenPaaShDageRegel = false
): OverenskomstPeriodeSats | undefined => {
  const ref = resolveOverenskomstRefFromString(rawId);
  if (!ref) return undefined;

  const entry = offentligOverenskomstSatserById.get(ref.baseId);
  if (!entry) return undefined;

  const satser = getOffentligTillaegsSatserForAlmindeligLoenPaaShDage(entry, applyAlmindeligLoenPaaShDageRegel);
  return getSatserForDatoFromList(satser, dato);
};

export const getOffentligTillaegsSatserForPeriode = (
  rawId: string,
  fraDato: DanishDateString,
  tilDato: DanishDateString,
  applyAlmindeligLoenPaaShDageRegel = false
): ReadonlyArray<OverenskomstPeriodeSats> => {
  const ref = resolveOverenskomstRefFromString(rawId);
  if (!ref) return [];

  const entry = offentligOverenskomstSatserById.get(ref.baseId);
  if (!entry) return [];

  const satser = getOffentligTillaegsSatserForAlmindeligLoenPaaShDage(entry, applyAlmindeligLoenPaaShDageRegel);
  return getSatserForPeriodeFromList(satser, fraDato, tilDato);
};

/**
 * Find gaeldende satser for en given dato
 *
 * Returnerer den nyeste satsperiode der er gaeldende på den givne dato
 */
const getSatserForDatoFromList = (
  satser: ReadonlyArray<OverenskomstPeriodeSats>,
  dato: DanishDateString
): OverenskomstPeriodeSats | undefined => {
  const targetDate = danishDateToNumber(dato);

  // Find nyeste sats hvor fraDato <= dato
  for (const sats of satser) {
    if (danishDateToNumber(sats.fraDato) <= targetDate) {
      return sats;
    }
  }

  return undefined;
};

const getSatserForPeriodeFromList = (
  satser: ReadonlyArray<OverenskomstPeriodeSats>,
  fraDato: DanishDateString,
  tilDato: DanishDateString
): ReadonlyArray<OverenskomstPeriodeSats> => {
  const startDate = danishDateToNumber(fraDato);
  const endDate = danishDateToNumber(tilDato);
  if (startDate > endDate) return [];

  const relevanteFraDato = new Set<DanishDateString>();

  const satsVedStart = getSatserForDatoFromList(satser, fraDato);
  if (satsVedStart) {
    relevanteFraDato.add(satsVedStart.fraDato);
  }

  for (const sats of satser) {
    const satsDato = danishDateToNumber(sats.fraDato);
    if (satsDato > startDate && satsDato <= endDate) {
      relevanteFraDato.add(sats.fraDato);
    }
  }

  // Bevar sortering (nyeste foerst) ved at filtrere i original raekkefolge
  return satser.filter((sats) => relevanteFraDato.has(sats.fraDato));
};

const applyShDageAlmindeligLoenRegel = (
  sats: OverenskomstPeriodeSats,
  regel: ShDageAlmindeligLoenRegel
): OverenskomstPeriodeSats => {
  let shSoSats = sats.shSoSats;
  if (regel.shSoOverride !== undefined) {
    shSoSats = regel.shSoOverride;
  } else if (regel.shSoDelta !== undefined && shSoSats !== null) {
    shSoSats = shSoSats + regel.shSoDelta;
  }

  let fritvalg = sats.fritvalg;
  if (regel.fritvalgDelta !== undefined && fritvalg !== null) {
    fritvalg = fritvalg + regel.fritvalgDelta;
  }

  if (shSoSats === sats.shSoSats && fritvalg === sats.fritvalg) {
    return sats;
  }

  return { ...sats, shSoSats, fritvalg };
};

const getSatserForAlmindeligLoenPaaShDage = (
  overenskomst: Overenskomst,
  applyRule: boolean
): ReadonlyArray<OverenskomstPeriodeSats> => {
  if (!applyRule) return overenskomst.satser;
  const regel = overenskomst.shDageAlmindeligLoenRegel;
  if (!regel) return overenskomst.satser;
  return overenskomst.satser.map((sats) => applyShDageAlmindeligLoenRegel(sats, regel));
};

export const resolveOverenskomstRef = (rawId: string): OverenskomstRef | undefined =>
  resolveOverenskomstRefFromString(rawId);

export const getReguleringsDatoIntervalForOverenskomst = (rawId: string): ReguleringsDatoInterval | undefined => {
  const ref = resolveOverenskomstRefFromString(rawId);
  if (!ref) return undefined;

  const offentligType = offentligOverenskomstTypeById.get(ref.baseId);
  if (offentligType) {
    return getReguleringsDatoIntervalForOffentligLoen(offentligType);
  }

  const overenskomst = overenskomstById.get(ref.baseId);
  if (!overenskomst) return undefined;

  const satser = overenskomst.satser;
  if (satser.length === 0) return undefined;

  const nyesteDato = satser[0].fraDato;
  const aeldsteDato = satser[satser.length - 1].fraDato;

  const nyesteDate = parseDanishDate(nyesteDato);
  if (!nyesteDate) return undefined;

  const tilDato = formatDanishDate(addDays(addMonths(nyesteDate, 12), -1));

  return { fraDato: aeldsteDato, tilDato };
};
type GetEffektiveSatserForDatoArgs = Readonly<{
  overenskomstId: OverenskomstId;
  dato: DanishDateString;
  applyAlmindeligLoenPaaShDageRegel: boolean;
}>;

export const getEffektiveSatserForDato = (
  args: GetEffektiveSatserForDatoArgs
): OverenskomstPeriodeSats | undefined => {
  // Domænebeslutning: Manglende sats for en given dato er forventet i nogle
  // overenskomster og behandles derfor ikke som fejl her.
  // Kaldende kode skal håndtere undefined eksplicit.
  if (getOffentligOverenskomstTypeById(args.overenskomstId as string)) {
    throw new Error('Offentlig overenskomst har ikke standard-satser. Brug offentligt lønopslag.');
  }
  const overenskomst = getOverenskomst(args.overenskomstId);
  if (!overenskomst) return undefined;

  const satser = getSatserForAlmindeligLoenPaaShDage(overenskomst, args.applyAlmindeligLoenPaaShDageRegel);
  return getSatserForDatoFromList(satser, args.dato);
};

type GetEffektiveSatserForPeriodeArgs = Readonly<{
  overenskomstId: OverenskomstId;
  fraDato: DanishDateString;
  tilDato: DanishDateString;
  applyAlmindeligLoenPaaShDageRegel: boolean;
}>;

export const getEffektiveSatserForPeriode = (
  args: GetEffektiveSatserForPeriodeArgs
): ReadonlyArray<OverenskomstPeriodeSats> => {
  // Domænebeslutning: En periode kan lovligt give tomt resultat, hvis der ikke
  // findes satser i hele intervallet for den valgte overenskomst.
  if (getOffentligOverenskomstTypeById(args.overenskomstId as string)) {
    throw new Error('Offentlig overenskomst har ikke standard-satser. Brug offentligt lønopslag.');
  }
  const overenskomst = getOverenskomst(args.overenskomstId);
  if (!overenskomst) return [];

  const satser = getSatserForAlmindeligLoenPaaShDage(overenskomst, args.applyAlmindeligLoenPaaShDageRegel);
  return getSatserForPeriodeFromList(satser, args.fraDato, args.tilDato);
};

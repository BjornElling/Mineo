/**
 * Statistiske lønudviklingsdata fra Danmarks Statistik
 *
 * Denne fil indeholder lønindeks-data fra officielle statistiske kilder.
 * Bruges til fremskrivning af løn baseret på generel lønudvikling i stedet
 * for overenskomstmæssige satser.
 *
 * Struktur:
 * - Hver statistisk model har metadata (id, navn, hjælpetekst) og historiske indeksværdier
 * - Indeksværdier er organiseret kronologisk med kvartal som nøgle (fx '2025K1')
 * - Alle værdier er indekstal relativt til basisperioden
 */

import { toDanishDateString, type DanishDateString } from '../types/branded';
import { addDays, addMonths, formatDanishDate, parseDanishDate } from '../utils/dateUtils';
import { aarsloenAslMax, getYearBoundsForYearlyRate } from './lovbestemteRates';

// ===== TYPE DEFINITIONER =====

/**
 * Branded type for statistisk lønudviklings-ID
 */
export type StatistiskLoenudviklingId = string & { readonly __brand: 'StatistiskLoenudviklingId' };

/**
 * Helper-funktion til at oprette valideret StatistiskLoenudviklingId
 */
const toStatistiskLoenudviklingId = (id: string): StatistiskLoenudviklingId => {
  if (!id || id.trim().length === 0) {
    throw new Error(`Ugyldig statistisk lønudviklings-ID: "${id}"`);
  }
  return id.trim().toUpperCase() as StatistiskLoenudviklingId;
};

/**
 * Kvartal-format: ÅÅÅÅKn (fx '2025K1' for 1. kvartal 2025)
 */
export type Kvartal = string & { readonly __brand: 'Kvartal' };

/**
 * Helper-funktion til at oprette valideret Kvartal
 */
const toKvartal = (kvartal: string): Kvartal => {
  const pattern = /^\d{4}K[1-4]$/;
  if (!pattern.test(kvartal)) {
    throw new Error(`Ugyldigt kvartal-format: "${kvartal}" (forventet format: ÅÅÅÅKn, fx 2025K1)`);
  }
  return kvartal as Kvartal;
};

/**
 * En enkelt indeksværdi for et kvartal
 */
export interface StatistiskIndeksVaerdi {
  readonly kvartal: Kvartal;
  readonly indeksvaerdi: number;
}

/**
 * Metadata for en statistisk lønudviklingsmodel
 */
export interface StatistiskLoenudviklingMeta {
  readonly id: StatistiskLoenudviklingId;
  readonly navn: string;
  readonly hjaelpetekst: string;
}

/**
 * Komplet statistisk lønudviklingsmodel med metadata og indeksværdier
 */
export interface StatistiskLoenudvikling {
  readonly meta: StatistiskLoenudviklingMeta;
  readonly indeksvaerdier: ReadonlyArray<StatistiskIndeksVaerdi>; // Nyeste først
}

export type ReguleringsDatoInterval = Readonly<{
  fraDato: DanishDateString;
  tilDato: DanishDateString;
}>;

export const ASL_AARSLOENSMAKSIMUM_MODEL_LABEL = 'ASL-årslønsmaksimum';

// ===== HELPER FUNKTIONER =====

/**
 * Kort helper til at oprette Kvartal
 */
const k = (kvartal: string): Kvartal => toKvartal(kvartal);

/**
 * Konverterer Kvartal (ÅÅÅÅKn) til et sammenligneligt tal.
 * Fx '2025K1' → 20251, '2024K4' → 20244
 */
const kvartalToNumber = (kvartal: Kvartal): number => {
  const year = parseInt(kvartal.substring(0, 4), 10);
  const q = parseInt(kvartal.substring(5, 6), 10);
  return year * 10 + q;
};

const kvartalToStartDato = (kvartal: Kvartal): DanishDateString => {
  const year = parseInt(kvartal.substring(0, 4), 10);
  const q = parseInt(kvartal.substring(5, 6), 10);
  const month = (q - 1) * 3 + 1;
  const day = 1;
  const dayStr = String(day).padStart(2, '0');
  const monthStr = String(month).padStart(2, '0');
  return toDanishDateString(`${dayStr}-${monthStr}-${year}`);
};

/**
 * Type for table rows i indeksFromTable
 */
type IndeksTableRow = readonly [kvartal: string, indeksvaerdi: number];

/**
 * Helper-funktion til at konvertere tabel-format til fulde indeks-objekter
 */
const indeksFromTable = (
  rows: ReadonlyArray<IndeksTableRow>
): ReadonlyArray<StatistiskIndeksVaerdi> =>
  rows.map(([kvartalStr, indeksvaerdi]) => ({
    kvartal: k(kvartalStr),
    indeksvaerdi,
  }));

// ===== STATISTISK LØNUDVIKLING DATA =====

/**
 * Alle statistiske lønudviklingsmodeller med deres indeksværdier
 */
export const statistiskLoenudvikling: ReadonlyArray<StatistiskLoenudvikling> = [
  // ILON12 - Implicit lønindeks.
  // OBS: ILON12 er ophørt efter 2025K4 (sidste offentliggjorte kvartal). Indekset
  // opdateres derfor ikke yderligere — der kommer ingen nye kvartaler efter 2025K4.
  {
    meta: {
      id:           toStatistiskLoenudviklingId('ILON12'),
      navn:         'ILON12',
      hjaelpetekst: 'Danmarks Statistik, Implicit lønindeks K1 (1. kvartal 2005 = 100), ikke-sæsonkorrigering',
    },
    indeksvaerdier: indeksFromTable([
      // kvartal    │ indeksværdi
      ['2025K4',        165.2 ],
      ['2025K1',        161.5 ],
      ['2024K1',        156.1 ],
      ['2023K1',        150.8 ],
      ['2022K1',        146.1 ],
      ['2021K1',        142.9 ],
      ['2020K1',        140.1 ],
      ['2019K1',        137.2 ],
      ['2018K1',        134.5 ],
      ['2017K1',        131.9 ],
      ['2016K1',        129.9 ],
      ['2015K1',        127.6 ],
      ['2014K1',        125.9 ],
      ['2013K1',        124.5 ],
      ['2012K1',        122.9 ],
      ['2011K1',        120.7 ],
      ['2010K1',        118.5 ],
      ['2009K1',        115.5 ],
      ['2008K1',        110.9 ],
      ['2007K1',        106.2 ],
      ['2006K1',        102.9 ],
      ['2005K1',        100.0 ],
    ]),
  },

  // SBLON2 - Standardberegnet lønindeks
  {
    meta: {
      id:           toStatistiskLoenudviklingId('SBLON2'),
      navn:         'SBLON2',
      hjaelpetekst: 'Danmarks Statistik, Standardberegnet lønindeks K1 (1. kvartal 2016 = 100)',
    },
    indeksvaerdier: indeksFromTable([
      // kvartal    │ indeksværdi
      ['2026K1',        129.3 ],
      ['2025K1',        125.4 ],
      ['2024K1',        119.6 ],
      ['2023K1',        115.7 ],
      ['2022K1',        111.9 ],
      ['2021K1',        109.4 ],
      ['2020K1',        107.4 ],
      ['2019K1',        105.0 ],
      ['2018K1',        102.8 ],
      ['2017K1',        100.8 ],
      ['2016K1',         98.9 ],
    ]),
  },
];

const statistiskLoenudviklingById = new Map<StatistiskLoenudviklingId, StatistiskLoenudvikling>();
for (const model of statistiskLoenudvikling) {
  if (statistiskLoenudviklingById.has(model.meta.id)) {
    throw new Error(`Duplicate statistisk lønudviklings-ID: "${model.meta.id}"`);
  }
  statistiskLoenudviklingById.set(model.meta.id, model);
}

// ===== OPSLAGS-FUNKTIONER =====

/**
 * Find statistisk lønudviklingsmodel ud fra ID
 */
export const getStatistiskLoenudvikling = (
  id: StatistiskLoenudviklingId
): StatistiskLoenudvikling | undefined => {
  return statistiskLoenudviklingById.get(id);
};

const resolveStatistiskModelIdFromLabel = (label: string): StatistiskLoenudviklingId | undefined => {
  const trimmed = label.trim();
  if (trimmed === '') return undefined;

  if (trimmed.startsWith('ILON12')) return toStatistiskLoenudviklingId('ILON12');
  if (trimmed.startsWith('SBLON2')) return toStatistiskLoenudviklingId('SBLON2');

  return undefined;
};

export const getReguleringsDatoIntervalForStatistikModel = (rawModel: string): ReguleringsDatoInterval | undefined => {
  const trimmed = rawModel.trim();
  if (trimmed === '') return undefined;

  if (trimmed === ASL_AARSLOENSMAKSIMUM_MODEL_LABEL) {
    const bounds = getYearBoundsForYearlyRate(aarsloenAslMax);
    if (!bounds) return undefined;
    return {
      fraDato: toDanishDateString(`01-01-${bounds.minYear}`),
      tilDato: toDanishDateString(`31-12-${bounds.maxYear}`),
    };
  }

  const modelId = resolveStatistiskModelIdFromLabel(trimmed);
  if (!modelId) return undefined;

  const model = statistiskLoenudviklingById.get(modelId);
  if (!model || model.indeksvaerdier.length === 0) return undefined;

  let minKvartal = model.indeksvaerdier[0].kvartal;
  let maxKvartal = model.indeksvaerdier[0].kvartal;
  let minNum = kvartalToNumber(minKvartal);
  let maxNum = minNum;

  for (const vaerdi of model.indeksvaerdier) {
    const num = kvartalToNumber(vaerdi.kvartal);
    if (num < minNum) {
      minNum = num;
      minKvartal = vaerdi.kvartal;
    }
    if (num > maxNum) {
      maxNum = num;
      maxKvartal = vaerdi.kvartal;
    }
  }

  const fraDato = kvartalToStartDato(minKvartal);
  const maxStartDato = kvartalToStartDato(maxKvartal);
  const maxStartDate = parseDanishDate(maxStartDato);
  if (!maxStartDate) return undefined;

  const tilDato = formatDanishDate(addDays(addMonths(maxStartDate, 12), -1));
  return { fraDato, tilDato };
};

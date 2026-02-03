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
import { aarsloenMax, getYearBoundsForYearlyRate } from './regulationRates';

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
  readonly indeks: number;
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
type IndeksTableRow = readonly [kvartal: string, indeks: number];

/**
 * Helper-funktion til at konvertere tabel-format til fulde indeks-objekter
 */
const indeksFromTable = (
  rows: ReadonlyArray<IndeksTableRow>
): ReadonlyArray<StatistiskIndeksVaerdi> =>
  rows.map(([kvartalStr, indeks]) => ({
    kvartal: k(kvartalStr),
    indeks,
  }));

// ===== STATISTISK LØNUDVIKLING DATA =====

/**
 * Alle statistiske lønudviklingsmodeller med deres indeksværdier
 */
export const statistiskLoenudvikling: ReadonlyArray<StatistiskLoenudvikling> = [
  // ILON12 - Implicit lønindeks
  {
    meta: {
      id:           toStatistiskLoenudviklingId('ILON12'),
      navn:         'ILON12',
      hjaelpetekst: 'Danmarks Statistik, Implicit lønindeks K1 (1.kvartal 2005 =100), ikke-sæsonkorrigering',
    },
    indeksvaerdier: indeksFromTable([
      // kvartal    │ indeks
      ['2025K3',        164.7 ],
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
      hjaelpetekst: 'Danmarks Statistik, Standardberegnet lønindeks K1 (2016=100)',
    },
    indeksvaerdier: indeksFromTable([
      // kvartal    │ indeks
      ['2025K3',        127.9 ],
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
 * Find statistisk lønudviklingsmodel by ID
 */
export const getStatistiskLoenudvikling = (
  id: StatistiskLoenudviklingId
): StatistiskLoenudvikling | undefined => {
  return statistiskLoenudviklingById.get(id);
};

/**
 * Find alle statistiske lønudviklingsmodeller (til dropdown)
 */
export const getAlleStatistiskLoenudvikling = (): ReadonlyArray<StatistiskLoenudviklingMeta> => {
  return statistiskLoenudvikling.map(model => model.meta);
};

/**
 * Find statistisk lønudviklingsmodel-metadata ud fra et (evt. uvalideret) ID
 */
export const getStatistiskLoenudviklingMetaById = (
  id: string
): StatistiskLoenudviklingMeta | undefined => {
  const normalized = id.trim().toUpperCase();
  if (normalized.length === 0) return undefined;
  return statistiskLoenudviklingById.get(normalized as StatistiskLoenudviklingId)?.meta;
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

  if (trimmed === 'ASL-årslønsmaksimum') {
    const bounds = getYearBoundsForYearlyRate(aarsloenMax);
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

/**
 * Find indeksværdi for et givet kvartal
 *
 * Returnerer indeksværdien for det præcise kvartal
 */
export const getIndeksForKvartal = (
  modelId: StatistiskLoenudviklingId,
  kvartal: Kvartal
): number | undefined => {
  const model = getStatistiskLoenudvikling(modelId);
  if (!model) return undefined;

  const vaerdi = model.indeksvaerdier.find(v => v.kvartal === kvartal);
  return vaerdi?.indeks;
};

/**
 * Find nærmeste indeksværdi for et givet kvartal
 *
 * Hvis det præcise kvartal ikke findes, returneres den nærmeste tidligere værdi
 */
export const getNaermesteIndeksForKvartal = (
  modelId: StatistiskLoenudviklingId,
  kvartal: Kvartal
): StatistiskIndeksVaerdi | undefined => {
  const model = getStatistiskLoenudvikling(modelId);
  if (!model) return undefined;

  const targetNum = kvartalToNumber(kvartal);

  // Find nyeste indeks hvor kvartal <= target
  for (const vaerdi of model.indeksvaerdier) {
    if (kvartalToNumber(vaerdi.kvartal) <= targetNum) {
      return vaerdi;
    }
  }

  return undefined;
};

/**
 * Find indeksværdier for en given periode
 *
 * Returnerer alle indeksværdier inden for den givne periode (inklusiv)
 */
export const getIndeksForPeriode = (
  modelId: StatistiskLoenudviklingId,
  fraKvartal: Kvartal,
  tilKvartal: Kvartal
): ReadonlyArray<StatistiskIndeksVaerdi> => {
  const model = getStatistiskLoenudvikling(modelId);
  if (!model) return [];

  const startNum = kvartalToNumber(fraKvartal);
  const endNum = kvartalToNumber(tilKvartal);
  if (startNum > endNum) return [];

  return model.indeksvaerdier.filter(vaerdi => {
    const num = kvartalToNumber(vaerdi.kvartal);
    return num >= startNum && num <= endNum;
  });
};

/**
 * Beregn lønudviklingsfaktor mellem to kvartaler
 *
 * Returnerer forholdet mellem indeksværdierne (tilKvartal / fraKvartal)
 * Fx hvis indeks stiger fra 100 til 110, returneres 1.10
 */
export const beregnLoenudviklingsFaktor = (
  modelId: StatistiskLoenudviklingId,
  fraKvartal: Kvartal,
  tilKvartal: Kvartal
): number | undefined => {
  const fraIndeks = getIndeksForKvartal(modelId, fraKvartal);
  const tilIndeks = getIndeksForKvartal(modelId, tilKvartal);

  if (fraIndeks === undefined || tilIndeks === undefined) return undefined;
  if (fraIndeks === 0) return undefined;

  return tilIndeks / fraIndeks;
};

/**
 * Fremskriv beløb baseret på lønudvikling mellem to kvartaler
 *
 * Returnerer beløbet justeret med lønudviklingsfaktoren
 */
export const fremskrivBeloeb = (
  modelId: StatistiskLoenudviklingId,
  beloeb: number,
  fraKvartal: Kvartal,
  tilKvartal: Kvartal
): number | undefined => {
  const faktor = beregnLoenudviklingsFaktor(modelId, fraKvartal, tilKvartal);
  if (faktor === undefined) return undefined;

  return beloeb * faktor;
};

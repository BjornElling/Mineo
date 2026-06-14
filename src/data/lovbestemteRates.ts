import { eetKapitaliseringsDatoMaxFraBekendtgoerelser } from './kapitalisering/kapitaliseringsbekendtgoerelser';
import {
  type RetsinfoLink,
  type YearlyRetsinfoReferences,
  bkg,
  toYearlyReferenceText,
  toYearlyRetsinfoLinks,
  vejl,
} from './retsinfoLinks';

/**
 * Satser på arbejdsskadeområdet 2005 og frem
 *
 * Denne fil indeholder alle lovbestemte satser for erstatningsberegninger
 * efter Erstatningsansvarsloven (EAL) og Arbejdsskadesikringsloven (ASL).
 *
 * Struktur:
 * - Hver sats er et objekt med årstal som nøgler
 * - getSatserForYear() returnerer alle satser for et specifikt år
 */

/**
 * Type for sats-objekt med år som nøgle og beløb som værdi
 */
export type YearlyRate = Record<number, number>;

/**
 * Type for reference-objekt med år som nøgle og reference-tekst som værdi
 */
export type YearlyReference = Record<number, string>;

export type YearBounds = Readonly<{ minYear: number; maxYear: number }>;

export const getYearBoundsForYearlyRate = (dict: YearlyRate): YearBounds | null => {
  const years = Object.keys(dict)
    .map((year) => Number(year))
    .filter((year) => Number.isInteger(year));

  if (years.length === 0) return null;

  return {
    minYear: Math.min(...years),
    maxYear: Math.max(...years),
  };
};

type YearlyDict = Record<number, unknown>;

export const getYearBoundsForCompleteCoverage = (
  dicts: ReadonlyArray<YearlyDict>
): YearBounds | null => {
  if (dicts.length === 0) return null;

  const toYearSet = (dict: YearlyDict): ReadonlySet<number> => {
    const years = Object.keys(dict)
      .map((year) => Number(year))
      .filter((year) => Number.isInteger(year));
    return new Set(years);
  };

  let intersection = toYearSet(dicts[0]);
  for (let i = 1; i < dicts.length; i++) {
    const next = toYearSet(dicts[i]);
    intersection = new Set(Array.from(intersection).filter((year) => next.has(year)));
    if (intersection.size === 0) return null;
  }

  const years = Array.from(intersection);
  // Værn mod et enkelt tomt dict (ingen heltalsår): loop-betingelsen ovenfor kører
  // ikke for dicts.length === 1, så uden dette ville Math.min/max(...[]) returnere
  // {Infinity, -Infinity} i stedet for at fejle fail-closed.
  if (years.length === 0) return null;
  return { minYear: Math.min(...years), maxYear: Math.max(...years) };
};

export const getYearBoundsForAnyCoverage = (dicts: ReadonlyArray<YearlyDict>): YearBounds | null => {
  const years = dicts
    .flatMap((dict) => Object.keys(dict))
    .map((year) => Number(year))
    .filter((year) => Number.isInteger(year));

  if (years.length === 0) return null;
  return { minYear: Math.min(...years), maxYear: Math.max(...years) };
};
// ===== ERSTATNINGSANSVARSLOVEN =====

// Godtgørelse for svie og smerte (§ 3, 1. pkt.)
export const svieSmertePrDag: YearlyRate = {
  2026: 250,
  2025: 240,
  2024: 230,
  2023: 220,
  2022: 215,
  2021: 215,
  2020: 210,
  2019: 205,
  2018: 200,
  2017: 195,
  2016: 190,
  2015: 190,
  2014: 185,
  2013: 180,
  2012: 180,
  2011: 175,
  2010: 170,
  2009: 165,
  2008: 160,
  2007: 155,
  2006: 150,
  2005: 145,
};

// Maksimum for svie og smerte (§ 3, 3. pkt.)
export const svieSmerteMax: YearlyRate = {
  2026: 96000,
  2025: 92000,
  2024: 88500,
  2023: 85500,
  2022: 83000,
  2021: 82000,
  2020: 80000,
  2019: 78500,
  2018: 76500,
  2017: 75000,
  2016: 73500,
  2015: 72500,
  2014: 71500,
  2013: 70000,
  2012: 69000,
  2011: 67000,
  2010: 65500,
  2009: 63000,
  2008: 61000,
  2007: 59000,
  2006: 57500,
  2005: 56000,
};

export const svieSmerteMaxYearBounds: YearBounds = (() => {
  const bounds = getYearBoundsForYearlyRate(svieSmerteMax);
  if (!bounds) {
    throw new Error('CRITICAL: No yearly rates defined for svieSmerteMax');
  }
  return bounds;
})();

// Maksimum for erhvervsevnetab (§ 13, stk. 1, 2. pkt.)
export const erhvervsevnetabEalMax: YearlyRate = {
  2026: 11582500,
  2025: 11052000,
  2024: 10637000,
  2023: 10277500,
  2022: 9978000,
  2021: 9859500,
  2020: 9638000,
  2019: 9430500,
  2018: 9227500,
  2017: 9029000,
  2016: 8834500,
  2015: 8712500,
  2014: 8584000,
  2013: 8432000,
  2012: 8299000,
  2011: 8042000,
  2010: 7892000,
  2009: 7588500,
  2008: 7339000,
  2007: 7111500,
  2006: 6924500,
  2005: 6678500,
};

// Mindstebeløb for forsørgertab (§ 13, 2. pkt.)
export const foersoergertabEalMin: YearlyRate = {
  2026: 1239000,
  2025: 1182500,
  2024: 1138000,
  2023: 1099500,
  2022: 1067500,
  2021: 1055000,
  2020: 1031000,
  2019: 1009000,
  2018: 987000,
  2017: 966000,
  2016: 945000,
  2015: 932000,
  2014: 918500,
  2013: 902000,
  2012: 888000,
  2011: 860500,
  2010: 844500,
  2009: 812000,
  2008: 785000,
  2007: 760500,
  2006: 740500,
  2005: 724000,
};

// Vejledende udtalelse om erhvervsevnetab (§ 10)
// NB: Værdierne er IKKE en glat årlig fremskrivning. Der er bevidste spring i kilden —
// bl.a. 2016 (8.600) → 2017 (23.040) og 2020 (24.690) → 2021 (20.120). Tallene er
// verificeret korrekte; ret dem ikke til at "se mere ensartede ud".
export const vejledendeUdtalelseEet: YearlyRate = {
  2026: 26378,
  2025: 25122,
  2024: 24390,
  2023: 23360,
  2022: 22870,
  2021: 20120,
  2020: 24690,
  2019: 24510,
  2018: 22280,
  2017: 23040,
  2016: 8600,
  2015: 9100,
  2014: 9000,
  2013: 8900,
  2012: 9500,
  2011: 8500,
  2010: 8500,
  2009: 7100,
  2008: 7000,
  2007: 6900,
  2006: 6900,
  2005: 5000,
};

// ===== ARBEJDSSKADESIKRINGSLOVEN =====

// Maks. årsløn pr. 1/1-2003 (§ 24). 2003 indgår ikke i aarsloenAslMax-tabellen
// (den starter 2005), så denne sats er en selvstændig konstant.
export const ASL_MAX_AARSLOEN_2003 = 367000;
// ASL_MAX_AARSLOEN_2024 udledes af aarsloenAslMax[2024] længere nede i filen for at
// undgå dobbelt sandhedskilde for samme sats (§ 24-maksimum for 2024).

// Godtgørelse for varige mén (§ 18, stk. 3, 3. pkt.)
export const varigeMenPrGrad: YearlyRate = {
  2026: 11035,
  2025: 10530,
  2024: 10135,
  2023: 9790,
  2022: 9505,
  2021: 9395,
  2020: 9180,
  2019: 8985,
  2018: 8790,
  2017: 8600,
  2016: 8415,
  2015: 8300,
  2014: 8175,
  2013: 8035,
  2012: 7905,
  2011: 7660,
  2010: 7520,
  2009: 7230,
  2008: 6990,
  2007: 6775,
  2006: 6595,
  2005: 6450,
};

export const varigeMenPrGradYearBounds: YearBounds = (() => {
  const bounds = getYearBoundsForYearlyRate(varigeMenPrGrad);
  if (!bounds) {
    throw new Error('CRITICAL: No yearly rates defined for varigeMenPrGrad');
  }
  return bounds;
})();

export const getSatserCompleteYearBounds = (): YearBounds => {
  const bounds = getYearBoundsForCompleteCoverage([
    svieSmertePrDag,
    svieSmerteMax,
    erhvervsevnetabEalMax,
    foersoergertabEalMin,
    vejledendeUdtalelseEet,
    varigeMenPrGrad,
    aarsloenAslMax,
    // NB: aarsloenMin har bevidst ikke 2024 (split i foer/fra 01-07-2024),
    // så complete-bounds afspejler med vilje dette hul i basis-tabellen.
    aarsloenAslMin,
    overgangsbeloeb,
    reguleringsprocentErhvervsevnetabFra2024,
    friProcesEnlig,
    friProcesSamlevende,
    friProcesBarn,
    reguleringssats,
    ealReference,
    aslReference,
    kapitalisering,
    friProcesReference,
    reguleringssatsReference,
  ]);

  if (!bounds) {
    throw new Error('CRITICAL: No shared year coverage across Satser datasets');
  }
  return bounds;
};

// Maksimum årsløn (§ 24, stk. 10)
export const aarsloenAslMax: YearlyRate = {
  2026: 662000,
  2025: 632000,
  2024: 608000,
  2023: 588000,
  2022: 570000,
  2021: 564000,
  2020: 551000,
  2019: 539000,
  2018: 527000,
  2017: 516000,
  2016: 505000,
  2015: 498000,
  2014: 491000,
  2013: 482000,
  2012: 474000,
  2011: 459000,
  2010: 451000,
  2009: 434000,
  2008: 419000,
  2007: 407000,
  2006: 396000,
  2005: 387000,
};

// Maks. årsløn pr. 1/1-2024 (§ 24). Udledt af aarsloenAslMax[2024] for at holde én
// sandhedskilde; fail-closed hvis 2024 nogensinde fjernes fra tabellen.
export const ASL_MAX_AARSLOEN_2024: number = (() => {
  const value = aarsloenAslMax[2024];
  if (value === undefined) {
    throw new Error('CRITICAL: aarsloenAslMax mangler 2024 (kræves af ASL_MAX_AARSLOEN_2024)');
  }
  return value;
})();

// Minimum årsløn (§ 24, stk. 10)
// OBS: 2024 bevidst udeladt!
export const aarsloenAslMin: YearlyRate = {
  2026: 280000,
  2025: 267000,
  2023: 219000,
  2022: 213000,
  2021: 210000,
  2020: 206000,
  2019: 201000,
  2018: 197000,
  2017: 193000,
  2016: 189000,
  2015: 186000,
  2014: 183000,
  2013: 180000,
  2012: 177000,
  2011: 172000,
  2010: 168000,
  2009: 162000,
  2008: 157000,
  2007: 152000,
  2006: 148000,
  2005: 145000,
};

// Minimum årsløn (skader før 1.7.2024)
// OBS: Skal ikke opdateres!
export const aarsloenAslMinFoer20240701: YearlyRate = {
  2024: 227000,
};

// Minimum årsløn (skader fra 1.7.2024)
// OBS: Skal ikke opdateres!
export const aarsloenAslMinFra20240701: YearlyRate = {
  2024: 257000,
};

// Overgangsbeløb (§ 19, stk. 1)
export const overgangsbeloeb: YearlyRate = {
  2026: 208000,
  2025: 198500,
  2024: 191000,
  2023: 184500,
  2022: 179000,
  2021: 177000,
  2020: 173000,
  2019: 169000,
  2018: 165500,
  2017: 162000,
  2016: 158500,
  2015: 156500,
  2014: 154000,
  2013: 151500,
  2012: 149000,
  2011: 144500,
  2010: 141500,
  2009: 136000,
  2008: 131500,
  2007: 127500,
  2006: 124000,
  2005: 121500,
};

// Reguleringsprocent for erhvervsevnetab
// OBS: Skal ikke opdateres efter år 2023!
export const reguleringsprocentErhvervsevnetab: YearlyRate = {
  2023: 60.1,
  2022: 55.4,
  2021: 53.6,
  2020: 50.1,
  2019: 46.9,
  2018: 43.7,
  2017: 40.6,
  2016: 37.6,
  2015: 35.7,
  2014: 33.7,
  2013: 31.3,
  2012: 29.2,
  2011: 25.2,
  2010: 22.9,
  2009: 18.2,
  2008: 14.3,
  2007: 10.8,
  2006: 7.9,
  2005: 5.5,
};

// Reguleringsprocent for erhvervsevnetab (før 2024)
// OBS: Skal ikke opdateres!
export const reguleringsprocentErhvervsevnetabFoer2024: YearlyRate = {
  2024: 65.7,
};

// Reguleringsprocent for erhvervsevnetab (fra 2024)
export const reguleringsprocentErhvervsevnetabFra2024: YearlyRate = {
  2026: 8.9,
  2025: 3.9,
  2024: 0.0,
};

// ===== DIVERSE =====

// Beløbsgrænse for fri proces - enlig
export const friProcesEnlig: YearlyRate = {
  2026: 404000,
  2025: 385000,
  2024: 371000,
  2023: 358000,
  2022: 348000,
  2021: 344000,
  2020: 336000,
  2019: 329000,
  2018: 322000,
  2017: 315000,
  2016: 308000,
  2015: 304000,
  2014: 299000,
  2013: 294000,
  2012: 289000,
  2011: 280000,
  2010: 275000,
  2009: 264000,
  2008: 256000,
  2007: 248000,
  2006: 242000,
  2005: 236000,
};

// Beløbsgrænse for fri proces - samlevende
export const friProcesSamlevende: YearlyRate = {
  2026: 513000,
  2025: 490000,
  2024: 471000,
  2023: 455000,
  2022: 442000,
  2021: 437000,
  2020: 427000,
  2019: 418000,
  2018: 409000,
  2017: 400000,
  2016: 391000,
  2015: 386000,
  2014: 380000,
  2013: 374000,
  2012: 368000,
  2011: 356000,
  2010: 350000,
  2009: 336000,
  2008: 325000,
  2007: 315000,
  2006: 307000,
  2005: 300000,
};

// Beløbsgrænse for fri proces - tillæg per barn under 18 år
export const friProcesBarn: YearlyRate = {
  2026: 70000,
  2025: 67000,
  2024: 64000,
  2023: 62000,
  2022: 60000,
  2021: 60000,
  2020: 58000,
  2019: 57000,
  2018: 56000,
  2017: 55000,
  2016: 53000,
  2015: 53000,
  2014: 52000,
  2013: 51000,
  2012: 50000,
  2011: 49000,
  2010: 48000,
  2009: 46000,
  2008: 44000,
  2007: 43000,
  2006: 42000,
  2005: 41000,
};

// Reguleringssats (EAL § 15, stk. 1 / ASL § 25, stk. 1-2)
export const reguleringssats: YearlyRate = {
  2026: 4.8,
  2025: 3.9,
  2024: 3.5,
  2023: 3.0,
  2022: 1.2,
  2021: 2.3,
  2020: 2.2,
  2019: 2.2,
  2018: 2.2,
  2017: 2.2,
  2016: 1.4,
  2015: 1.5,
  2014: 1.8,
  2013: 1.6,
  2012: 3.2,
  2011: 1.9,
  2010: 4.0,
  2009: 3.4,
  2008: 3.2,
  2007: 2.7,
  2006: 2.3,
  2005: 2.2,
};

// ===== REFERENCER =====

const ealReferenceData: YearlyRetsinfoReferences = {
  2026: [bkg(1428, 2025)],
  2025: [bkg(1347, 2024)],
  2024: [bkg(1390, 2023)],
  2023: [bkg(1488, 2022)],
  2022: [bkg(2173, 2021)],
  2021: [bkg(1839, 2020)],
  2020: [bkg(1130, 2019)],
  2019: [bkg(1379, 2018)],
  2018: [bkg(1233, 2017)],
  2017: [bkg(1416, 2016)],
  2016: [bkg(1393, 2015)],
  2015: [bkg(1185, 2014)],
  2014: [bkg(1167, 2013)],
  2013: [bkg(1059, 2012)],
  2012: [bkg(1119, 2011)],
  2011: [bkg(1298, 2010)],
  2010: [bkg(1127, 2009)],
  2009: [bkg(1110, 2008)],
  2008: [bkg(1420, 2007)],
  2007: [bkg(1090, 2006)],
  2006: [bkg(1076, 2005)],
  2005: [bkg(1158, 2004)],
};

// Erstatningsansvarsloven
export const ealReference: YearlyReference = toYearlyReferenceText(ealReferenceData);
export const ealReferenceLinks = toYearlyRetsinfoLinks(ealReferenceData);

const aslReferenceData: YearlyRetsinfoReferences = {
  2026: [vejl(10058, 2025)],
  2025: [vejl(9915, 2024)],
  2024: [vejl(9822, 2023)],
  2023: [vejl(10142, 2022)],
  2022: [vejl(9866, 2021)],
  2021: [vejl(9737, 2020)],
  2020: [vejl(9922, 2019)],
  2019: [bkg(1232, 2018)],
  2018: [bkg(1157, 2017)],
  2017: [bkg(1273, 2016)],
  2016: [bkg(1220, 2015)],
  2015: [bkg(1114, 2014)],
  2014: [bkg(1151, 2013)],
  2013: [bkg(991, 2012)],
  2012: [bkg(1105, 2011)],
  2011: [bkg(1215, 2010)],
  2010: [bkg(1017, 2009)],
  2009: [bkg(1050, 2008)],
  2008: [bkg(1241, 2007)],
  2007: [bkg(1047, 2006)],
  2006: [bkg(989, 2005)],
  2005: [bkg(1033, 2004)],
};

// Arbejdsskadesikringsloven
export const aslReference: YearlyReference = toYearlyReferenceText(aslReferenceData);
export const aslReferenceLinks = toYearlyRetsinfoLinks(aslReferenceData);

const kapitaliseringData: YearlyRetsinfoReferences = {
  2026: [vejl(10056, 2025)],
  2025: [vejl(10029, 2024)],
  2006: [bkg(1068, 2003)],
  2005: [bkg(1068, 2003)],
};

// Kapitalisering
// OBS: Skal ikke udfyldes med årene 2007-2024.
// Bekendtgørelse 1068/2003 blev brugt uændret i en lang periode; detaljerede
// skadeafhængige varianter ligger i kapitaliseringSkade* tabellerne nedenfor.
export const kapitalisering: YearlyReference = toYearlyReferenceText(kapitaliseringData);
export const kapitaliseringLinks = toYearlyRetsinfoLinks(kapitaliseringData);

const kapitaliseringSkadeFra2011Data: YearlyRetsinfoReferences = {
  2024: [vejl(9820, 2023), vejl(9376, 2024, 'Vejl. 9376/2024')],
  2023: [vejl(10141, 2022)],
  2022: [vejl(9864, 2021)],
  2021: [vejl(9741, 2020)],
  2020: [vejl(9921, 2019)],
  2019: [bkg(1233, 2018)],
  2018: [bkg(1156, 2017)],
  2017: [bkg(1275, 2016)],
  2016: [bkg(1664, 2015)],
  2015: [bkg(1275, 2014), bkg(199, 2015, 'Bkg. 199/2015')],
  2014: [bkg(1202, 2013)],
  2013: [bkg(990, 2012)],
  2012: [bkg(1358, 2011)],
  2011: [bkg(1220, 2010)],
};

// Kapitalisering (skade fra 1.1.2011)
// OBS: Skal kun udfyldes med årene 2011-2024!
export const kapitaliseringSkadeFra2011: YearlyReference = toYearlyReferenceText(kapitaliseringSkadeFra2011Data);
export const kapitaliseringSkadeFra2011Links = toYearlyRetsinfoLinks(kapitaliseringSkadeFra2011Data);

const kapitaliseringSkadeFoer2011Data: YearlyRetsinfoReferences = {
  // Vejledning 9871/2020 anvendes fortsat uændret for opslagene 2021-2024.
  2024: [vejl(9871, 2020), vejl(9376, 2024, 'Vejl. 9376/2024')],
  2023: [vejl(9871, 2020)],
  2022: [vejl(9871, 2020)],
  2021: [vejl(9871, 2020)],
  2020: [bkg(1700, 2015)],
  2019: [bkg(1700, 2015)],
  2018: [bkg(1700, 2015)],
  2017: [bkg(1700, 2015)],
  2016: [bkg(1700, 2015)],
  2015: [bkg(1403, 2011), bkg(198, 2015, 'Bkg. 198/2015')],
  2014: [bkg(1403, 2011)],
  2013: [bkg(1403, 2011)],
  2012: [bkg(1403, 2011)],
  2011: [bkg(1221, 2010)],
};

// Kapitalisering (skade før 1.1.2011)
// OBS: Skal kun udfyldes med årene 2011-2024!
export const kapitaliseringSkadeFoer2011: YearlyReference = toYearlyReferenceText(kapitaliseringSkadeFoer2011Data);
export const kapitaliseringSkadeFoer2011Links = toYearlyRetsinfoLinks(kapitaliseringSkadeFoer2011Data);

const kapitaliseringSkadeFra2007Data: YearlyRetsinfoReferences = {
  2010: [bkg(1022, 2009)],
  2009: [bkg(1047, 2008), bkg(440, 2009, 'Bkg. 440/2009')],
  2008: [bkg(1263, 2007)],
  2007: [bkg(678, 2007)],
};

// Kapitalisering (skade fra 1.7.2007)
// OBS: Skal kun udfyldes med årene 2007-2010!
export const kapitaliseringSkadeFra2007: YearlyReference = toYearlyReferenceText(kapitaliseringSkadeFra2007Data);
export const kapitaliseringSkadeFra2007Links = toYearlyRetsinfoLinks(kapitaliseringSkadeFra2007Data);

const kapitaliseringSkadeFoer2007Data: YearlyRetsinfoReferences = {
  2010: [bkg(449, 2009)],
  2009: [bkg(1068, 2003), bkg(449, 2009, 'Bkg. 449/2009')],
  2008: [bkg(1068, 2003)],
  2007: [bkg(1068, 2003)],
};

// Kapitalisering (skade før 1.7.2007)
// OBS: Skal kun udfyldes med årene 2007-2010!
export const kapitaliseringSkadeFoer2007: YearlyReference = toYearlyReferenceText(kapitaliseringSkadeFoer2007Data);
export const kapitaliseringSkadeFoer2007Links = toYearlyRetsinfoLinks(kapitaliseringSkadeFoer2007Data);

const friProcesReferenceData: YearlyRetsinfoReferences = {
  2026: [bkg(1360, 2025)],
  2025: [bkg(1338, 2024)],
  2024: [bkg(1521, 2023)],
  2023: [bkg(1479, 2022)],
  2022: [bkg(2124, 2021)],
  2021: [bkg(1840, 2020)],
  2020: [bkg(1504, 2019)],
  2019: [bkg(1372, 2018)],
  2018: [bkg(1462, 2017)],
  2017: [bkg(1671, 2016)],
  2016: [bkg(1435, 2015)],
  2015: [bkg(1270, 2014)],
  2014: [bkg(1245, 2013)],
  2013: [bkg(1084, 2012)],
  2012: [bkg(1153, 2011)],
  2011: [bkg(1428, 2010)],
  2010: [bkg(1236, 2009)],
  2009: [bkg(1116, 2008)],
  2008: [bkg(1468, 2007)],
  2007: [bkg(1295, 2006)],
  2006: [bkg(1097, 2005)],
  2005: [bkg(1116, 2004)],
};

// Fri proces
export const friProcesReference: YearlyReference = toYearlyReferenceText(friProcesReferenceData);
export const friProcesReferenceLinks = toYearlyRetsinfoLinks(friProcesReferenceData);

const reguleringssatsReferenceData: YearlyRetsinfoReferences = {
  2026: [bkg(1056, 2025)],
  2025: [bkg(983, 2024)],
  2024: [bkg(1101, 2023)],
  2023: [bkg(1204, 2022)],
  2022: [bkg(1713, 2021)],
  2021: [bkg(1210, 2020)],
  2020: [bkg(855, 2019)],
  2019: [bkg(1058, 2018)],
  2018: [bkg(1015, 2017)],
  2017: [bkg(1135, 2016)],
  2016: [bkg(988, 2015)],
  2015: [bkg(942, 2014)],
  2014: [bkg(1046, 2013)],
  2013: [bkg(870, 2012)],
  2012: [bkg(937, 2011)],
  2011: [bkg(1013, 2010)],
  2010: [bkg(809, 2009)],
  2009: [bkg(851, 2008)],
  2008: [bkg(1021, 2007)],
  2007: [bkg(874, 2006)],
  2006: [bkg(793, 2005)],
  2005: [bkg(877, 2004)],
};

// Reguleringssatser
export const reguleringssatsReference: YearlyReference = toYearlyReferenceText(reguleringssatsReferenceData);
export const reguleringssatsReferenceLinks = toYearlyRetsinfoLinks(reguleringssatsReferenceData);

export const satserCompleteYearBounds: YearBounds = getSatserCompleteYearBounds();

// Seneste år med komplet datadækning for EET-beregninger:
// intersection af aarsloenAslMax, reguleringsprocentErhvervsevnetabFra2024,
// erhvervsevnetabEalMax og reguleringssats, capped af kapitaliserings-
// bekendtgørelsesoversigtens seneste fælles gyldighedsår.
// Bruges som øvre dato-grænse for EET-siden (EETMaxDato = 31-12 i dette år).
export const eetYearBounds: YearBounds = (() => {
  const bounds = getYearBoundsForCompleteCoverage([
    aarsloenAslMax,
    reguleringsprocentErhvervsevnetabFra2024,
    erhvervsevnetabEalMax,
    reguleringssats,
  ]);
  if (!bounds) {
    throw new Error('CRITICAL: No shared year coverage for EET year bounds');
  }

  const bekendtgoerelserMaxYear = Number.parseInt(
    eetKapitaliseringsDatoMaxFraBekendtgoerelser.slice(0, 4),
    10
  );
  if (!Number.isInteger(bekendtgoerelserMaxYear)) {
    throw new Error('CRITICAL: Invalid max year derived from kapitaliseringsbekendtgoerelser');
  }

  return {
    minYear: bounds.minYear,
    maxYear: Math.min(bounds.maxYear, bekendtgoerelserMaxYear),
  };
})();

// Seneste år med komplet datadækning for forsørgertabsberegninger:
// intersection af EET-satser (aarsloenAslMax, erhvervsevnetabEalMax, reguleringssats) og
// foersoergertabEalMin, capped af kapitaliseringsbekendtgørelsesoversigtens seneste år.
// Bruges som øvre dato-grænse for forsørgertab-siden.
export const foersoergertabYearBounds: YearBounds = (() => {
  const bounds = getYearBoundsForCompleteCoverage([
    aarsloenAslMax,
    erhvervsevnetabEalMax,
    reguleringssats,
    foersoergertabEalMin,
  ]);
  if (!bounds) {
    throw new Error('CRITICAL: No shared year coverage for forsørgertab year bounds');
  }

  const bekendtgoerelserMaxYear = Number.parseInt(
    eetKapitaliseringsDatoMaxFraBekendtgoerelser.slice(0, 4),
    10
  );
  if (!Number.isInteger(bekendtgoerelserMaxYear)) {
    throw new Error('CRITICAL: Invalid max year derived from kapitaliseringsbekendtgoerelser');
  }

  return {
    minYear: bounds.minYear,
    maxYear: Math.min(bounds.maxYear, bekendtgoerelserMaxYear),
  };
})();

/**
 * Årsgrænser for år-vælgeren på Satser-siden.
 *
 * Note: Vi kan ikke bruge `satserCompleteYearBounds` her, fordi flere datasæt (fx
 * `reguleringsprocentErhvervsevnetabFra2024` og reference-tabeller som `kapitalisering`)
 * med vilje kun er udfyldt for enkelte år. År-vælgeren skal i stedet afgrænses af de
 * satstabeller der er meningsfulde på tværs af hele perioden.
 *
 * Bevidst udeladt: kapitaliseringSkadeFra2011/kapitaliseringSkadeFoer2011 og
 * kapitaliseringSkadeFra2007/kapitaliseringSkadeFoer2007, da de er skadeafhængige
 * specialtabeller og ikke generelle år-vælger-drivere.
 */
export const satserAngivAarYearBounds: YearBounds = (() => {
  const bounds = getYearBoundsForAnyCoverage([
    svieSmertePrDag,
    svieSmerteMax,
    erhvervsevnetabEalMax,
    foersoergertabEalMin,
    vejledendeUdtalelseEet,
    varigeMenPrGrad,
    aarsloenAslMax,
    aarsloenAslMin,
    overgangsbeloeb,
    reguleringsprocentErhvervsevnetabFra2024,
    friProcesEnlig,
    friProcesSamlevende,
    friProcesBarn,
    reguleringssats,
    ealReference,
    aslReference,
    kapitalisering,
    friProcesReference,
    reguleringssatsReference,
  ]);

  if (!bounds) {
    throw new Error('CRITICAL: No shared year coverage for Satser year selector');
  }
  return bounds;
})();

// ===== HJÆLPEFUNKTIONER =====

/**
 * Returnerer alle satser for et bestemt år
 *
 * Robust over for manglende år i datatabellerne.
 * Hvis et opslag mangler for det ønskede år, returneres null (for tal) eller '' (for tekst).
 *
 * @param {number} year - Årstal at hente satser for
 * @returns {Object} Dictionary med alle satser struktureret efter kategori
 */
export const getSatserForYear = (year: number) => {
  const num = (dict: Record<number, number>): number | null => (dict[year] !== undefined ? dict[year] : null);
  const txt = (dict: Record<number, string>): string => dict[year] || '';
  const links = (dict: Record<number, readonly RetsinfoLink[]>): readonly RetsinfoLink[] => dict[year] || [];

  return {
    eal: {
      svieSmertePrDag: num(svieSmertePrDag),
      svieSmerteMax: num(svieSmerteMax),
      erhvervsevnetabEalMax: num(erhvervsevnetabEalMax),
      foersoergertabEalMin: num(foersoergertabEalMin),
      vejledendeUdtalelseEet: num(vejledendeUdtalelseEet),
    },
    asl: {
      varigeMenPrGrad: num(varigeMenPrGrad),
      aarsloenAslMax: num(aarsloenAslMax),
      aarsloenMin: num(aarsloenAslMin),
      aarsloenMinFoer2024: num(aarsloenAslMinFoer20240701),
      aarsloenMinFra2024: num(aarsloenAslMinFra20240701),
      overgangsbelob: num(overgangsbeloeb),
      reguleringProcentErhvervsevnetab: num(reguleringsprocentErhvervsevnetab),
      reguleringProcentErhvervsevnetabFoer2024: num(reguleringsprocentErhvervsevnetabFoer2024),
      reguleringProcentErhvervsevnetabFra2024: num(reguleringsprocentErhvervsevnetabFra2024),
    },
    diverse: {
      friProcesEnlig: num(friProcesEnlig),
      friProcesSamlevende: num(friProcesSamlevende),
      friProcesBarn: num(friProcesBarn),
      reguleringssats: num(reguleringssats),
    },
    referencer: {
      ealReference: txt(ealReference),
      ealReferenceLinks: links(ealReferenceLinks),
      aslReference: txt(aslReference),
      aslReferenceLinks: links(aslReferenceLinks),
      kapitalisering: txt(kapitalisering),
      kapitaliseringLinks: links(kapitaliseringLinks),
      kapitaliseringSkadeFra2011: txt(kapitaliseringSkadeFra2011),
      kapitaliseringSkadeFra2011Links: links(kapitaliseringSkadeFra2011Links),
      kapitaliseringSkadeFoer2011: txt(kapitaliseringSkadeFoer2011),
      kapitaliseringSkadeFoer2011Links: links(kapitaliseringSkadeFoer2011Links),
      kapitaliseringSkadeFra2007: txt(kapitaliseringSkadeFra2007),
      kapitaliseringSkadeFra2007Links: links(kapitaliseringSkadeFra2007Links),
      kapitaliseringSkadeFoer2007: txt(kapitaliseringSkadeFoer2007),
      kapitaliseringSkadeFoer2007Links: links(kapitaliseringSkadeFoer2007Links),
      friProcesReference: txt(friProcesReference),
      friProcesReferenceLinks: links(friProcesReferenceLinks),
      reguleringssatsReference: txt(reguleringssatsReference),
      reguleringssatsReferenceLinks: links(reguleringssatsReferenceLinks),
    },
  };
};

/**
 * Faktoren i grundydelsens formel. Den er aldrig afgørelsens fulde EET: en kapitalisering regner med den
 * kapitaliserede andel, en proformakapitalisering med det resterende EET. «EET» fik en læser, der
 * indsatte afgørelsens procent, til at få en dobbelt så stor grundydelse.
 */
export type KapitaliseringGrundydelseFaktor = 'kapitaliseringsprocent' | 'rest-eet';

const FAKTOR_NAVN: Readonly<Record<KapitaliseringGrundydelseFaktor, string>> = {
  kapitaliseringsprocent: 'Kap. %',
  'rest-eet': 'Rest-EET',
};

export const buildKapitaliseringGrundydelseLabel = (
  kapitaliseringsPctText: string,
  amBidragPct: number,
  faktor: KapitaliseringGrundydelseFaktor = 'kapitaliseringsprocent'
): string => {
  const navn = FAKTOR_NAVN[faktor];
  return amBidragPct === 0
    ? `Grundydelse (${kapitaliseringsPctText}): Grundløn x ${navn} x Erstatningsniveau`
    : `Grundydelse (${kapitaliseringsPctText}): Grundløn x ${navn} x Erstatningsniveau x (100 % − AM-bidrag)`;
};

export const buildKapitaliseringGrundydelseExpression = (
  grundloenText: string,
  kapitaliseringsPctText: string,
  erstatningsniveauPct: number,
  amBidragPct: number,
  grundydelseText?: string
): string => {
  const expression = amBidragPct === 0
    ? `${grundloenText} x ${kapitaliseringsPctText} x ${erstatningsniveauPct} %`
    : `${grundloenText} x ${kapitaliseringsPctText} x ${erstatningsniveauPct} % x ${100 - amBidragPct} %`;

  return grundydelseText === undefined ? `${expression} =` : `${expression} = ${grundydelseText}`;
};

export const buildKapitaliseringOpreguleringTil2024Expression = (
  grundydelseText: string,
  opreguleringsfaktorText: string,
  opreguleringPctText: string,
  opreguleretGrundydelseText?: string
): string => {
  const expression =
    `Grundydelse i 2003-niveau opreguleret til 2024-niveau (+ ${opreguleringPctText}): ` +
    `${grundydelseText} x ${opreguleringsfaktorText}`;
  return opreguleretGrundydelseText === undefined ? `${expression} =` : `${expression} = ${opreguleretGrundydelseText}`;
};

/**
 * Om linjen «Årlig ydelse (…) = …» skal vises. Uden reguleringsprocent (kapitalisering i
 * referenceåret 2024) gentager den blot beløbet fra linjen over og udelades (bevidst
 * valg). Med regulering ER linjen beregningen og vises altid; ligeså hvis beløbene mod
 * forventning afviger, så en forskel aldrig skjules.
 */
export const visKapitaliseringAarsydelseLinje = (args: Readonly<{
  aarsydelseReguleringsPctRounded4: number | null;
  aarsydelseGrundlagOre: number;
  aarsydelseOre: number;
}>): boolean =>
  args.aarsydelseReguleringsPctRounded4 !== null || args.aarsydelseGrundlagOre !== args.aarsydelseOre;

export const buildKapitaliseringAarsydelseExpression = (
  aarsydelseGrundlagText: string,
  reguleringsPctText: string | null,
  aarsydelseText?: string
): string => {
  const expression = reguleringsPctText === null
    ? `Årlig ydelse (${aarsydelseGrundlagText})`
    : `Årlig ydelse (${aarsydelseGrundlagText} x ${reguleringsPctText})`;
  return aarsydelseText === undefined ? `${expression} =` : `${expression} = ${aarsydelseText}`;
};

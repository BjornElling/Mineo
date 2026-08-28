export const buildKapitaliseringGrundydelseLabel = (
  kapitaliseringsPctText: string,
  amBidragPct: number
): string => {
  return amBidragPct === 0
    ? `Grundydelse (${kapitaliseringsPctText}): Grundløn x EET x Erstatningsniveau`
    : `Grundydelse (${kapitaliseringsPctText}): Grundløn x EET x Erstatningsniveau x (100 % − AM-bidrag)`;
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

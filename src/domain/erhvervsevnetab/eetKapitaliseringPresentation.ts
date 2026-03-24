export const buildKapitaliseringGrundydelseLabel = (
  kapitaliseringsPctText: string,
  amBidragPct: number
): string => {
  return amBidragPct === 0
    ? `Grundydelse (${kapitaliseringsPctText}): Grundløn × EET × Erstatningsniveau`
    : `Grundydelse (${kapitaliseringsPctText}): Grundløn × EET × Erstatningsniveau × (100 % − AM-bidrag)`;
};

export const buildKapitaliseringGrundydelseExpression = (
  grundloenText: string,
  kapitaliseringsPctText: string,
  erstatningsniveauPct: number,
  amBidragPct: number,
  grundydelseText?: string
): string => {
  const expression = amBidragPct === 0
    ? `${grundloenText} × ${kapitaliseringsPctText} × ${erstatningsniveauPct} %`
    : `${grundloenText} × ${kapitaliseringsPctText} × ${erstatningsniveauPct} % × ${100 - amBidragPct} %`;

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
    `${grundydelseText} × ${opreguleringsfaktorText}`;
  return opreguleretGrundydelseText === undefined ? `${expression} =` : `${expression} = ${opreguleretGrundydelseText}`;
};

export const buildKapitaliseringAarsydelseExpression = (
  aarsydelseGrundlagText: string,
  reguleringsPctText: string | null,
  aarsydelseText?: string
): string => {
  const expression = reguleringsPctText === null
    ? `Årlig ydelse (${aarsydelseGrundlagText})`
    : `Årlig ydelse (${aarsydelseGrundlagText} × ${reguleringsPctText})`;
  return aarsydelseText === undefined ? `${expression} =` : `${expression} = ${aarsydelseText}`;
};

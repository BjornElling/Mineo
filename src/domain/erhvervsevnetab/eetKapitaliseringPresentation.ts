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

export type SvieSmerteDraftRow = Readonly<{
  id: string;
  fra: string;
  til: string;
  tilstand: string;
}>;

export type TafDraftRow = Readonly<{
  id: string;
  fra: string;
  til: string;
  loseFeriedage: string;
}>;

export type FerieDraftRow = Readonly<{
  id: string;
  fra: string;
  til: string;
}>;

export type OevrigeKravDraftRow = Readonly<{
  id: string;
  dato: string;
  udgiftTil: string;
  beloeb: string;
}>;

/**
 * Fælles tomheds-prædikat for fra/til-baserede draft-rækker (Ferie, TAF, Svie/Smerte).
 * En række regnes som tom, når både `fra` og `til` er blanke (efter trim).
 *
 * BEMÆRK: Dette er draft-/UI-lagets tomheds-check. Den schema-drevne persisterede
 * row-tomhed ejes separat af `rowEmpty.ts` (`isEmptyByKeys`) og må ikke flettes sammen.
 */
export const isFraTilDraftRowEmpty = (row: Readonly<{ fra: string; til: string }>): boolean =>
  row.fra.trim() === '' && row.til.trim() === '';


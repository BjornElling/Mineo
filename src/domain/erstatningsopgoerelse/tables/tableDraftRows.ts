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


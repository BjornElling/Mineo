export type SHDageTableRow = Readonly<{
  ugedag: string;
  datoDisplay: string;
  helligdagNavn: string;
  erSHDag: boolean;
}>;

export interface SelectedElements {
  opgoerelse: boolean;
  loenindkomst: boolean;
  offentligeYdelser: boolean;
  midlertidigEet: boolean;
  shDage: boolean;
  regulering: boolean;
  offentligeYdelserRegulering: boolean;
  okSatser: boolean;
  sygeferiegodtgoerelse: boolean;
}

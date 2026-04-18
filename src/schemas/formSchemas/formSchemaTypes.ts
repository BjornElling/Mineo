export type AarsloenMetode = 'A' | 'B' | 'C' | 'ingen';

export interface AarsloenBeregningResult {
  metode: AarsloenMetode;
  erEtAar: boolean;
  hverdageIPeriode?: number;
  feriedageFraInput?: number;
  arbejdsdageIPeriode?: number;
  feriedagePaaAar?: number;
  arbejdsdagePaaAar?: number;
  hverdagePaaAar?: number;
  omregnetAarsloen?: number;
  antalMaaneder?: number;
  antalHeleKalendermaaneder?: number;
}

export interface DateInterval {
  start: Date;
  end: Date;
}

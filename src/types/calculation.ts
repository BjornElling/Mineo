export interface AarsloenBeregningResultIngen {
  metode: 'ingen';
  erEtAar: false;
}

export interface AarsloenBeregningResultBeregnet {
  metode: 'A' | 'B' | 'C';
  erEtAar: boolean;
  hverdageIPeriode: number;
  feriedageFraInput: number;
  arbejdsdageIPeriode: number;
  feriedagePaaAar: number;
  arbejdsdagePaaAar: number;
  hverdagePaaAar: number;
  omregnetAarsloen: number;
  antalEnheder: number;
  antalHeleKalendermaaneder: number | null;
}

export type AarsloenBeregningResult = AarsloenBeregningResultIngen | AarsloenBeregningResultBeregnet;

export interface DateInterval {
  start: Date;
  end: Date;
}

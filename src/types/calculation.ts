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

/**
 * Den kanoniske "ingen beregning"-værdi. Bruges hvor en consumer skal rendere uden et resultat — fx når
 * årslønsprojektionen er blokeret af en rød feltfejl og derfor ikke har kaldt motoren (§3.9). Samme variant
 * motoren selv returnerer, når input ikke rækker til en metode, så der findes kun ÉN "intet resultat"-form.
 */
export const AARSLOEN_BEREGNING_INGEN: AarsloenBeregningResultIngen = Object.freeze({
  metode: 'ingen',
  erEtAar: false,
});

export interface DateInterval {
  start: Date;
  end: Date;
}

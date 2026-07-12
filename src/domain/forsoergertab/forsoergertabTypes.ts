import type { EetIssue } from '../erhvervsevnetab/eetTypes';
import type { ISODateString } from '../../types/branded';
import type { Koen } from '../../schemas/formSchemas';
import type { MoneyOre } from '../money/money';

/**
 * Forsørgertabsdomænets forbrugerejede EAL-port. Den eksplicitte projektion forhindrer, at
 * domænet muterer eller bliver typemæssigt koblet til Erhvervsevnetabs søster-output.
 */
export type ForsoergertabEalPort = Readonly<{
  beregningsdato: ISODateString;
  skadedato: ISODateString;
  fodselsdato: ISODateString;
  skadesaar: number;
  beregningsaar: number;
  aarsloenOre: MoneyOre;
  aarsloenSource: 'eal' | 'asl';
  reguleringsaar: readonly number[];
  reguleringsPctRounded4: number;
  reguleretAarsloenOre: MoneyOre;
  eetPct: number;
  eetPctSource: 'eal' | 'asl';
  kapitaliseringsfaktor: 10;
  eetBeregnetOre: MoneyOre;
  eetMaksOre: MoneyOre;
  eetAnvendtOre: MoneyOre;
  eetReduceretTilMaks: boolean;
  alderVedSkade: number;
  alderVedSkadeCapped: number;
  aldersreduktionPct: number;
  aldersreduktionBeloebOre: MoneyOre;
  ealKravOre: MoneyOre;
}>;

export type ForsoergertabEalKravResult = Readonly<{
  issues: readonly EetIssue[];
  computation: ForsoergertabEalPort | null;
  foersoergertabEalMinSatsOre: MoneyOre | null;
  foersoergertabForhoejtetTilMin: boolean;
}>;

export type AslLobendeYdelseRaekke = Readonly<{
  fraDato: ISODateString;
  tilDato: ISODateString;
  maaneder: number;        // 4 decimaler (round4)
  maanedligYdelse: number; // heltal — garanteret fordi ceilNearest12 altid giver et beløb deleligt med 12
  ydelseIAlt: number;      // heltal (round0)
}>;

export type ForsoergertabAslComputation = Readonly<{
  skadedato: ISODateString;
  beregningsdato: ISODateString;
  virkningsdato: ISODateString;
  efterladteFodselsdato: ISODateString;
  skadesaar: number;
  beregningsaar: number;
  koen: Koen | undefined;
  aslAarsloen: number;
  aslAarsloenAfrundet1000: number;
  benyttetAarsloen: number;
  aarsloenMaxSkadesaar: number;
  aarsloenMaxBeregningsaar: number;
  opreguleringsfaktor: number;
  opreguleretAarligYdelse: number;
  samletMaaneder: number;
  alleredeUdbetaltMaaneder: number;
  resterendeMaanederTotal: number;
  resterendeAar: number;
  resterendeMaaneder: number;
  kapitaliseringsbekendtgoerelseId: string;
  kapitaliseringsTabel: string | null;
  kapitaliseringsTabelKoensopdelt: boolean;
  alderHeleAar: number;
  folkepensionsalderLabel: string;
  folkepensionsalderMaaneder: number;
  harNaaetFolkepensionsalder: boolean;
  kapitalfaktor: number | null;
  kapitalbelob: number;
  lobendeYdelser: readonly AslLobendeYdelseRaekke[];
  aslLobendeYdelserTotal: number;
}>;

export type ForsoergertabAslResult = Readonly<{
  issues: readonly EetIssue[];
  computation: ForsoergertabAslComputation | null;
}>;

export type ForsoergertabCalculation = Readonly<{
  ealKrav: number;
  aslKapitalbelob: number;
  aslLobendeYdelserTotal: number;
  nettokrav: number;
}>;

export type ForsoergertabCalculationResult = Readonly<{
  issues: readonly EetIssue[];
  ealComputation: ForsoergertabEalPort | null;
  aslComputation: ForsoergertabAslComputation | null;
  foersoergertabEalMinSatsOre: MoneyOre | null;
  foersoergertabForhoejtetTilMin: boolean;
  result: ForsoergertabCalculation | null;
}>;

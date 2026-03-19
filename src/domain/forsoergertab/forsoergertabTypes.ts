import type { EetIssue } from '../erhvervsevnetab/eetTypes';
import type { ISODateString } from '../../types/branded';
import type { Koen } from '../../schemas/formSchemas';
import type { EetEalComputation } from '../erhvervsevnetab/eetEalCalculation';

export type ForsoergertabIssue = EetIssue;

export type ForsoergertabEalKravResult = Readonly<{
  issues: readonly ForsoergertabIssue[];
  computation: EetEalComputation | null;
}>;

export type ForsoergertabAslComputation = Readonly<{
  skadesdato: ISODateString;
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
  folkepensionsalderAarLabel: string;
  folkepensionsalderMaaneder: number;
  harNaaetFolkepensionsalder: boolean;
  kapitalfaktor: number | null;
  kapitalbelob: number;
}>;

export type ForsoergertabAslResult = Readonly<{
  issues: readonly ForsoergertabIssue[];
  computation: ForsoergertabAslComputation | null;
}>;

export type ForsoergertabCalculation = Readonly<{
  ealKrav: number;
  aslKapitalbelob: number;
  nettokrav: number;
}>;

export type ForsoergertabCalculationResult = Readonly<{
  issues: readonly ForsoergertabIssue[];
  ealComputation: EetEalComputation | null;
  aslComputation: ForsoergertabAslComputation | null;
  result: ForsoergertabCalculation | null;
}>;

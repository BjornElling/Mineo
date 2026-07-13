import type { ISODateString } from '../../../types/branded';
import type { MoneyOre } from '../../money/money';
import type { IsoRange } from '../validation/tafPeriodConstraints';
import type { SfggDayBasis, SfggSourceKind } from './sfggKilde';
import type { SfggAfkortning } from './sfggPeriodisering';
import type { SfggReferencesatsCalculable, SfggReferencesatsFormula } from './sfggReferencesats';

export type SygeferiegodtgoerelseSegment = Readonly<{
  ansaettelsesforholdId: string;
  ansaettelsesforholdNavn: string;
  fra: ISODateString;
  til: ISODateString;
  reguleringsindeks: number | null;
  satsOre: MoneyOre;
  agPensionPct: number;
  antalDage: number;
  feriepengekravOre: MoneyOre;
  beregnetSfggoereOre: MoneyOre;
  loenPlusLoen2PlusIkkePensLoenKroner: number;
  feriepengeAfSygeloenOre: MoneyOre;
  alleredeBetaltOre: MoneyOre;
}>;

export type SfggFeriepengeModtagetFormula = Readonly<{
  totalOre: MoneyOre;
}>;

export type SygeferiegodtgoerelseAnsaettelsesforholdResult = Readonly<{
  ansaettelsesforholdId: string;
  ansaettelsesforholdNavn: string;
  sfggSourceLabel: string;
  sfggSourceKind: SfggSourceKind;
  sfggDayBasis: SfggDayBasis;
  sfggIntroText: string | null;
  sfggReferenceperiodeAuthorityText: string | null;
  sfggReferenceperiodeLabel: string;
  sfggDirectRateLabel: string | null;
  sfggFirstTafDayExcludedText: string | null;
  sfggAfterEmployerSickPayText: string | null;
  sfggLovbestemtFeriepengeNote: string | null;
  foerstEfterSygeloen: boolean;
  sfggAfkortninger: readonly SfggAfkortning[];
  segments: readonly SygeferiegodtgoerelseSegment[];
  perYear: readonly Readonly<{ year: number; amountOre: MoneyOre }>[];
  feriepengekravTotalOre: MoneyOre;
  totalOre: MoneyOre;
  alleredeBetaltOre: MoneyOre;
  sfggVisningsperiode: readonly IsoRange[];
  sfggReferenceperiode: Readonly<{ fra: ISODateString; til: ISODateString }> | null;
  sfggReferencesats: SfggReferencesatsCalculable;
  sfggReferencesatsFormula: SfggReferencesatsFormula | null;
  feriepengeModtagetFormula: SfggFeriepengeModtagetFormula | null;
  capReachedDate: ISODateString | null;
}>;

export type SygeferiegodtgoerelseResult = Readonly<{
  totalOre: MoneyOre;
  perAnsaettelsesforhold: readonly SygeferiegodtgoerelseAnsaettelsesforholdResult[];
  perYear: readonly Readonly<{ year: number; amountOre: MoneyOre }>[];
  firstExcludedDate: ISODateString | null;
}>;

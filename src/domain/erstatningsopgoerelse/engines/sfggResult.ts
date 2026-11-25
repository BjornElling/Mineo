import type { ISODateString } from '../../../types/branded';
import type { MoneyOre } from '../../money/money';
import type { IsoRange } from '../validation/tafPeriodConstraints';
import type { SfggDayBasis, SfggSourceKind } from './sfggKilde';
import type { SfggAfkortning } from './sfggPeriodisering';
import type { SfggReferencesatsCalculable, SfggReferencesatsFormula } from './sfggReferencesats';
import type { KlLoenaftalerReguleringTrin } from './klLoenaftalerReguleretLoen';

export type SygeferiegodtgoerelseSegment = Readonly<{
  ansaettelsesforholdId: string;
  ansaettelsesforholdNavn: string;
  fra: ISODateString;
  til: ISODateString;
  reguleringsindeks: number | null;
  /** Faktiske værdier bag satsens forhold; bevarer efterregnelighed ved afrundet indeksvisning. */
  reguleringsgrundlag?: Readonly<{ referenceValue: number; periodValue: number }>;
  /** SFGG-satsens egen KL-kæde fra referenceperiodens slutdato, med afrunding på hvert trin. */
  klTrin?: readonly KlLoenaftalerReguleringTrin[];
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
  sfggDirectRateLabel: string | null;
  sfggFirstTafDayExcludedText: string | null;
  sfggAfterEmployerSickPayText: string | null;
  sfggLovbestemtFeriepengeNote: string | null;
  foerstEfterSygeloen: boolean;
  /** Om dage med sygeløn (lønrækker i erstatningsperioden) faktisk er trukket fra perioden. */
  sygeloenFratrukket: boolean;
  sfggAfkortninger: readonly SfggAfkortning[];
  segments: readonly SygeferiegodtgoerelseSegment[];
  perYear: readonly Readonly<{ year: number; amountOre: MoneyOre }>[];
  feriepengekravTotalOre: MoneyOre;
  totalOre: MoneyOre;
  alleredeBetaltOre: MoneyOre;
  sfggVisningsperiode: readonly IsoRange[];
  sfggReferenceperiode: Readonly<{ fra: ISODateString; til: ISODateString }> | null;
  /** Sat, når satsen reguleres fra reguleringsdatoen i stedet for referenceperiodens slutdato (BB-453). */
  sfggReguleringsdatoForReference: ISODateString | null;
  sfggReferencesats: SfggReferencesatsCalculable;
  sfggReferencesatsFormula: SfggReferencesatsFormula | null;
  feriepengeModtagetFormula: SfggFeriepengeModtagetFormula | null;
  capReachedDate: ISODateString | null;
  /**
   * Første dag med krav, som ikke kunne få en sats (fx før overenskomstens første direkte sats). Dagene indgår
   * ikke i beregningen; feltet er sat, så valideringen kan spærre i stedet for, at dagene udelades uden besked
   * (værdiklasse-gennemgangen 2026-11-24, fund C, godkendt af udvikleren 2026-11-25).
   */
  foersteDagUdenSats?: ISODateString;
}>;

export type SygeferiegodtgoerelseResult = Readonly<{
  totalOre: MoneyOre;
  perAnsaettelsesforhold: readonly SygeferiegodtgoerelseAnsaettelsesforholdResult[];
  perYear: readonly Readonly<{ year: number; amountOre: MoneyOre }>[];
  firstExcludedDate: ISODateString | null;
}>;

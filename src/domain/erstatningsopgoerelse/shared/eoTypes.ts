import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import type { ISODateString } from '../../../types/branded';
import type { TafBeregningsenhed } from '../helpers/tafBeregningsenhed';
import type { IsoRange } from '../validation/tafPeriodConstraints';
import type { SygeferiegodtgoerelseResult } from '../engines/sfggResult';
import type { ReguleringForloeb } from '../engines/reguleringForloeb';
import type { MoneyOre } from '../../money/money';

export type Calculable<T> =
  | Readonly<{ status: 'ok'; value: T }>
  | Readonly<{ status: 'not_calculable'; reason: string }>;

export const asCalculable = <T>(value: T): Extract<Calculable<T>, { status: 'ok' }> => ({
  status: 'ok',
  value,
});

export type EoModel = Readonly<{
  titel: string;
  titelMetadata: string;
  periode: Readonly<{ fra: ISODateString; til: ISODateString }> | null;
  periodeDisplay: string | null;
  skadelidteNavn: string | null;
  skadestypeLinje: string | null;
  brevhoved: Readonly<{
    journalnr?: string;
    advokat?: string;
    sagsbehandler?: string;
    dagsDatoISO: ISODateString;
  }> | null;
  svieSmerte: SvieSmerteModel;
  forlig: ForligModel;
  tabtArbejdsfortjeneste: TabtArbejdsfortjenesteModel;
  oevrigeKrav: OevrigeKravModel;
  samlet: Readonly<{
    svieSmerteOre: MoneyOre;
    tabtArbejdsfortjenesteOre: MoneyOre;
    oevrigeKravOre: MoneyOre;
    totalOre: MoneyOre;
  }>;
  saerligeKommentarer: string | null;
  tafRanges: readonly IsoRange[];
}>;

// Præsentationsmodellen bærer SFGG-motorens resultat uændret; motoren er eneste sandhedskilde
// for formen. Aliaset (frem for en håndholdt parallel kopi) sikrer, at model og motor-resultat
// aldrig kan drive fra hinanden.
export type SygeferiegodtgoerelseModel = SygeferiegodtgoerelseResult;

export type ForligModel =
  | Readonly<{
    erIndgaaet: false;
    label: null;
    dato: null;
    factor: null;
  }>
  | Readonly<{
    erIndgaaet: true;
    label: string;
    dato: ISODateString | null;
    factor: number;
  }>;

export type SvieSmerteModel = Readonly<{
  beregnes: boolean;
  /**
   * Når `true` skal emnet udelades HELT fra erstatningsopgørelse-PDF'en (ingen overskrift,
   * intet "Ingen"). Modsat `beregnes: false` (Nej), der stadig viser overskrift + "Ingen".
   * `skjul` medfører altid `beregnes: false`.
   */
  skjul: boolean;
  statusLinjer: readonly string[];
  opgjortFremTilPeriodeTil: boolean;
  periodeHeading: string;
  periodeLinjer: readonly string[];
  harPerioder: boolean;
  satserAar: number | null;
  satserPerDag: Calculable<MoneyOre>;
  /**
   * Per-dag-satsen for en delvis sygedag = `satserPerDag * delvisFaktor`, afrundet til øre.
   * Beregnes i præsentationslaget (ikke i rendereren), så den viste delvis-dagssats er
   * konsistent med totalberegningen. Er ikke-beregnelig når `satserPerDag` er det.
   */
  delvisSatsPerDag: Calculable<MoneyOre>;
  satserMax: Calculable<MoneyOre>;
  forligLabel: string | null;
  forligSatserSuffix: string | null;
  forligFactor: number | null;
  satserPerDagFoerForlig: Calculable<MoneyOre>;
  /** Delvis-dagssatsen før forlig = `satserPerDagFoerForlig * delvisFaktor`, afrundet til øre. */
  delvisSatsPerDagFoerForlig: Calculable<MoneyOre>;
  satserMaxFoerForlig: Calculable<MoneyOre>;
  tidligere: Calculable<MoneyOre>;
  aktuel: Calculable<MoneyOre>;
  sygedage: number;
  delviseSygedage: number;
  delvisFaktor: 1 | 0.5;
  maxApplied: boolean;
  totalOre: MoneyOre;
}>;

export type TabtArbejdsfortjenesteModel = Readonly<{
  beregnes: boolean;
  /**
   * Når `true` skal emnet udelades HELT fra erstatningsopgørelse-PDF'en (ingen overskrift,
   * intet "Ingen"). Modsat `beregnes: false` (Nej), der stadig viser overskrift + "Ingen".
   * `skjul` medfører altid `beregnes: false`. Bemærk: den separate "TAF fordelt på år"-PDF
   * påvirkes ikke af `skjul` og viser fortsat "Ingen".
   */
  skjul: boolean;
  statusLinjer: readonly string[];
  eetLinjer: readonly string[];
  differencekravLinje: string | null;
  ferieFravaerLinje: string | null;
  tafPerioderLinjer: readonly string[];
  harTafPerioder: boolean;
  tafBeregningsenhed: TafBeregningsenhed;
  skalKomprimereIndkomstBeregning: boolean;
  indkomstSkadestidspunkt: IndkomstSkadestidspunktModel | null;
  loenudvikling: LoenudviklingModel | null;
  offentligeYdelserUdvikling: OffentligeYdelserUdviklingModel | null;
  tafIndtaegter: TafIndtaegterModel | null;
  tidligereModtagetTaf: Calculable<MoneyOre>;
  sygeferiegodtgoerelse: SygeferiegodtgoerelseModel;
  tabtArbejdsfortjenesteFoerForligOre: MoneyOre;
  tabtArbejdsfortjenesteOre: MoneyOre;
}>;

export type IndkomstSkadestidspunktModel = Readonly<{
  beregningsenhed: TafBeregningsenhed;
  beregnesUdFra: ErstatningsopgoerelseValues['beregnesUdFra'];
  loenBaseretPaa: string | null;
  skadedato: ISODateString | null;
  periodeTilBeregning: Readonly<{ fra: ISODateString; til: ISODateString }> | null;
  ansaettelserNavne: readonly string[];
  arbejdssteder: readonly {
    navn: string;
    fpLabel: string;
    pensionLabel: string;
    breakdown: Readonly<{
      loenPlusLoen2Ore: MoneyOre;
      loenPlusLoen2PlusIkkePensLoenOre: MoneyOre;
      fpFvShSoOre: MoneyOre;
      pensionOre: MoneyOre;
      atpOre: MoneyOre;
      samletOre: MoneyOre;
    }>;
  }[];
  offentligeYdelser: readonly {
    label: string;
    amountOre: MoneyOre;
  }[];
  offentligeYdelserTotalOre: MoneyOre;
  samletBeregningsgrundlagOre: MoneyOre | null;
  totalBreakdown: Readonly<{
    loenPlusLoen2Ore: MoneyOre;
    loenPlusLoen2PlusIkkePensLoenOre: MoneyOre;
    fpFvShSoOre: MoneyOre;
    pensionOre: MoneyOre;
    atpOre: MoneyOre;
    samletOre: MoneyOre;
  }> | null;
  arbejdsdage: number | null;
  maaneder: number | null;
  maanedsloen: Calculable<MoneyOre>;
  dagsloen: Calculable<MoneyOre>;
  beregningsperiodeLabel: string | null;
  beregningsgrundlagMellemregningLabel: string | null;
  beregningsgrundlagMellemregningResultat: string | null;
}>;

// reguleretLoenOre: kun sat for KL-lønaftaler, hvor reguleringen sker trinvist på
// selve lønnen. Det er den opregulerede, afrundede enhedsløn (måneds-/dagsløn) for
// perioden. Når den er sat, viser indkomst-linjerne "antal á reguleret løn = beløb"
// uden faktor-tekst (modsat øvrige modeller, der viser basisløn × (100 % + delta %)).
// Se docs/domain/taf/kl-loenaftaler-regulering.md.
export type LoenudviklingSegment =
  | Readonly<{
    kind: 'maaneder';
    fra: ISODateString;
    til: ISODateString;
    maaneder: number;
    maanedsloenOre: MoneyOre;
    deltaPct: number;
    amountOre: MoneyOre;
    reguleretLoenOre?: MoneyOre;
  }>
  | Readonly<{
    kind: 'arbejdsdage';
    fra: ISODateString;
    til: ISODateString;
    arbejdsdage: number;
    dagsloenOre: MoneyOre;
    deltaPct: number;
    amountOre: MoneyOre;
    reguleretLoenOre?: MoneyOre;
  }>;

export type LoenudviklingModel = Readonly<{
  loenudviklingLabel: string;
  loenudviklingTotal: Calculable<MoneyOre>;
  beregningsenhed: TafBeregningsenhed;
  beregnedeSegmenter: readonly LoenudviklingSegment[];
  // Autoritativ kildeserie for manuel procentsats, KRL, almindelig statistik og KL-lønaftaler.
  // Top-level bruges ved angivet løn (perAnsaettelse er tom).
  forloeb?: ReguleringForloeb;
  perAnsaettelse: readonly Readonly<{
    ansaettelsesforholdId: string;
    ansaettelsesforholdNavn: string;
    loenudviklingLabel: string;
    loenudviklingTotal: Calculable<MoneyOre>;
    beregnedeSegmenter: readonly LoenudviklingSegment[];
    forloeb?: ReguleringForloeb;
  }>[];
}>;

export type OffentligeYdelserUdviklingEntry = Readonly<{
  typeKey: string;
  label: string;
  beregnedeSegmenter: readonly LoenudviklingSegment[];
  total: Calculable<MoneyOre>;
}>;

export type OffentligeYdelserUdviklingModel = Readonly<{
  reguleringsLabel: string;
  reguleringsBaseIso: ISODateString | undefined;
  beregningsenhed: TafBeregningsenhed;
  entries: readonly OffentligeYdelserUdviklingEntry[];
  total: Calculable<MoneyOre>;
}>;

export type TafIndtaegterModel = Readonly<{
  entries: readonly { label: string; amountOre: MoneyOre }[];
  oevrigeKravForbeholdYdelsestyper: readonly string[];
  total: Calculable<MoneyOre>;
}>;

export type OevrigeKravModel = Readonly<{
  beregnes: boolean;
  /**
   * Når `true` skal emnet udelades HELT fra erstatningsopgørelse-PDF'en (ingen overskrift,
   * intet "Ingen"). Modsat `beregnes: false` (Nej), der stadig viser overskrift + "Ingen".
   * `skjul` medfører altid `beregnes: false`.
   */
  skjul: boolean;
  entries: readonly { dateText: string; udgiftTil: string; amountOre: MoneyOre }[];
  totalFoerForligOre: MoneyOre;
  totalOre: MoneyOre;
}>;

/**
 * B8 — tvungen grænse mellem section-præsentation og canonical-totaler.
 *
 * `buildErstatningsopgoerelsePdfModelFromComputed` modtager section-modellerne via disse
 * `Omit`-typer, der har fjernet de autoritative beløbs-totaler. Totalerne ejes udelukkende af
 * `EoComputedTotals` (eoCanonicalOutput.ts) og injiceres i PDF-modellen fra canonical.
 * Fordi præsentations-inputtet ikke længere *har* total-felterne, er det en compile-fejl at
 * forwarde et section-afledt total ind i den rendrede model — en re-derivation kan ikke længere
 * lække til PDF/Word-output uden at TypeScript fanger det (jf. eo-snapshot-contract.md §1:
 * "Ingen EO-total må beregnes parallelt i UI-komponenter, PDF-writers eller kontrollag").
 */
export type SvieSmerteSectionPresentation = Omit<SvieSmerteModel, 'totalOre'>;
export type TabtArbejdsfortjenesteSectionPresentation = Omit<
  TabtArbejdsfortjenesteModel,
  'tabtArbejdsfortjenesteFoerForligOre' | 'tabtArbejdsfortjenesteOre'
>;
export type OevrigeKravSectionPresentation = Omit<OevrigeKravModel, 'totalFoerForligOre' | 'totalOre'>;

/**
 * Hvad `buildOevrigeKravModel` leverer som input til canonical: krav-rækker + pre-forlig-total.
 * Post-forlig-totalen (`totalOre`) re-deriveres af `buildEoComputedTotals` (forlig-skalering),
 * så byggeren bærer den ikke. Den var tidligere en ulæst dublet af `totalFoerForligOre` (B8).
 */
export type OevrigeKravCanonicalInput = Omit<OevrigeKravModel, 'totalOre'>;

import type { ErstatningsopgoerelseValues } from '../../schemas/formSchemas';
import type { ISODateString } from '../../types/branded';
import type { TafBeregningsenhed } from './tafBeregningsenhed';
import type { IsoRange } from './tafPeriodConstraints';
import type {
  SfggDayBasis,
  SfggFeriepengeModtagetFormula,
  SfggReferencesatsCalculable,
  SfggReferencesatsFormula,
} from './sygeferiegodtgoerelse';

export type MoneyOre = number;
export type MoneyKroner = number;

export type Calculable<T> =
  | Readonly<{ status: 'ok'; value: T }>
  | Readonly<{ status: 'not_calculable'; reason: string }>;

export type PdfModel = Readonly<{
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
  svieSmerte: SvieSmertePdfModel;
  forlig: ForligPdfModel;
  tabtArbejdsfortjeneste: TabtArbejdsfortjenestePdfModel;
  oevrigeKrav: OevrigeKravPdfModel;
  samlet: Readonly<{
    svieSmerteOre: MoneyOre;
    tabtArbejdsfortjenesteOre: MoneyOre;
    oevrigeKravOre: MoneyOre;
    totalOre: MoneyOre;
  }>;
  saerligeKommentarer: string | null;
  /** Clampede TAF-ranges brugt i beregningen — bruges af shDageSection til at bestemme helligdage-interval. */
  tafRanges: readonly IsoRange[];
}>;

export type SygeferiegodtgoerelsePdfModel = Readonly<{
  totalOre: MoneyOre;
  perYear: readonly Readonly<{
    year: number;
    amountOre: MoneyOre;
  }>[];
  firstExcludedDate: ISODateString | null;
  perAnsaettelsesforhold: readonly Readonly<{
    ansaettelsesforholdId: string;
    ansaettelsesforholdNavn: string;
    sfggSourceLabel: string;
    sfggSourceKind: 'ingen' | 'manuel' | 'ferielov' | 'overenskomst_direkte' | 'overenskomst_ferielov';
    sfggDayBasis: SfggDayBasis;
    sfggIntroText: string | null;
    sfggReferenceperiodeAuthorityText: string | null;
    sfggReferenceperiodeLabel: string;
    sfggDirectRateLabel: string | null;
    sfggFirstTafDayExcludedText: string | null;
    sfggAfterEmployerSickPayText: string | null;
    pdfExplanatoryLines: readonly string[];
    perYear: readonly Readonly<{
      year: number;
      amountOre: MoneyOre;
    }>[];
    feriepengekravTotalOre: MoneyOre;
    totalOre: MoneyOre;
    alleredeBetaltOre: MoneyOre;
    sfggReferenceperiode: Readonly<{ fra: ISODateString; til: ISODateString }> | null;
    sfggReferencesats: SfggReferencesatsCalculable;
    sfggReferencesatsFormula: SfggReferencesatsFormula | null;
    feriepengeModtagetFormula: SfggFeriepengeModtagetFormula | null;
    capReachedDate: ISODateString | null;
    capRows: readonly Readonly<{
      fra: ISODateString;
      til: ISODateString;
      antalDage: number;
      maanederPraecis: number;
    }>[];
    segments: readonly Readonly<{
      fra: ISODateString;
      til: ISODateString;
      reguleringsindeks: number | null;
      satsOre: MoneyOre;
      agPensionPct: number;
      antalDage: number;
      feriepengekravOre: MoneyOre;
      beregnetSfggoereOre: MoneyOre;
      ferieberettigetLoenKroner: number;
      feriepengeAfSygeloenOre: MoneyOre;
      alleredeBetaltOre: MoneyOre;
    }>[];
  }>[];
}>;

export type ForligPdfModel =
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

export type SvieSmertePdfModel = Readonly<{
  beregnes: boolean;
  statusLinjer: readonly string[];
  opgjortFremTilPeriodeTil: boolean;
  periodeHeading: string;
  periodeLinjer: readonly string[];
  harPerioder: boolean;
  satserAar: number | null;
  satserPerDag: Calculable<MoneyOre>;
  satserMax: Calculable<MoneyOre>;
  forligLabel: string | null;
  forligSatserSuffix: string | null;
  forligFactor: number | null;
  satserPerDagFoerForlig: Calculable<MoneyOre>;
  satserMaxFoerForlig: Calculable<MoneyOre>;
  tidligere: Calculable<MoneyOre>;
  aktuel: Calculable<MoneyOre>;
  sygedage: number;
  delviseSygedage: number;
  delvisFaktor: 1 | 0.5;
  maxApplied: boolean;
  totalOre: MoneyOre;
}>;

export type TabtArbejdsfortjenestePdfModel = Readonly<{
  beregnes: boolean;
  statusLinjer: readonly string[];
  eetLinjer: readonly string[];
  differencekravLinje: string | null;
  tafPerioderLinjer: readonly string[];
  harTafPerioder: boolean;
  tafBeregningsenhed: TafBeregningsenhed;
  skalKomprimereIndkomstBeregning: boolean;
  indkomstSkadestidspunkt: IndkomstSkadestidspunktPdfModel | null;
  loenudvikling: LoenudviklingPdfModel | null;
  tafIndtaegter: TafIndtaegterPdfModel | null;
  tidligereModtagetTaf: Calculable<MoneyOre>;
  sygeferiegodtgoerelse: SygeferiegodtgoerelsePdfModel;
  tabtArbejdsfortjenesteFoerForligOre: MoneyOre;
  tabtArbejdsfortjenesteOre: MoneyOre;
}>;

export type IndkomstSkadestidspunktPdfModel = Readonly<{
  beregningsenhed: TafBeregningsenhed;
  beregnesUdFra: ErstatningsopgoerelseValues['beregnesUdFra'];
  loenBaseretPaa: string | null;
  skadesdato: ISODateString | null;
  periodeTilBeregning: Readonly<{ fra: ISODateString; til: ISODateString }> | null;
  ansaettelserNavne: readonly string[];
  arbejdssteder: readonly {
    navn: string;
    fpLabel: string;
    pensionLabel: string;
    breakdown: Readonly<{
      ferieberetOre: MoneyOre;
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
    ferieberetOre: MoneyOre;
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

export type LoenudviklingSegment =
  | Readonly<{
    kind: 'maaneder';
    fra: ISODateString;
    til: ISODateString;
    maaneder: number;
    maanedsloenOre: MoneyOre;
    deltaPct: number;
    amountOre: MoneyOre;
  }>
  | Readonly<{
    kind: 'arbejdsdage';
    fra: ISODateString;
    til: ISODateString;
    arbejdsdage: number;
    dagsloenOre: MoneyOre;
    deltaPct: number;
    amountOre: MoneyOre;
  }>;

export type LoenudviklingPdfModel = Readonly<{
  loenudviklingLabel: string;
  loenudviklingTotal: Calculable<MoneyOre>;
  beregningsenhed: TafBeregningsenhed;
  beregnedeSegmenter: readonly LoenudviklingSegment[];
  perAnsaettelse: readonly Readonly<{
    ansaettelsesforholdId: string;
    ansaettelsesforholdNavn: string;
    loenudviklingLabel: string;
    loenudviklingTotal: Calculable<MoneyOre>;
    beregnedeSegmenter: readonly LoenudviklingSegment[];
  }>[];
}>;

export type TafIndtaegterPdfModel = Readonly<{
  entries: readonly { label: string; amountOre: MoneyOre }[];
  oevrigeKravForbeholdYdelsestyper: readonly string[];
  total: Calculable<MoneyOre>;
}>;

export type OevrigeKravPdfModel = Readonly<{
  entries: readonly { dateText: string; udgiftTil: string; amountOre: MoneyOre }[];
  totalFoerForligOre: MoneyOre;
  totalOre: MoneyOre;
}>;

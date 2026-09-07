import type { ISODateString } from '../../types/branded';

// Autofill-suggest, lag 1 (rene typer). Modellen er den ENE datagrænse mellem en tabel og
// mønstergenkendelsen: tabellen leverer kolonnernes canonical prøver i VISNINGSorden, og motoren svarer
// med den tekst, cellen skal vise som forslag, og den råtekst, et accept skal settle.
//
// Grænsen er bevidst TYPE-UDSLETTET på vej ud af tabellen: hver kolonne medbringer sin egen
// `format`-lukning, bygget af feltets descriptor i `autofillColumns.ts`, hvor værditypen stadig er kendt.
// Alternativet – en generisk model over rækketypen – ville skulle bæres hele vejen gennem React-contexten
// og ned i celle-komponenten, som er generisk over sin EGEN celletype og ikke kan kende tabellens.

/**
 * En canonical prøve fra én celle. Prøven er allerede afkodet til den form, mønstergenkendelsen regner i –
 * ikke feltets råtekst og ikke dets canonical repræsentation.
 *
 * `monthOfYear` og `year` er skilt, fordi de regner forskelligt: måneden er MODULÆR (12 → 1), mens årstallet
 * er lineært. Havde de været én `integer`-art, ville et årstal kunne wrappe og en måned kunne løbe til 13.
 */
export type AutofillSampleValue =
  | Readonly<{ kind: 'date'; iso: ISODateString }>
  | Readonly<{ kind: 'week'; week: number; year: number }>
  | Readonly<{ kind: 'monthOfYear'; month: number }>
  | Readonly<{ kind: 'year'; year: number }>
  | Readonly<{ kind: 'amount'; value: number }>
  | Readonly<{ kind: 'choice'; value: string }>;

export type AutofillColumnKind = AutofillSampleValue['kind'];

/**
 * Det forslag, en celle viser og kan acceptere.
 *
 * `rawText` går gennem feltets codec ved accept – præcis som havde brugeren tastet teksten og trykket
 * Enter (§1.3). Der findes derfor ingen canonical skrivevej for et forslag: et forslag, feltets egen
 * parse ikke kan læse, bliver rejected og rødt på samme måde som en tastet værdi.
 */
export type AutofillSuggestion = Readonly<{
  /** Ghost-teksten i cellen: feltets VISNINGSform af den foreslåede værdi. */
  displayText: string;
  /** Råteksten eller choice-værdien, accept committer. Altid en form feltet selv kan tage imod. */
  rawText: string;
}>;

/**
 * Én kolonne i modellen.
 *
 * `samples` er parallel med {@link AutofillSuggestModel.rowIds}: samme længde, samme rækkefølge. En
 * `undefined`-plads betyder «ingen brugbar prøve i denne række», og det dækker fire tilstande: tom
 * celle, placeholder-række, afsluttet rejected råtekst og en canonical værdi, der er skjult bag en rød
 * feltfejl. Det er præcis den filtrering, kravet beskriver: fejlbehæftede og delvist udfyldte rækker
 * springes over, og mønstret dannes af de øvrige.
 *
 * **Hvor filtreringen faktisk sker.** Byggerne i `autofillColumns.ts` ser aldrig et `FieldIssue`; de
 * kender kun værdier. Det røde input frafiltreres ét lag tidligere, i de reader-afledte rækkeprojektioner
 * tabellerne fodrer modellen med (`readStandardLoenTableRows` og EO's `erstatningsopgoerelseReaderProjection`),
 * hvor `InputReader.read` svarer `status: 'error'` for en celle med et rødt feltissue, og projektionen
 * derfor udleverer feltets tomværdi. En rejected råtekst har slet ingen canonical værdi (XOR-invarianten)
 * og forsvinder ad samme vej.
 *
 * Det er derfor et KRAV til en ny tabel, der monterer autofill: dens rækker skal komme fra readeren på
 * samme vilkår. Fodres modellen med rå sektionsdata, ville en out-of-bounds-dato eller en måned 13 blive
 * en prøve, og et forslag kunne ekstrapoleres af en værdi, brugeren allerede har rødt at rette.
 */
export type AutofillColumn = Readonly<{
  colIndex: number;
  kind: AutofillColumnKind;
  samples: readonly (AutofillSampleValue | undefined)[];
  /** Formatér en projiceret prøve til ghost-/råtekst. `null` = værdien kan ikke repræsenteres i feltet. */
  format: (value: AutofillSampleValue) => AutofillSuggestion | null;
  /**
   * Den koblede kolonne i et måned/år-par (måned peger på året, året peger på måneden).
   *
   * Koblingen er nødvendig, ikke kosmetisk: en årskolonne alene ser rækken `2025, 2025, 2025` og ville
   * foreslå 2025 i det uendelige, netop hvor måneden wrapper fra december til januar. Sammen udgør de to
   * kolonner ÉN månedsserie, og årsskiftet falder ud af den af sig selv.
   */
  linkedColIndex?: number;
}>;

/**
 * Tabellens autofill-model for én render.
 *
 * `rowIds` er de VISTE rækker i den orden, brugeren ser dem (committede i sorteret orden efterfulgt af
 * placeholder-rækkerne) – ikke aggregatets indsættelsesorden. Mønstret skal følge det, brugeren ser.
 */
export type AutofillSuggestModel = Readonly<{
  rowIds: readonly string[];
  columns: readonly AutofillColumn[];
}>;

/**
 * Den tomme model: ingen rækker, ingen kolonner, ingen forslag.
 *
 * Findes for de tabeller, hvor autofill er et TILVALG pr. kaldssted – løntabellen renderes både på
 * Årsløn og under hvert af EO's ansættelsesforhold, og kun EO's udgave har funktionen slået til.
 * Alternativet – at udelade provideren i den ene gren – ville betyde to renderveje for samme tabel.
 */
export const EMPTY_AUTOFILL_SUGGEST_MODEL: AutofillSuggestModel = Object.freeze({
  rowIds: Object.freeze([]),
  columns: Object.freeze([]),
});

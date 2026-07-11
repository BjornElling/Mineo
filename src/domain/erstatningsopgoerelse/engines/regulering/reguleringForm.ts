import type { ISODateString } from '../../../../types/branded';
import type { IsoRange } from '../../helpers/indtaegtPerioder';
import type { TafBeregningsenhed } from '../../helpers/tafBeregningsenhed';
import type { KRLSatstabelId } from '../../../../data/krlRates';
import type { OffentligLoenSelection } from '../../helpers/offentligLoenSelection';
import type { LoenudviklingSource } from '../../helpers/angivetLoenHelpers';
import type { LoenudviklingBeregningsgrundlag } from '../../../../schemas/formSchemas';
import type { ReguleringForloeb } from '../reguleringForloeb';

// =============================================================================
// R1 — Reguleringsform som selvindeholdt strategi-modul.
//
// Kontrakten samler de tre steder en reguleringsform tidligere var *defineret* —
// konsolidering (resolveReguleringsStrategi-grenen), segment-byggeri
// (buildLoenudviklingFrom*) og dæknings-interval (resolveKildeReguleringsIntervalIso) —
// i ét modul pr. form. Dispatch sker ét sted (FORM_REGISTRY, keyet på enum-værdien),
// så en ændring i en eksisterende form rører dens modul frem for parallelle grene i
// motor/coverage. Feature-fladen er låst: registeret er et statisk, exhaustivt register
// over de eksisterende former, ikke et udvidelsespunkt (jf. AGENTS.md Konvergens og
// greenfield-reviewets kandidat #23).
// =============================================================================

export type LoenudviklingStrategi =
  | 'ingen'
  | 'statistik'
  | 'overenskomst'
  | 'manual'
  | 'manualProcentsats'
  | 'krl'
  | 'klLoenaftaler';

export type LoenreguleringsSegment = Readonly<IsoRange & { deltaPct: number }>;

export type LoenudviklingAf = LoenudviklingSource;
export type LoenudviklingManualRow = NonNullable<LoenudviklingAf['loenudviklingManuelTableData']>[number];
export type LoenudviklingManualProcentsatsRow = NonNullable<LoenudviklingAf['loenudviklingManuelProcentsatsTableData']>[number];

export type KonsolideretLoenudvikling =
  | Readonly<{
    strategi: 'statistik';
    label: string;
    reguleringsdato: ISODateString | undefined;
    statistikModel: string;
    tafRanges: readonly IsoRange[];
  }>
  | Readonly<{
    strategi: 'overenskomst';
    label: string;
    reguleringsdato: ISODateString | undefined;
    overenskomstId: string;
    loenPaaHelligdage: string;
    feriePct: number;
    fritvalgPct: number;
    shSoPct: number;
    pensionPct: number;
    tafBeregningsenhed: TafBeregningsenhed;
    harAnciennitetstillaegEfterSkadedatoen: boolean;
    anciennitetstillaegDato: ISODateString | undefined;
    anciennitetstillaegSatsAngivesPer: 'Time' | 'Måned';
    anciennitetstillaegSatsValue: number | undefined;
    offentligLoenEkstraGrundloen: number;
    offentlig: OffentligLoenSelection | null;
    tafRanges: readonly IsoRange[];
  }>
  | Readonly<{
    strategi: 'manual';
    label: string;
    reguleringsdato: ISODateString | undefined;
    loenPaaHelligdage: string;
    feriePct: number;
    manualRows: readonly LoenudviklingManualRow[];
    tafRanges: readonly IsoRange[];
  }>
  | Readonly<{
    strategi: 'manualProcentsats';
    label: string;
    reguleringsdato: ISODateString | undefined;
    manualProcentsatsRows: readonly LoenudviklingManualProcentsatsRow[];
    tafRanges: readonly IsoRange[];
  }>
  | Readonly<{
    strategi: 'krl';
    label: string;
    reguleringsdato: ISODateString | undefined;
    krlSatstabelId: KRLSatstabelId;
    tafRanges: readonly IsoRange[];
  }>
  | Readonly<{
    // KL-lønaftaler: enkelt periodesatsserie (ingen delserie-id, modsat KRL).
    strategi: 'klLoenaftaler';
    label: string;
    reguleringsdato: ISODateString | undefined;
    tafRanges: readonly IsoRange[];
  }>;

export type ResolvedStrategi = Readonly<{
  strategi: LoenudviklingStrategi;
  label: string;
  konsolideret: KonsolideretLoenudvikling | null;
}>;

/**
 * De fælles, form-agnostiske værdier motorens orkestrator udregner én gang, før den
 * dispatcher til formens `konsolider`. Formen tilføjer sin egen uniformitetskontrol og
 * bygger sin `KonsolideretLoenudvikling`-variant ud fra disse.
 */
export type FormKonsoliderContext = Readonly<{
  active: readonly LoenudviklingAf[];
  angivetLoen: boolean;
  anvendtReguleringsdato: ISODateString | undefined;
  tafRanges: readonly IsoRange[];
  tafBeregningsenhed: TafBeregningsenhed;
  kraeverFeriePctVedBeregningsperiode: boolean;
  activeMedSynligeSatserOgLoenoplysninger: readonly LoenudviklingAf[];
}>;

/**
 * Kildens reguleringsdato-interval i ISO. `fraIso` er kildens *reelle, tidligste* registrerede
 * satsdato — uafhængigt af TAF-perioden — og `tilIso` kildens seneste dækkede dato. De manuelle
 * modeller har intet kilde-interval og returnerer `undefined` (håndteres af kaldstederne).
 */
export type KildeReguleringsInterval = Readonly<{
  fraIso?: ISODateString;
  tilIso?: ISODateString;
}>;

/**
 * Formens beregnings-resultat: de relative deltaPct-segmenter TAF-beregningen bruger, og — for de
 * former der bærer en tidsserie (R2) — det autoritative visnings-`forloeb`. Begge udspringer af
 * SAMME kilde-entries i ét kald, så motoren ikke dispatcher formen igen for at re-bygge forløbet
 * (afløser den tidligere parallelle `switch(strategi)`-IIFE i orkestratoren). Former uden
 * migreret forløb (overenskomst/manuel/ASL) udelader `forloeb` (undefined).
 */
export type ReguleringResultat = Readonly<{
  segmenter: ReadonlyArray<LoenreguleringsSegment>;
  forloeb?: ReguleringForloeb;
}>;

/**
 * Selvindeholdt definition af én reguleringsform. Alle metoder er obligatoriske, så registeret
 * er exhaustivt: det er umuligt at glemme et concern for en form, fordi kontrakten kræver dem alle.
 */
export interface ReguleringForm {
  readonly id: LoenudviklingBeregningsgrundlag;
  readonly strategi: LoenudviklingStrategi;
  /** Trin 1: uniformitetskontrol + byg formens `KonsolideretLoenudvikling`. */
  konsolider(ctx: FormKonsoliderContext): ResolvedStrategi;
  /** Trin 2: byg de relative deltaPct-segmenter til TAF-beregning + det autoritative visnings-forløb (R2). */
  byggResultat(konsolideret: KonsolideretLoenudvikling): ReguleringResultat;
  /** Kildens dæknings-interval (fodrer validator + row-gate via resolveKildeReguleringsIntervalIso). */
  coverageInterval(af: LoenudviklingAf): KildeReguleringsInterval | undefined;
}

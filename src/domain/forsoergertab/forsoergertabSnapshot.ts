import { maxISO, minISO } from '../../utils/isoDateHelpers';
import type {
  FaellesAarsloenValues,
  ForsoergertabValues,
  Koen,
  StamdataValues,
} from '../../schemas/formSchemas';
import type { Skadestype } from '../../schemas/formSchemas/enumSchemas';
import { dateRanges_forsoergertab } from '../../config/dateRanges';
import { coerceToISODateString, type ISODateString } from '../../types/branded';
import { computeForsoergertabCalculation } from './forsoergertabCalculation';
import { SKAERING_2015_03_01 } from '../erhvervsevnetab/eetSkaeringsdatoer';
import { reportSystemIssue } from '../../utils/systemIssueReporter';
import { asError } from '../../utils/typeGuards';
import type { ForsoergertabCalculationResult } from './forsoergertabTypes';
import { allowDocumentDownload, invalidInputReason, missingInputReason, type DocumentDownloadGateResult, type DocumentDownloadGateReason } from '../../document/layout/documentGateTypes';
import { resolveStamdataDateOrder } from '../stamdata/stamdataDateOrder';
import { buildFieldIssueSet, type FieldIssueSet } from '../../inputCore/inputIssue';
import { buildForsoergertabFieldIssues, type ForsoergertabFieldLabelResolver } from './forsoergertabIssueFields';
import { FORSOERGERTAB_MISSING_INPUT_ISSUE_IDS } from './forsoergertabAslYdelser';
import { ASL_AARSLOEN_MAX_NOTICE } from '../aslEalAarsloen/aslAarsloenMaxNotice';

/**
 * En rød feltfejls BESKED, som snapshottet skal vise ved feltet. Snapshottet bruger kun beskeden – aldrig
 * severity/source/gate-flag – så formen er bevidst minimal og domænelokal (ingen afhængighed til en global
 * fejlmodel). Kalderen leverer den fra reader-projektionens issues (§1.8).
 */
type FieldErrorMessage = Readonly<{ message: string }> | undefined;

type ForsoergertabFieldErrors = Readonly<{
  forsoergertab: Partial<Record<keyof ForsoergertabValues, FieldErrorMessage>>;
  faellesAarsloen: Partial<Record<keyof FaellesAarsloenValues, FieldErrorMessage>>;
  stamdata: Partial<Record<keyof StamdataValues, FieldErrorMessage>>;
}>;

export type ForsoergertabSnapshotInput = Readonly<{
  values: ForsoergertabValues;
  faellesAarsloen: FaellesAarsloenValues;
  stamdata: StamdataValues | null;
  fieldErrors: ForsoergertabFieldErrors;
  /**
   * Feltets brugervendte navn i den aktuelle kontekst (BB-117 + §3.2a) – i praksis `InputReader.labelOf`.
   *
   * PÅKRÆVET, fordi et felt kan have en KONTEKSTUEL label: `stamdata.skadedato` hedder «Anmeldelsesdato»
   * ved en erhvervssygdom. Snapshottet slår navnet op frem for at bygge feltrefs uden kontekst.
   */
  resolveFieldLabel?: ForsoergertabFieldLabelResolver;
}>;

/**
 * De to dependency-grupper, forsørgertabsberegningen består af (§1.10). Hver gruppe navngiver PRÆCIS de
 * felter, dens motor faktisk læser – så en rød feltfejl kun blokerer den motor, der er afhængig af feltet.
 *
 * Dette er BEREGNINGS-dependencies, ikke visningsgates. `canShowAsl` kræver fx også skadelidtes
 * fødselsdato, selv om ASL-motoren ikke bruger den; den slags præsentationskrav hører ikke til her.
 */
/**
 * EAL-motorens afhængigheder. `aslAarsloen` indgår BETINGET: EAL bruger den kun som fallback, når
 * `ealAarsloen` er tom (`eetEalCalculation.ts:184-193`).
 *
 * Fallback-invarianten (§1.10): en rød PRIMÆRværdi må aldrig omfortolkes som tomhed, men en rød
 * FALLBACK-værdi er kun en afhængighed, hvis fallbacken faktisk nås. Har brugeren udfyldt en gyldig
 * EAL-årsløn, rører en rød ASL-årsløn derfor ikke EAL-delen – den blokerer kun ASL-delen.
 */
const EAL_ENGINE_DEPENDENCIES = (
  fieldErrors: ForsoergertabFieldErrors,
  usesAslAarsloenFallback: boolean
): readonly FieldErrorMessage[] => [
  fieldErrors.forsoergertab.beregningsdato,
  ...(usesAslAarsloenFallback ? [fieldErrors.faellesAarsloen.aslAarsloen] : []),
  fieldErrors.faellesAarsloen.ealAarsloen,
  fieldErrors.stamdata.skadedato,
  fieldErrors.stamdata.skadelidteFodselsdato,
];

const ASL_ENGINE_DEPENDENCIES = (fieldErrors: ForsoergertabFieldErrors): readonly FieldErrorMessage[] => [
  fieldErrors.forsoergertab.beregningsdato,
  fieldErrors.forsoergertab.virkningsdato,
  fieldErrors.forsoergertab.efterladteFodselsdato,
  fieldErrors.forsoergertab.koen,
  fieldErrors.forsoergertab.tilkendtForPeriodeAar,
  fieldErrors.faellesAarsloen.aslAarsloen,
  fieldErrors.stamdata.skadedato,
];

const hasAnyDependencyError = (dependencies: readonly FieldErrorMessage[]): boolean =>
  dependencies.some((fieldError) => fieldError !== undefined);

/**
 * Når nås EAL-motorens ASL-årsløns-fallback? Spejler `resolveAarsloen` i `eetEalCalculation.ts:184-193`:
 * fallbacken nås, netop når EAL-årslønnen ikke er et finit tal > 0. Holdes her som ét udtryk, så gaten
 * ikke kan drifte fra den motor, den gater.
 */
const usesAslAarsloenFallback = (ealAarsloen: FaellesAarsloenValues['ealAarsloen']): boolean => {
  const value = ealAarsloen?.value;
  return !(typeof value === 'number' && Number.isFinite(value) && value > 0);
};

// Teksten ejes af det DELTE årslønsfelt (BB-124), ikke af denne flade – en kopi her ville genindføre
// præcis den drift, konsolideringen lukkede.
const EAL_AARSLOEN_ASL_MAX_NOTICE = ASL_AARSLOEN_MAX_NOTICE;

const EAL_AARSLOEN_ASL_MAX_ISSUE_IDS = ['warn-eal-aarsloen-is-max', 'warn-asl-aarsloen-is-max'] as const;

const createRuntimeExceptionCalculation = (error: unknown): ForsoergertabCalculationResult => {
  const normalizedError = asError(error);
  reportSystemIssue({
    code: 'forsoergertab_snapshot:runtime_exception',
    area: 'calculation',
    context: 'forsoergertabSnapshot.computeForsoergertabSnapshot',
    userMessage: 'Uventet runtimefejl i forsørgertabsberegning',
    developerMessage: normalizedError.message,
    error: normalizedError,
    diagnostics: {
      errorName: normalizedError.name,
    },
  });

  return {
    issues: [{
      id: 'runtime-exception',
      severity: 'error',
      message: 'Beregningen kan ikke gennemføres på grund af en intern beregningsfejl.',
    }],
    ealComputation: null,
    aslComputation: null,
    foersoergertabEalMinSatsOre: null,
    foersoergertabForhoejtetTilMin: false,
    result: null,
  };
};

export type ForsoergertabPdfProjection = Readonly<{
  grundlaeggende: Readonly<{
    beregningsdato: ISODateString | undefined;
    skadelidteFodselsdato: ISODateString | undefined;
    /**
     * Sagens dato + dens skadestype-afledte navn (BB-122/BB-121).
     *
     * Begge kommer HERFRA og ikke fra dokumentets brevhoved-stamdata: brevhovedet projiceres kun, når
     * brugeren har slået det til, mens dokumentets «Grundlæggende oplysninger» altid skal kunne trykke
     * sagens egen dato.
     */
    skadedato: ISODateString | undefined;
    skadestype: Skadestype | undefined;
    efterladteFodselsdato: ISODateString | undefined;
    koen: Koen | undefined;
    visKoenValg: boolean;
    aslAarsloen: number | undefined;
    ealAarsloen: number | undefined;
    virkningsdato: ISODateString | undefined;
    tilkendtForPeriodeAar: number | undefined;
  }>;
  result: ForsoergertabCalculationResult['result'];
  ealComputation: ForsoergertabCalculationResult['ealComputation'];
  aslComputation: ForsoergertabCalculationResult['aslComputation'];
  foersoergertabEalMinSatsOre: ForsoergertabCalculationResult['foersoergertabEalMinSatsOre'];
  foersoergertabForhoejtetTilMin: boolean;
}>;

export type ForsoergertabSnapshot = Readonly<{
  calculation: ForsoergertabCalculationResult;
  visKoenValg: boolean;
  inputBounds: Readonly<{
    skadedatoMin: ISODateString;
    beregningsdatoMin: ISODateString;
    virkningsdatoMax: ISODateString;
  }>;
  /**
   * Kønsfeltets synlighed. Køn kræves kun ved beregning før 1.3.2015, men når kravet er udløst og feltet er
   * tomt, SKAL feltet også kunne ses – ellers kunne brugeren ikke rette den mangel, der blokerer.
   *
   * Dette er den ENESTE felttilstand, snapshottet eksponerer. Tidligere bar det ti `FieldUiState`s med
   * `hasError` + `helperText` ved siden af den fælles issue-model; kun kønsfeltet blev læst, og ingen
   * `helperText` nåede nogen komponent – felterne viser deres egne reader-issues (§1.8). De ni øvrige er
   * derfor en INTERN afledning nu, brugt til gates, ikke en offentlig parallel felt-model.
   */
  koenFieldHasError: boolean;
  /**
   * Ikke-blokerende oplysning om, at den faktiske EAL-årsløn bør indtastes, når årslønnen efter ASL svarer
   * til maksimum (beslutning 3). `undefined` når den ikke er relevant.
   *
   * Oplysningen fandtes før som `fieldUi.ealAarsloen.helperText`, men INTET læste den, så beskeden nåede
   * aldrig brugeren. Den er bevidst en ren oplysning: der findes den sjældne legitime situation, hvor den
   * faktiske EAL-årsløn ER præcis ASL-maksimum, og en blokering ville da forhindre en korrekt beregning.
   */
  ealAarsloenNotice: string | undefined;
  /**
   * Motorens beregningsafvisende issues som ægte `FieldIssue`s med feltadresse (BB-117). Feltet slår sit
   * eget issue op på sin adresse og viser det som `crossFieldIssue` – samme vej som enhver anden
   * kryds-felt-regel. Uden denne kanal var beskeden død kode, og en afvist ASL-beregning forsvandt tavst.
   */
  domainFieldIssues: FieldIssueSet;
  canShowEal: boolean;
  canShowAsl: boolean;
  canShowResult: boolean;
  pdfGate: DocumentDownloadGateResult;
  pdfProjection: ForsoergertabPdfProjection;
}>;

const getIssueMessage = (
  issues: ForsoergertabCalculationResult['issues'],
  ids: readonly string[]
): string | undefined => {
  const message = issues.find((issue) => ids.includes(issue.id))?.message;
  return message && message.trim() !== '' ? message : undefined;
};

const hasIssue = (
  issues: ForsoergertabCalculationResult['issues'],
  ids: readonly string[]
): boolean => {
  return issues.some((issue) => ids.includes(issue.id));
};

/**
 * Ingen af forsørgertab-blokeringerne citeres ordret – begge beskeder er gate-interne. De skelnes til
 * gengæld på KLASSE efter brugerkravet 2026-07-30: manglende input til en PDF-klar del er `missing-input`
 * ("Indtastning mangler"), mens et rødt nødvendigt felt er `invalid-input` ("Fejl i indtastning"). `message`
 * bevares som den interne forklaring, som koder og tests skelner på.
 */
const createMissingInputBlockingReason = (code: string, message: string): DocumentDownloadGateReason =>
  missingInputReason(`forsoergertab:${code}`, message);

const createInvalidInputBlockingReason = (code: string, message: string): DocumentDownloadGateReason =>
  invalidInputReason(`forsoergertab:${code}`, message);

export const computeForsoergertabSnapshot = (input: ForsoergertabSnapshotInput): ForsoergertabSnapshot => {
  const { values, faellesAarsloen, stamdata, fieldErrors, resolveFieldLabel } = input;
  const stamdataDateOrderMessage = stamdata === null
    ? undefined
    : resolveStamdataDateOrder(stamdata).issues[0]?.message;
  const skadedatoMin = coerceToISODateString(stamdata?.skadedato) ?? dateRanges_forsoergertab.virkningsdato.fallbackMin;
  const beregningsdatoMin = (() => {
    const virkningsdato = coerceToISODateString(values.virkningsdato);
    return virkningsdato ? maxISO(skadedatoMin, virkningsdato) : skadedatoMin;
  })();
  const virkningsdatoMax = (() => {
    const beregningsdato = coerceToISODateString(values.beregningsdato);
    const maxDato = dateRanges_forsoergertab.virkningsdato.max;
    return beregningsdato ? minISO(maxDato, beregningsdato) : maxDato;
  })();

  // Dependency-gaten afgøres FØR motoren, pr. gruppe (§1.10/§3.9): en rød afhængighed blokerer sin egen
  // motor og BEVARER den anden. En stamdata-datoordensfejl er en fælles afhængighed for begge grupper.
  const hasSharedDateOrderError = stamdataDateOrderMessage !== undefined;
  const ealBlocked = hasSharedDateOrderError || hasAnyDependencyError(
    EAL_ENGINE_DEPENDENCIES(fieldErrors, usesAslAarsloenFallback(faellesAarsloen.ealAarsloen))
  );
  const aslBlocked = hasSharedDateOrderError || hasAnyDependencyError(ASL_ENGINE_DEPENDENCIES(fieldErrors));

  const calculation = (() => {
    try {
      return computeForsoergertabCalculation({
        skadedato: coerceToISODateString(stamdata?.skadedato),
        skadestype: stamdata?.skadestype,
        skadelidteFodselsdato: coerceToISODateString(stamdata?.skadelidteFodselsdato),
        efterladteFodselsdato: coerceToISODateString(values.efterladteFodselsdato),
        beregningsdato: coerceToISODateString(values.beregningsdato),
        virkningsdato: coerceToISODateString(values.virkningsdato),
        koen: values.koen,
        tilkendtForPeriodeAar: values.tilkendtForPeriodeAar,
        aslAarsloen: faellesAarsloen.aslAarsloen,
        ealAarsloen: faellesAarsloen.ealAarsloen,
        ealBlocked,
        aslBlocked,
      });
    } catch (error) {
      return createRuntimeExceptionCalculation(error);
    }
  })();

  const visKoenValg = (() => {
    const beregningsdato = coerceToISODateString(values.beregningsdato);
    return beregningsdato !== undefined && beregningsdato < SKAERING_2015_03_01;
  })();

  const hasEalAarsloenAslMaxIssue = hasIssue(calculation.issues, EAL_AARSLOEN_ASL_MAX_ISSUE_IDS);
  const ealAarsloenBlockingIssue = getIssueMessage(calculation.issues, ['eal-aarsloen-zero']);
  const ealAarsloenHelperIssue =
    ealAarsloenBlockingIssue ?? (hasEalAarsloenAslMaxIssue ? EAL_AARSLOEN_ASL_MAX_NOTICE : undefined);

  const helperIssues = {
    efterladteFodselsdato: getIssueMessage(calculation.issues, ['forsoergertab-alder-unresolved', 'forsoergertab-alder-missing']),
    beregningsdato: getIssueMessage(calculation.issues, [
      'aarsloen-max-missing-beregningsaar',
      'beregningsdato-before-virkningsdato',
      'kapitaliseringsbekendtgoerelse-missing',
      'folkepensionsalder-unresolved',
      'forsoergertab-tabel-missing',
      'forsoergertab-tabel-rows-missing',
      'forsoergertab-faktor-unresolved',
      'runtime-exception',
    ]),
    beregningsdatoForEal: getIssueMessage(calculation.issues, [
      'aarsloen-max-missing-beregningsaar',
      'kapitaliseringsbekendtgoerelse-missing',
      'folkepensionsalder-unresolved',
      'forsoergertab-tabel-missing',
      'forsoergertab-tabel-rows-missing',
      'forsoergertab-faktor-unresolved',
    ]),
    virkningsdato: getIssueMessage(calculation.issues, ['beregningsdato-before-virkningsdato']),
    koen: getIssueMessage(calculation.issues, ['missing-koen']),
    tilkendtForPeriodeAar: getIssueMessage(calculation.issues, ['tilkendt-for-periode-invalid']),
    aslAarsloen: getIssueMessage(calculation.issues, ['asl-aarsloen-zero', 'asl-aarsloen-over-max']),
    ealAarsloen: ealAarsloenHelperIssue,
    skadedato: stamdataDateOrderMessage
      ?? getIssueMessage(calculation.issues, ['skadedato-missing', 'aarsloen-max-missing-skadesaar']),
    skadelidteFodselsdato: stamdataDateOrderMessage,
  };

  /**
   * Hvilke felter har en blokerende fejl? Rene BOOLEANS, ikke felttilstande.
   *
   * De samme afledninger bar tidligere også en `helperText` pr. felt, som ingen komponent læste – felterne
   * viser deres egne reader-issues (§1.8). Beskederne blev altså formateret ved hver beregning og kastet
   * væk, mens de samtidig lignede en aktiv præsentationskanal ved siden af den fælles issue-model.
   *
   * Den enkelte feltbesked er ikke tabt: `helperIssues` ovenfor er stadig kilden til `blocked`-siden af de
   * dependency-specifikke gates nedenfor, og ASL-maksimum-oplysningen – den ene besked, der ikke havde nogen
   * anden vej til brugeren – eksponeres nu som `ealAarsloenNotice`.
   */
  const hasError = (
    fieldError: FieldErrorMessage,
    helperIssue: string | undefined
  ): boolean => Boolean(fieldError?.message || helperIssue);

  const fieldUi = {
    beregningsdato: { hasError: hasError(fieldErrors.forsoergertab.beregningsdato, helperIssues.beregningsdato) },
    beregningsdatoForEal: { hasError: hasError(fieldErrors.forsoergertab.beregningsdato, helperIssues.beregningsdatoForEal) },
    efterladteFodselsdato: { hasError: hasError(fieldErrors.forsoergertab.efterladteFodselsdato, helperIssues.efterladteFodselsdato) },
    virkningsdato: { hasError: hasError(fieldErrors.forsoergertab.virkningsdato, helperIssues.virkningsdato) },
    koen: { hasError: hasError(fieldErrors.forsoergertab.koen, helperIssues.koen) },
    tilkendtForPeriodeAar: { hasError: hasError(fieldErrors.forsoergertab.tilkendtForPeriodeAar, helperIssues.tilkendtForPeriodeAar) },
    aslAarsloen: { hasError: hasError(fieldErrors.faellesAarsloen.aslAarsloen, helperIssues.aslAarsloen) },
    ealAarsloen: { hasError: hasError(fieldErrors.faellesAarsloen.ealAarsloen, helperIssues.ealAarsloen) },
    skadedato: { hasError: hasError(fieldErrors.stamdata.skadedato, helperIssues.skadedato) },
    skadelidteFodselsdato: { hasError: hasError(fieldErrors.stamdata.skadelidteFodselsdato, helperIssues.skadelidteFodselsdato) },
  } as const;

  const hasBlockingEalAarsloenError =
    Boolean(fieldErrors.faellesAarsloen.ealAarsloen?.message) || Boolean(ealAarsloenBlockingIssue);

  // Beslutningsnote: Max-årslønsfejlen på EAL-årslønnen er bevidst ikke download- eller
  // beregningsblokerende. Feltet skal markeres rødt, fordi ASL-maksimum oftest betyder, at den
  // faktiske EAL-årsløn mangler. Forsørgertab har dog den sjældne legitime situation, at den
  // faktiske EAL-årsløn faktisk er præcis ASL-maksimum i skadesåret. Hvis denne UI-fejl blokerede
  // PDF eller beregning, ville brugeren ikke kunne færdiggøre en korrekt forsørgertabsberegning i
  // netop de sager. Derfor blokerer kun egentlige commit-/beregningsfejl her; denne konkrete
  // max-årslønsmarkering er en auditabel opmærksomhedsfejl, ikke en stop-fejl.
  const canShowEal =
    Boolean(values.beregningsdato) &&
    !fieldUi.skadelidteFodselsdato.hasError &&
    !fieldUi.beregningsdatoForEal.hasError &&
    !fieldUi.skadedato.hasError &&
    !hasBlockingEalAarsloenError &&
    calculation.ealComputation !== null;

  const canShowAsl =
    Boolean(stamdata?.skadelidteFodselsdato) &&
    Boolean(values.efterladteFodselsdato) &&
    Boolean(values.beregningsdato) &&
    !fieldUi.efterladteFodselsdato.hasError &&
    !fieldUi.beregningsdato.hasError &&
    !fieldUi.skadedato.hasError &&
    Boolean(faellesAarsloen.aslAarsloen) &&
    Boolean(values.virkningsdato) &&
    values.tilkendtForPeriodeAar !== undefined &&
    !fieldUi.aslAarsloen.hasError &&
    !fieldUi.virkningsdato.hasError &&
    !fieldUi.tilkendtForPeriodeAar.hasError &&
    !fieldUi.koen.hasError &&
    calculation.aslComputation !== null;

  const canShowResult = canShowEal && canShowAsl && calculation.result !== null;
  const hasDescriptorFieldError = [
    fieldErrors.forsoergertab.beregningsdato,
    fieldErrors.forsoergertab.virkningsdato,
    fieldErrors.forsoergertab.efterladteFodselsdato,
    fieldErrors.forsoergertab.koen,
    fieldErrors.forsoergertab.tilkendtForPeriodeAar,
    fieldErrors.faellesAarsloen.aslAarsloen,
    fieldErrors.faellesAarsloen.ealAarsloen,
    fieldErrors.stamdata.skadedato,
    fieldErrors.stamdata.skadelidteFodselsdato,
  ].some((error) => Boolean(error?.message));
  /**
   * Fail-closed: ETHVERT error-issue fra motoren blokerer downloaden – ikke kun de fem, en allowlist
   * tidligere navngav (BB-117).
   *
   * Allowlisten var fail-OPEN, og det er den fejlklasse, fundet handlede om: `forsoergertab-alder-missing`
   * og fem søskende (`forsoergertab-tabel-missing`, `-tabel-rows-missing`, `-faktor-unresolved`,
   * `kapitaliseringsbekendtgoerelse-missing`, `folkepensionsalder-unresolved`) stod ikke på listen. Hver af
   * dem nuller hele ASL-beregningen, men gaten så dem ikke, så dokumentet kunne hentes uden den halvdel,
   * brugeren havde udfyldt. De tre øvrige flader er allerede fail-closed på præcis denne måde
   * (`eetSnapshot.ts`: `issues.some(i => i.severity === 'error')`); Forsørgertab var outlier'en.
   *
   * Retningen er nu den modsatte af en allowlist: et NYT issue i motoren blokerer som udgangspunkt, og skal
   * aktivt undtages for ikke at gøre det.
   *
   * **Undtagelsen er «feltet er ikke udfyldt endnu».** Motoren mærker ALLE sine issues `severity: 'error'`
   * – også de rene mangler – så severity alene ville spærre den almindeligste gyldige sag på fladen: en
   * tom ASL-sektion, hvor brugeren bevidst kun regner EAL-delen. Manglerne håndteres af
   * `no-benefit-input`/`partial-asl-input`/`missing-common-input` nedenfor, som siger det rigtige om dem.
   * Sættet ejes af motoren, så gaten ikke gentager dens ID-liste.
   */
  const hasBlockingDomainIssue = calculation.issues.some(
    (issue) => issue.severity === 'error' && !FORSOERGERTAB_MISSING_INPUT_ISSUE_IDS.has(issue.id)
  );
  /**
   * Blokeringens KLASSE er en anden beslutning end blokeringen selv (brugerkravet 2026-07-30).
   *
   * Et issue om noget, brugeren ikke har udfyldt endnu, er «Indtastning mangler» – ikke «Fejl i
   * indtastning». Sondringen bæres af en eksplicit liste af manglende-input-id'er frem for af
   * severity: den fail-closed regel ovenfor skal blive ved med at blokere DEM ALLE, mens kun de
   * issues, der beskriver noget FORKERT, må give det strengere tooltip. En tom sag ville ellers
   * melde «Fejl i indtastning», før brugeren havde skrevet noget som helst.
   */
  const hasDomainInputError = hasIssue(calculation.issues, [
    'asl-aarsloen-zero',
    'asl-aarsloen-over-max',
    'eal-aarsloen-zero',
    'aarsloen-zero',
    'tilkendt-for-periode-invalid',
    'beregningsdato-before-virkningsdato',
    'forsoergertab-alder-missing',
    'forsoergertab-faktor-unresolved',
  ]);
  const hasDownloadBlockingFieldError =
    hasDescriptorFieldError || hasSharedDateOrderError || hasDomainInputError;
  const hasAnyAslInput = Boolean(
    faellesAarsloen.aslAarsloen ||
    values.virkningsdato ||
    values.tilkendtForPeriodeAar !== undefined ||
    values.efterladteFodselsdato ||
    values.koen
  );
  const hasAnyEalInput = Boolean(faellesAarsloen.ealAarsloen);
  const hasCompleteAslInput = Boolean(
    faellesAarsloen.aslAarsloen &&
    values.virkningsdato &&
    values.tilkendtForPeriodeAar !== undefined &&
    values.efterladteFodselsdato &&
    (!visKoenValg || values.koen)
  );
  const hasMissingCommonInput =
    !values.beregningsdato || !stamdata?.skadedato || !stamdata?.skadelidteFodselsdato;
  const pdfGate = (() => {
    const reasons: DocumentDownloadGateReason[] = [];
    if (hasDownloadBlockingFieldError) {
      reasons.push(createInvalidInputBlockingReason('blocking-input-error', 'Et eller flere nødvendige felter har blokerende fejl.'));
    } else if (hasBlockingDomainIssue) {
      // Fail-closed (BB-117): et beregningsafvisende issue, som IKKE er en af de konkrete inputfejl
      // ovenfor, blokerer stadig – blot som «Indtastning mangler». Uden denne gren kunne fx en manglende
      // kapitaliseringsbekendtgørelse nulle hele ASL-halvdelen, mens dokumentet blev hentet uden den.
      reasons.push(createMissingInputBlockingReason('unresolved-calculation', 'Beregningen kunne ikke gennemføres for den aktuelle sag.'));
    }
    if (!hasAnyAslInput && !hasAnyEalInput) {
      reasons.push(createMissingInputBlockingReason('no-benefit-input', 'Der er ikke indtastet oplysninger under ASL- eller EAL-ydelse.'));
    }
    if (hasAnyAslInput && !hasCompleteAslInput) {
      reasons.push(createMissingInputBlockingReason('partial-asl-input', 'Alle felter under ASL-ydelse skal udfyldes, når ASL-ydelsen er påbegyndt.'));
    }
    /**
     * M-25: gaten skal spørge «findes DET, brugeren bad om?», ikke «findes der noget?».
     *
     * En komplet udfyldt ASL-halvdel, som motoren har AFVIST, må ikke kunne trykkes som et dokument, der
     * kun indeholder EAL-kravet – det ser ud præcis som en sag, hvor brugeren med vilje kun regnede
     * EAL-delen, og kravet fremstår da mange gange for stort (BB-117). `partial-asl-input` ovenfor dækker
     * kun TOMME felter; denne gren dækker de udfyldte, der ikke blev til noget.
     *
     * `hasMissingCommonInput` holdes uden for: mangler beregningsdatoen, er ASL-delen ikke «afvist» men
     * blot ikke forsøgt, og `missing-common-input` siger allerede det rigtige. Uden det forbehold ville en
     * tom sag melde «Fejl i indtastning», før brugeren havde skrevet noget.
     */
    if (!hasMissingCommonInput) {
      if (hasCompleteAslInput && !canShowAsl) {
        reasons.push(createInvalidInputBlockingReason('asl-input-not-computed', 'ASL-ydelsen er udfyldt, men kunne ikke beregnes.'));
      }
      if (hasAnyEalInput && !canShowEal) {
        reasons.push(createInvalidInputBlockingReason('eal-input-not-computed', 'EAL-årslønnen er udfyldt, men EAL-kravet kunne ikke beregnes.'));
      }
    }
    if (hasMissingCommonInput) {
      reasons.push(createMissingInputBlockingReason('missing-common-input', 'Beregningsdato og skadelidtes fødselsdato skal være udfyldt.'));
    }
    if (!canShowEal && !canShowAsl) {
      reasons.push(createMissingInputBlockingReason('no-pdf-projection', 'Der er ikke beregnet en PDF-klar EAL- eller ASL-del.'));
    }
    if (reasons.length === 0) {
      return allowDocumentDownload();
    }
    return { canDownload: false, reasons };
  })();

  return {
    calculation,
    visKoenValg,
    inputBounds: {
      skadedatoMin,
      beregningsdatoMin,
      virkningsdatoMax,
    },
    koenFieldHasError: fieldUi.koen.hasError,
    // Kun ASL-maks-oplysningen; en egentlig blokerende EAL-fejl vises af feltet selv som et rødt issue.
    ealAarsloenNotice: hasEalAarsloenAslMaxIssue && ealAarsloenBlockingIssue === undefined
      ? EAL_AARSLOEN_ASL_MAX_NOTICE
      : undefined,
    domainFieldIssues: buildFieldIssueSet(buildForsoergertabFieldIssues(calculation.issues, resolveFieldLabel)),
    canShowEal,
    canShowAsl,
    canShowResult,
    pdfGate,
    pdfProjection: {
      grundlaeggende: {
        beregningsdato: coerceToISODateString(values.beregningsdato),
        skadelidteFodselsdato: coerceToISODateString(stamdata?.skadelidteFodselsdato),
        skadedato: coerceToISODateString(stamdata?.skadedato),
        skadestype: stamdata?.skadestype,
        efterladteFodselsdato: coerceToISODateString(values.efterladteFodselsdato),
        koen: values.koen,
        visKoenValg,
        aslAarsloen: faellesAarsloen.aslAarsloen?.value,
        ealAarsloen: faellesAarsloen.ealAarsloen?.value,
        virkningsdato: coerceToISODateString(values.virkningsdato),
        tilkendtForPeriodeAar: values.tilkendtForPeriodeAar,
      },
      result: canShowResult ? calculation.result : null,
      ealComputation: canShowEal ? calculation.ealComputation : null,
      aslComputation: canShowAsl ? calculation.aslComputation : null,
      foersoergertabEalMinSatsOre: calculation.foersoergertabEalMinSatsOre,
      foersoergertabForhoejtetTilMin: calculation.foersoergertabForhoejtetTilMin,
    },
  };
};

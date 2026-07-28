import { maxISO, minISO } from '../../utils/isoDateHelpers';
import type {
  FaellesAarsloenValues,
  ForsoergertabValues,
  Koen,
  StamdataValues,
} from '../../schemas/formSchemas';
import { dateRanges_forsoergertab } from '../../config/dateRanges';
import { coerceToISODateString, type ISODateString } from '../../types/branded';
import { computeForsoergertabCalculation } from './forsoergertabCalculation';
import { SKAERING_2015_03_01 } from '../erhvervsevnetab/eetSkaeringsdatoer';
import { reportSystemIssue } from '../../utils/systemIssueReporter';
import { asError } from '../../utils/typeGuards';
import type { ForsoergertabCalculationResult } from './forsoergertabTypes';
import { allowDocumentDownload, blockDocumentDownload, type DocumentDownloadGateResult, type DocumentDownloadGateReason } from '../../document/layout/documentGateTypes';
import { resolveStamdataDateOrder } from '../stamdata/stamdataDateOrder';

/**
 * En rød feltfejls BESKED, som snapshottet skal vise ved feltet. Snapshottet bruger kun beskeden — aldrig
 * severity/source/gate-flag — så formen er bevidst minimal og domænelokal (ingen afhængighed til en global
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
}>;

/**
 * De to dependency-grupper, forsørgertabsberegningen består af (§1.10). Hver gruppe navngiver PRÆCIS de
 * felter, dens motor faktisk læser — så en rød feltfejl kun blokerer den motor, der er afhængig af feltet.
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
 * EAL-årsløn, rører en rød ASL-årsløn derfor ikke EAL-delen — den blokerer kun ASL-delen.
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

const EAL_AARSLOEN_ASL_MAX_NOTICE =
  'Når årsløn efter ASL svarer til maksimum, skal den faktiske årsløn indtastes.';

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
   * tomt, SKAL feltet også kunne ses — ellers kunne brugeren ikke rette den mangel, der blokerer.
   *
   * Dette er den ENESTE felttilstand, snapshottet eksponerer. Tidligere bar det ti `FieldUiState`s med
   * `hasError` + `helperText` ved siden af den fælles issue-model; kun kønsfeltet blev læst, og ingen
   * `helperText` nåede nogen komponent — felterne viser deres egne reader-issues (§1.8). De ni øvrige er
   * derfor en INTERN afledning nu, brugt til gates, ikke en offentlig parallel felt-model (GM-F05).
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

const createDownloadBlockingReason = (code: string, message: string): DocumentDownloadGateReason => ({
  code: `forsoergertab:${code}`,
  message,
});

export const computeForsoergertabSnapshot = (input: ForsoergertabSnapshotInput): ForsoergertabSnapshot => {
  const { values, faellesAarsloen, stamdata, fieldErrors } = input;
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
    aslAarsloen: getIssueMessage(calculation.issues, ['asl-aarsloen-zero']),
    ealAarsloen: ealAarsloenHelperIssue,
    skadedato: stamdataDateOrderMessage
      ?? getIssueMessage(calculation.issues, ['skadedato-missing', 'aarsloen-max-missing-skadesaar']),
    skadelidteFodselsdato: stamdataDateOrderMessage,
  };

  /**
   * Hvilke felter har en blokerende fejl? Rene BOOLEANS, ikke felttilstande.
   *
   * De samme afledninger bar tidligere også en `helperText` pr. felt, som ingen komponent læste — felterne
   * viser deres egne reader-issues (§1.8). Beskederne blev altså formateret ved hver beregning og kastet
   * væk, mens de samtidig lignede en aktiv præsentationskanal ved siden af den fælles issue-model (GM-F05).
   *
   * Den enkelte feltbesked er ikke tabt: `helperIssues` ovenfor er stadig kilden til `blocked`-siden af de
   * dependency-specifikke gates nedenfor, og ASL-maksimum-oplysningen — den ene besked, der ikke havde nogen
   * anden vej til brugeren — eksponeres nu som `ealAarsloenNotice`.
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
  const hasDownloadBlockingFieldError =
    fieldUi.beregningsdato.hasError ||
    fieldUi.beregningsdatoForEal.hasError ||
    fieldUi.efterladteFodselsdato.hasError ||
    fieldUi.virkningsdato.hasError ||
    fieldUi.koen.hasError ||
    fieldUi.tilkendtForPeriodeAar.hasError ||
    fieldUi.aslAarsloen.hasError ||
    hasBlockingEalAarsloenError ||
    fieldUi.skadedato.hasError ||
    fieldUi.skadelidteFodselsdato.hasError;
  const pdfGate = (() => {
    const reasons: DocumentDownloadGateReason[] = [];
    if (!canShowEal && !canShowAsl) {
      reasons.push(createDownloadBlockingReason('no-pdf-projection', 'Der er ikke beregnet en PDF-klar EAL- eller ASL-del.'));
    }
    if (hasDownloadBlockingFieldError) {
      reasons.push(createDownloadBlockingReason('blocking-input-error', 'Et eller flere nødvendige felter har blokerende fejl.'));
    }
    if (reasons.length === 0) {
      return allowDocumentDownload();
    }
    const [firstReason, ...additionalReasons] = reasons;
    return {
      ...blockDocumentDownload(firstReason),
      reasons: [firstReason, ...additionalReasons],
    };
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
    canShowEal,
    canShowAsl,
    canShowResult,
    pdfGate,
    pdfProjection: {
      grundlaeggende: {
        beregningsdato: coerceToISODateString(values.beregningsdato),
        skadelidteFodselsdato: coerceToISODateString(stamdata?.skadelidteFodselsdato),
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

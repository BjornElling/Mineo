import type {
  ErhvervsevnetabComposedValues,
  FaellesAarsloenValues,
  StamdataValues,
} from '../../schemas/formSchemas';
import {
  evaluateForligsgrad,
  type ForligAnsvarsgradInput,
} from '../erstatningsopgoerelse/engines/forligsgrad';
import type { ISODateString } from '../../types/branded';
import { dedupeIssuesBySeverityAndMessage } from '../../utils/issueUtils';
import {
  aarsloenAslMax,
  erhvervsevnetabEalMax,
  reguleringssats,
} from '../../data/lovbestemteRates';
import { computeEetDifferencekravCalculation } from './eetCalculationGraph';
import { computeEetEalCalculation } from './eetEalCalculation';
import { navigationSortKey, toFieldIssue } from './eetFormatUtils';
import { computeEetKapitaliseringCalculation } from './eetKapitaliseringCalculation';
import { computeEetLoebendeYdelser } from './eetLoebendeYdelserCalculation';
import type { EetIssue } from './eetTypes';
import { reportSystemIssue } from '../../utils/systemIssueReporter';
import { asError } from '../../utils/typeGuards';
import {
  eetCanonicalOutputSchema,
  type EetCanonicalOutput,
} from './eetCanonicalOutput';
import { resolveStamdataDateOrder } from '../stamdata/stamdataDateOrder';

/**
 * Readeren leverer allerede den aktive røde feltissue. Snapshottet behøver kun dens besked for at placere den i
 * den relevante faneprojektion; den gamle reporter-model må derfor ikke krydse denne domænegrænse.
 */
type FieldIssueMessage = Readonly<{ message: string }> | undefined;

type EetInputIssues = Readonly<{
  stamdata: Partial<Record<keyof StamdataValues, FieldIssueMessage>>;
  erhvervsevnetab: Partial<Record<string, FieldIssueMessage>>;
  faellesAarsloen: Partial<Record<keyof FaellesAarsloenValues, FieldIssueMessage>>;
}>;

// Forlig om ansvarsgrad er delt kilde med EO-fanen (felterne bor i erstatningsopgoerelse-sektionen).
// `hasRejectedInput` afspejler rejected råinput i et af ansvarsgradsfelterne. Forligsdatoens eventuelle
// reader-feltfejl bæres separat, fordi den er en selvstændig dokumentdependency.
export type EetForligInput = Readonly<{
  values: ForligAnsvarsgradInput;
  // Forligsdato (delt kilde med EO) — kun til prosa-sætningen i specifikationen. Udeladt = ingen dato.
  dato?: ISODateString;
  datoErrorMessage?: string;
  hasRejectedInput: boolean;
}>;

export const EMPTY_EET_FORLIG_INPUT: EetForligInput = Object.freeze({
  values: Object.freeze({
    forligAnsvarsgradProcent: undefined,
    forligAnsvarsgradBroek: '',
  }),
  hasRejectedInput: false,
});

export type EetSnapshotInput = Readonly<{
  values: ErhvervsevnetabComposedValues;
  stamdata: StamdataValues | null;
  fieldErrors: EetInputIssues;
  forlig: EetForligInput;
}>;

type EetTabProjection<TComputation> = Readonly<{
  issues: readonly EetIssue[];
  hasBlockingErrors: boolean;
  computation: TComputation | null;
}>;

export type EetSnapshot = EetCanonicalOutput;

const sortAndDedupeIssues = (issues: readonly EetIssue[]): readonly EetIssue[] => {
  return dedupeIssuesBySeverityAndMessage([...issues]).sort(
    (a, b) => navigationSortKey(a.id) - navigationSortKey(b.id)
  );
};

const createRuntimeExceptionIssue = (message: string): readonly EetIssue[] => [{
  id: 'runtime-exception',
  severity: 'error',
  message,
}];

const safeBuildProjection = <TComputation>(
  build: () => EetTabProjection<TComputation>,
  context: string
): EetTabProjection<TComputation> => {
  try {
    return build();
  } catch (error) {
    const normalizedError = asError(error);
    reportSystemIssue({
      code: `eet_snapshot:${context}`,
      area: 'calculation',
      context: `eetSnapshot.${context}`,
      userMessage: 'Uventet runtimefejl i EET-beregning',
      developerMessage: normalizedError.message,
      error: normalizedError,
      diagnostics: {
        errorName: normalizedError.name,
      },
    });
    return {
      issues: createRuntimeExceptionIssue('Beregningen kan ikke gennemføres på grund af en intern beregningsfejl'),
      hasBlockingErrors: true,
      computation: null,
    };
  }
};

const createFieldIssues = (
  fieldErrors: EetInputIssues,
  ids: ReadonlyArray<Readonly<{ id: string; message: string | undefined }>>
): readonly EetIssue[] => {
  return ids
    .map(({ id, message }) => toFieldIssue(id, message))
    .filter((issue): issue is EetIssue => issue !== null);
};

/**
 * Bygger ét EET-panel med en STRUKTUREL dependency-gate foran motoren (§1.10/§3.9).
 *
 * Kontraktkravet er, at kun en `ready` projektion må fodre en beregningsmotor (`form-contract.md` §2.3), og
 * at en projektion ikke kalder motoren, hvis et afhængigt issue gør input uanvendeligt
 * (`error-contract.md` §5). Panelets egne field-/forlig-/datoordensissues afgøres derfor FØR `calculate`
 * kaldes — ikke bagefter, som tidligere.
 *
 * Hvorfor det er mere end en formalitet: readeren maskerer en rød værdi til `undefined`, så motoren ville
 * ellers regne på et FALSK input. Konkret kan en maskeret EAL-% eller EAL-årsløn falde tilbage til
 * ASL-værdien (`eetEalCalculation.ts:158-193`) og præsentere resultatet som `source: 'asl'`, som om
 * brugeren havde ladet feltet stå tomt.
 *
 * Gaten er PANEL-lokal, ikke global: hvert panel navngiver præcis de felter, dens egen motor læser, så en rød
 * beregningsdato blokerer Løbende/Efter-EAL/Difference, mens Kapitalisering fortsætter uændret.
 */
const buildGatedProjection = <TComputation>(
  blockingIssues: readonly EetIssue[],
  calculate: () => Readonly<{ issues: readonly EetIssue[]; computation: TComputation | null }>
): EetTabProjection<TComputation> => {
  const hasBlockingDependency = blockingIssues.some((issue) => issue.severity === 'error');
  if (hasBlockingDependency) {
    const issues = sortAndDedupeIssues(blockingIssues);
    return { issues, hasBlockingErrors: true, computation: null };
  }
  const calculationResult = calculate();
  const issues = sortAndDedupeIssues([...calculationResult.issues, ...blockingIssues]);
  return {
    issues,
    hasBlockingErrors: issues.some((issue) => issue.severity === 'error'),
    computation: calculationResult.computation,
  };
};

const createStamdataDateOrderIssues = (stamdata: StamdataValues | null): readonly EetIssue[] => {
  if (stamdata === null) return [];
  return resolveStamdataDateOrder(stamdata).issues.map((issue) => ({
    id: `stamdata-date-order:${issue.field}`,
    severity: 'error' as const,
    message: issue.message,
  }));
};

const buildLoebendeYdelserProjection = (input: EetSnapshotInput): EetSnapshot['loebendeYdelser'] => {
  const blockingIssues = [
    ...createFieldIssues(input.fieldErrors, [
      { id: 'field-beregningsdato', message: input.fieldErrors.erhvervsevnetab.beregningsdato?.message },
      { id: 'field-aarsloen-asl', message: input.fieldErrors.faellesAarsloen.aslAarsloen?.message },
      { id: 'field-asl-afgoerelser', message: input.fieldErrors.erhvervsevnetab.aslAfgoerelser?.message },
      { id: 'field-skadelidte-fodselsdato', message: input.fieldErrors.stamdata.skadelidteFodselsdato?.message },
      { id: 'field-skadedato', message: input.fieldErrors.stamdata.skadedato?.message },
    ]),
    ...createStamdataDateOrderIssues(input.stamdata),
  ];

  return buildGatedProjection(blockingIssues, () => computeEetLoebendeYdelser({
    erhvervsevnetab: input.values,
    skadedato: input.stamdata?.skadedato,
    skadelidteFodselsdato: input.values.skadelidteFodselsdato,
  }));
};

const buildKapitaliseringProjection = (input: EetSnapshotInput): EetSnapshot['kapitalisering'] => {
  // Bemærk: beregningsdato er BEVIDST ikke en kapitaliserings-afhængighed. Derfor bevares dette panel, når
  // beregningsdatoen er rød — den dependency-specifikke opdeling i §1.10 i praksis.
  const blockingIssues = [
    ...createFieldIssues(input.fieldErrors, [
      { id: 'field-aarsloen-asl', message: input.fieldErrors.faellesAarsloen.aslAarsloen?.message },
      { id: 'field-asl-afgoerelser', message: input.fieldErrors.erhvervsevnetab.aslAfgoerelser?.message },
      { id: 'field-skadelidte-fodselsdato', message: input.fieldErrors.stamdata.skadelidteFodselsdato?.message },
      { id: 'field-skadedato', message: input.fieldErrors.stamdata.skadedato?.message },
    ]),
    ...createStamdataDateOrderIssues(input.stamdata),
  ];

  return buildGatedProjection(blockingIssues, () => computeEetKapitaliseringCalculation({
    erhvervsevnetab: input.values,
    skadedato: input.stamdata?.skadedato,
    skadelidteFodselsdato: input.values.skadelidteFodselsdato,
  }));
};

/**
 * Spejler EAL-motorens egne fallback-betingelser, så gaten ikke kan drifte fra den motor, den gater:
 *  - `resolveAarsloen` (`eetEalCalculation.ts:184-193`): EAL-årslønnen bruges, når den er et finit tal > 0.
 *  - `resolveEetPct` (`eetEalCalculation.ts:169`): EAL-% bruges, når den er defineret og ikke 0.
 * Er primærværdien ikke brugbar, læser motoren ASL-siden — og først dér er ASL en afhængighed.
 */
const isUsableAmount = (amount: EetSnapshotInput['values']['ealAarsloen']): boolean => {
  const value = amount?.value;
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
};

const isUsableEetPct = (pct: number | undefined): boolean => pct !== undefined && pct !== 0;

const buildEfterEalProjection = (input: EetSnapshotInput): EetSnapshot['efterEal'] => {
  // EAL-motoren har TO fallbacks: EAL-% → ASL-rækkernes eetPct, og EAL-årsløn → ASL-årsløn
  // (`eetEalCalculation.ts:158-193`). Begge primærfelter er derfor altid afhængigheder.
  //
  // ASL-siden er en BETINGET afhængighed: den indgår KUN, når fallbacken faktisk nås — altså når primærværdien
  // er reelt tom. Uden det ville en rød ASL-værdi overblokere et panel, der har en gyldig EAL-primærværdi og
  // dermed slet ikke læser ASL. Med den bevares fallback-invarianten i den anden retning: en rød ASL-værdi må
  // ikke maskeres til tomhed og fodre motoren, når EAL-primærværdien er tom og fallbacken derfor bruges.
  const usesAslAarsloenFallback = !isUsableAmount(input.values.ealAarsloen);
  const usesAslEetPctFallback = !isUsableEetPct(input.values.ealEetPct);

  const blockingIssues = [
    ...createFieldIssues(input.fieldErrors, [
      { id: 'field-beregningsdato', message: input.fieldErrors.erhvervsevnetab.beregningsdato?.message },
      { id: 'field-eal-eet-pct', message: input.fieldErrors.erhvervsevnetab.ealEetPct?.message },
      { id: 'field-aarsloen-eal', message: input.fieldErrors.faellesAarsloen.ealAarsloen?.message },
      ...(usesAslAarsloenFallback
        ? [{ id: 'field-aarsloen-asl', message: input.fieldErrors.faellesAarsloen.aslAarsloen?.message }]
        : []),
      ...(usesAslEetPctFallback
        ? [{ id: 'field-asl-afgoerelser', message: input.fieldErrors.erhvervsevnetab.aslAfgoerelser?.message }]
        : []),
      { id: 'field-skadelidte-fodselsdato', message: input.fieldErrors.stamdata.skadelidteFodselsdato?.message },
      { id: 'field-skadedato', message: input.fieldErrors.stamdata.skadedato?.message },
    ]),
    ...createStamdataDateOrderIssues(input.stamdata),
  ];

  return buildGatedProjection(blockingIssues, () => computeEetEalCalculation({
    erhvervsevnetab: input.values,
    skadedato: input.stamdata?.skadedato,
    skadelidteFodselsdato: input.values.skadelidteFodselsdato,
    reguleringssats,
    erhvervsevnetabEalMax,
    aarsloenAslMax,
  }));
};

// Forlig om ansvarsgrad-fejl (delt kilde med EO-fanen). Et ugyldigt forlig — "begge udfyldt",
// en brøk over 1, eller et ikke-committbart rå draft — skal blokere hele differencekrav-outputtet.
const resolveForligBlocking = (forlig: EetForligInput | undefined): Readonly<{
  forligFactor: Parameters<typeof computeEetDifferencekravCalculation>[0]['forlig'];
  issue: EetIssue | null;
}> => {
  if (!forlig) return { forligFactor: null, issue: null };
  const evaluation = evaluateForligsgrad(forlig.values);
  if (forlig.hasRejectedInput) {
    return {
      forligFactor: null,
      issue: { id: 'forlig-ansvarsgrad-invalid', severity: 'error', message: 'Forlig om ansvarsgrad indeholder en ugyldig værdi' },
    };
  }
  if (evaluation.status === 'invalid') {
    return {
      forligFactor: null,
      issue: { id: 'forlig-ansvarsgrad-invalid', severity: 'error', message: `Forlig om ansvarsgrad: ${evaluation.message}` },
    };
  }
  return { forligFactor: evaluation.status === 'valid' ? evaluation.forlig : null, issue: null };
};

const buildDifferencekravProjection = (input: EetSnapshotInput): EetSnapshot['differencekrav'] => {
  const forligBlocking = resolveForligBlocking(input.forlig);
  const forligDatoIssue = toFieldIssue('field-forlig-dato', input.forlig?.datoErrorMessage);

  // Differencekravet er en JOIN: det læser hele EAL- og ASL-siden PLUS forliget. Derfor er dens
  // afhængighedsliste unionen af søsterpanelernes — et rødt felt i enten EAL- eller ASL-grenen blokerer den.
  // Et ugyldigt forlig (eller en ugyldig forligsdato) er ligeledes en afhængighed, ikke et efterfølgende filter:
  // uden gaten ville motoren regne videre med `forligFactor: null`, dvs. som om der slet ikke var et forlig.
  const blockingIssues = [
    ...createFieldIssues(input.fieldErrors, [
      { id: 'field-beregningsdato', message: input.fieldErrors.erhvervsevnetab.beregningsdato?.message },
      { id: 'field-aarsloen-asl', message: input.fieldErrors.faellesAarsloen.aslAarsloen?.message },
      { id: 'field-asl-afgoerelser', message: input.fieldErrors.erhvervsevnetab.aslAfgoerelser?.message },
      { id: 'field-eal-eet-pct', message: input.fieldErrors.erhvervsevnetab.ealEetPct?.message },
      { id: 'field-aarsloen-eal', message: input.fieldErrors.faellesAarsloen.ealAarsloen?.message },
      { id: 'field-skadelidte-fodselsdato', message: input.fieldErrors.stamdata.skadelidteFodselsdato?.message },
      { id: 'field-skadedato', message: input.fieldErrors.stamdata.skadedato?.message },
    ]),
    ...createStamdataDateOrderIssues(input.stamdata),
    ...(forligBlocking.issue ? [forligBlocking.issue] : []),
    ...(forligDatoIssue === null ? [] : [forligDatoIssue]),
  ];

  return buildGatedProjection(blockingIssues, () => computeEetDifferencekravCalculation({
    erhvervsevnetab: input.values,
    skadedato: input.stamdata?.skadedato,
    skadelidteFodselsdato: input.values.skadelidteFodselsdato,
    endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft:
      input.values.endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft,
    indregnMerErstatningVedForhoejetPensionsalder:
      input.values.indregnMerErstatningVedForhoejetPensionsalder,
    forlig: forligBlocking.forligFactor,
    forligDato: input.forlig?.dato,
  }));
};

// Den reader-baserede projektion fører den første tabelblokerende ASL-rækkefejl ind som `field-asl-afgoerelser`.
// De øvrige rækkeissues forbliver tilgængelige for den senere tabel-cutover, men beregning og dokumentgate er
// allerede uafhængige af mounted reporters.
export const computeEetSnapshot = (input: EetSnapshotInput): EetSnapshot => {
  const output = {
    loebendeYdelser: safeBuildProjection(() => buildLoebendeYdelserProjection(input), 'loebende_ydelser'),
    kapitalisering: safeBuildProjection(() => buildKapitaliseringProjection(input), 'kapitalisering'),
    efterEal: safeBuildProjection(() => buildEfterEalProjection(input), 'efter_eal'),
    differencekrav: safeBuildProjection(() => buildDifferencekravProjection(input), 'differencekrav'),
  };
  const parsed = eetCanonicalOutputSchema.safeParse(output);
  if (parsed.success) return parsed.data;

  reportSystemIssue({
    code: 'eet_snapshot:canonical_output',
    area: 'calculation',
    context: 'eetSnapshot.canonicalOutput',
    userMessage: 'Uventet valideringsfejl i EET-beregning',
    developerMessage: parsed.error.message,
    diagnostics: { issueCount: parsed.error.issues.length },
  });
  const failedProjection = {
    issues: createRuntimeExceptionIssue(
      'Beregningen kan ikke gennemføres, fordi det kanoniske beregningsresultat er ugyldigt'
    ),
    hasBlockingErrors: true,
    computation: null,
  };
  return eetCanonicalOutputSchema.parse({
    loebendeYdelser: failedProjection,
    kapitalisering: failedProjection,
    efterEal: failedProjection,
    differencekrav: failedProjection,
  });
};

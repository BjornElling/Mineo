import type {
  ErhvervsevnetabComposedValues,
  FaellesAarsloenValues,
  StamdataValues,
} from '../../schemas/formSchemas';
import {
  evaluateForligsgrad,
  FORLIG_ANSVARSGRAD_LABEL,
  type ForligAnsvarsgradInput,
} from '../erstatningsopgoerelse/engines/forligsgrad';
import { coerceToISODateString, type ISODateString } from '../../types/branded';
import { filterAslRowsKnownAtBeregningsdato } from './eetDifferencekravCalculation';
import { dedupeIssuesByIdentity } from '../../utils/issueUtils';
import {
  aarsloenAslMax,
  erhvervsevnetabEalMax,
  reguleringssats,
} from '../../data/lovbestemteRates';
import { computeEetDifferencekravCalculation } from './eetCalculationGraph';
import { computeEetEalCalculation, type EetEalForligInput } from './eetEalCalculation';
import { navigationSortKey, toFieldIssue } from './eetFormatUtils';
import { resolveEetIssueFocusTarget } from './eetIssueFocusTargets';
import { aslRowIdOfAddress, describeAslAfgoerelseRow } from './aslAfgoerelserIssueSummary';
import { INCOMPLETE_ROW_ISSUE_IDS, isAslAfgoerelseRowEmpty } from './eetAslAfgoerelser';
import {
  aslAfgoerelseKapDatoField,
  aslAfgoerelseKapPctField,
  aslAfgoerelseTidlKapDatoField,
} from '../../inputCore/catalog/erhvervsevnetabDescriptors';
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
  erhvervsevnetab: Partial<Record<Exclude<keyof ErhvervsevnetabComposedValues, 'aslAfgoerelser'>, FieldIssueMessage>>;
  faellesAarsloen: Partial<Record<keyof FaellesAarsloenValues, FieldIssueMessage>>;
  /**
   * ALLE røde celler i ASL-afgørelsestabellen, én linje pr. celle med cellen som mål. Tabellen er ét
   * input med mange felter; en enkelt besked her lod fanerne vise den første fejl og skjule resten.
   */
  aslAfgoerelser?: readonly EetIssue[];
}>;

// Forlig om ansvarsgrad er delt kilde med EO-fanen (felterne bor i erstatningsopgoerelse-sektionen).
// `hasRejectedInput` afspejler rejected råinput i et af ansvarsgradsfelterne. Forligsdatoens eventuelle
// reader-feltfejl bæres separat, fordi den er en selvstændig dokumentdependency.
export type EetForligInput = Readonly<{
  values: ForligAnsvarsgradInput;
  // Forligsdato (delt kilde med EO) – bruges til prosa-sætningen på begge faner. Udeladt = ingen dato.
  dato?: ISODateString;
  datoErrorMessage?: string;
  // Feltets EGEN besked, når readeren har afvist procenten/brøken. Bæres med, så «Fejl og
  // advarsler» kan skrive den konkrete regel frem for en generisk «ugyldig værdi».
  procentErrorMessage?: string;
  broekErrorMessage?: string;
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
  return dedupeIssuesByIdentity([...issues]).sort(
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
 * Giver motorens issues deres konkrete celle som mål, opløst mod de rækker, brugeren faktisk har udfyldt.
 *
 * Motorerne melder en rækkemangel ved id alene. Uden rækkerne faldt fejloversigten tilbage til FØRSTE række, så
 * «angiv kapitaliseringsdato» kunne fremhæve en allerede udfyldt, korrekt kapitalisering, mens den tomme celle
 * stod i en anden række. EO's import af midlertidigt EET opløser allerede målet på samme måde.
 */
const withRowFocusTargets = (issues: readonly EetIssue[], input: EetSnapshotInput): readonly EetIssue[] => {
  const context = {
    aslAfgoerelser: input.values.aslAfgoerelser,
    skadedato: input.stamdata?.skadedato,
    skadelidteFodselsdato: input.values.skadelidteFodselsdato,
  };
  const flereRaekker = input.values.aslAfgoerelser.filter((row) => !isAslAfgoerelseRowEmpty(row)).length > 1;
  return issues.map((issue) => {
    if (issue.focusTarget !== undefined) return issue;
    const focusTarget = resolveEetIssueFocusTarget(issue.id, context);
    if (focusTarget === undefined) return issue;
    // Med flere afgørelser navngives den, der mangler oplysningen, som ved røde celler.
    const rowId = focusTarget.kind === 'rowId'
      ? focusTarget.rowId
      : focusTarget.kind === 'fieldAddress' ? aslRowIdOfAddress(focusTarget.address) : undefined;
    const raekke = flereRaekker && RAEKKENAVNGIVNE_ISSUE_IDS.has(issue.id) && rowId !== undefined
      ? describeAslAfgoerelseRow(rowId, input.values.aslAfgoerelser)
      : undefined;
    return {
      ...issue,
      focusTarget,
      ...(raekke === undefined ? {} : { message: `${raekke}: ${issue.message}` }),
    };
  });
};

/**
 * Rækkemangler, hvis besked ikke selv peger på en bestemt afgørelse. «Der er en afgørelse uden …»-beskederne
 * er udeladt: de taler allerede om «en afgørelse» og ville læses dobbelt med et rækkenavn foran.
 */
const RAEKKENAVNGIVNE_ISSUE_IDS: ReadonlySet<string> = new Set([
  INCOMPLETE_ROW_ISSUE_IDS.missingKapDato,
  INCOMPLETE_ROW_ISSUE_IDS.missingKapPct,
  INCOMPLETE_ROW_ISSUE_IDS.endeligUnder50MissingKap,
  INCOMPLETE_ROW_ISSUE_IDS.virkningsdatoAfterTidlKapDato,
  INCOMPLETE_ROW_ISSUE_IDS.kapDatoNotAfterTidlKapDato,
  INCOMPLETE_ROW_ISSUE_IDS.kapDatoAfterLaterForcedKapitalisering,
  'delvist-endelig-missing-kapitalisering',
]);

/**
 * Bygger ét EET-panel med en STRUKTUREL dependency-gate foran motoren (§1.10/§3.9).
 *
 * Kontraktkravet er, at kun en `ready` projektion må fodre en beregningsmotor (`form-contract.md` §2.3), og
 * at en projektion ikke kalder motoren, hvis et afhængigt issue gør input uanvendeligt
 * (`error-contract.md` §5). Panelets egne field-/forlig-/datoordensissues afgøres derfor FØR `calculate`
 * kaldes – ikke bagefter, som tidligere.
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
  input: EetSnapshotInput,
  blockingIssues: readonly EetIssue[],
  calculate: () => Readonly<{ issues: readonly EetIssue[]; computation: TComputation | null }>
): EetTabProjection<TComputation> => {
  const hasBlockingDependency = blockingIssues.some((issue) => issue.severity === 'error');
  if (hasBlockingDependency) {
    const issues = sortAndDedupeIssues(blockingIssues);
    return { issues, hasBlockingErrors: true, computation: null };
  }
  const calculationResult = calculate();
  const issues = sortAndDedupeIssues([
    ...withRowFocusTargets(calculationResult.issues, input),
    ...blockingIssues,
  ]);
  return {
    issues,
    hasBlockingErrors: issues.some((issue) => issue.severity === 'error'),
    computation: calculationResult.computation,
  };
};

/** Afgørelsestabellens røde celler – hver sin linje. Tom, når tabellen ikke har nogen. */
const aslAfgoerelserIssues = (input: EetSnapshotInput): readonly EetIssue[] =>
  input.fieldErrors.aslAfgoerelser ?? [];

/**
 * Kapitaliseringskolonnerne læses ikke af EAL-motoren: den vælger afgørelse ud fra afgørelsesdato, virkningsdato og
 * type og bruger kun dens EET %. En rød kapitaliseringsdato på en anden afgørelse må derfor ikke stoppe
 * EAL-kravet. De øvrige kolonner kan ændre, hvilken afgørelse der vælges, og blokerer derfor fortsat.
 */
const EAL_ULAESTE_ASL_KOLONNER: ReadonlySet<string> = new Set([
  aslAfgoerelseKapDatoField.template.field,
  aslAfgoerelseKapPctField.template.field,
  aslAfgoerelseTidlKapDatoField.template.field,
]);

const aslAfgoerelserIssuesForEal = (input: EetSnapshotInput): readonly EetIssue[] =>
  aslAfgoerelserIssues(input).filter((issue) =>
    issue.focusTarget?.kind !== 'fieldAddress' || !EAL_ULAESTE_ASL_KOLONNER.has(issue.focusTarget.address.field));

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
      { id: 'field-skadelidte-fodselsdato', message: input.fieldErrors.stamdata.skadelidteFodselsdato?.message },
      { id: 'field-skadedato', message: input.fieldErrors.stamdata.skadedato?.message },
    ]),
    ...aslAfgoerelserIssues(input),
    ...createStamdataDateOrderIssues(input.stamdata),
  ];

  return buildGatedProjection(input, blockingIssues, () => computeEetLoebendeYdelser({
    erhvervsevnetab: input.values,
    skadedato: input.stamdata?.skadedato,
    skadestype: input.stamdata?.skadestype,
    skadelidteFodselsdato: input.values.skadelidteFodselsdato,
  }));
};

const buildKapitaliseringProjection = (input: EetSnapshotInput): EetSnapshot['kapitalisering'] => {
  // Bemærk: beregningsdato er BEVIDST ikke en kapitaliserings-afhængighed. Derfor bevares dette panel, når
  // beregningsdatoen er rød – den dependency-specifikke opdeling i §1.10 i praksis.
  const blockingIssues = [
    ...createFieldIssues(input.fieldErrors, [
      { id: 'field-aarsloen-asl', message: input.fieldErrors.faellesAarsloen.aslAarsloen?.message },
      { id: 'field-skadelidte-fodselsdato', message: input.fieldErrors.stamdata.skadelidteFodselsdato?.message },
      { id: 'field-skadedato', message: input.fieldErrors.stamdata.skadedato?.message },
    ]),
    ...aslAfgoerelserIssues(input),
    ...createStamdataDateOrderIssues(input.stamdata),
  ];

  return buildGatedProjection(input, blockingIssues, () => computeEetKapitaliseringCalculation({
    erhvervsevnetab: input.values,
    skadedato: input.stamdata?.skadedato,
    skadestype: input.stamdata?.skadestype,
    skadelidteFodselsdato: input.values.skadelidteFodselsdato,
  }));
};

/**
 * Spejler EAL-motorens egne fallback-betingelser, så gaten ikke kan drifte fra den motor, den gater:
 *  - `resolveAarsloen` (`eetEalCalculation.ts:184-193`): EAL-årslønnen bruges, når den er et finit tal > 0.
 *  - `resolveEetPct` (`eetEalCalculation.ts:169`): EAL-% bruges, når den er defineret og ikke 0.
 * Er primærværdien ikke brugbar, læser motoren ASL-siden – og først dér er ASL en afhængighed.
 */
const isUsableAmount = (amount: EetSnapshotInput['values']['ealAarsloen']): boolean => {
  const value = amount?.value;
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
};

const isUsableEetPct = (pct: number | undefined): boolean => pct !== undefined && pct !== 0;

// Forlig om ansvarsgrad-fejl (delt kilde med EO-fanen). Et ugyldigt forlig – "begge udfyldt",
// en brøk over 1, eller et ikke-committbart rå draft – skal blokere både EAL- og differencekrav-outputtet.
//
// Beskeden er feltets EGEN, når readeren har afvist indtastningen: den generiske «indeholder en
// ugyldig værdi» sagde kun AT noget var galt, hvor programmet i samme øjeblik kendte HVAD – og tre
// forskellige regler fik samme tekst. `evaluateForligsgrad`s egen besked er sidste udvej for de tilfælde,
// hvor ingen feltfejl er sat.
const resolveForligBlocking = (forlig: EetForligInput | undefined): Readonly<{
  forligFactor: Parameters<typeof computeEetDifferencekravCalculation>[0]['forlig'];
  issue: EetIssue | null;
}> => {
  if (!forlig) return { forligFactor: null, issue: null };
  const evaluation = evaluateForligsgrad(forlig.values);
  const feltbesked = forlig.procentErrorMessage ?? forlig.broekErrorMessage;
  if (feltbesked !== undefined && feltbesked.trim() !== '') {
    return {
      forligFactor: null,
      issue: {
        id: 'forlig-ansvarsgrad-invalid',
        severity: 'error',
        message: `${FORLIG_ANSVARSGRAD_LABEL}: ${feltbesked.trim()}`,
      },
    };
  }
  if (forlig.hasRejectedInput) {
    return {
      forligFactor: null,
      issue: {
        id: 'forlig-ansvarsgrad-invalid',
        severity: 'error',
        message: `${FORLIG_ANSVARSGRAD_LABEL} indeholder en ugyldig værdi`,
      },
    };
  }
  if (evaluation.status === 'invalid') {
    return {
      forligFactor: null,
      issue: {
        id: 'forlig-ansvarsgrad-invalid',
        severity: 'error',
        message: `${FORLIG_ANSVARSGRAD_LABEL}: ${evaluation.message}`,
      },
    };
  }
  return { forligFactor: evaluation.status === 'valid' ? evaluation.forlig : null, issue: null };
};

/**
 * Forligsblokeringen, som den gælder for BÅDE «EET efter EAL» og «Differencekrav».
 *
 * De to faner viser hver sin forligsreducerede størrelse, og et forlig, brugeren ikke har kunnet
 * indtaste gyldigt, må derfor blokere dem begge – ellers ville den ene fane vise et tal, der hvilede
 * på et forlig, den anden fane samtidig afviste. Felterne bor på «EET oplysninger» under
 * «Erstatningsansvarsloven» og deles med Erstatningsopgørelsen.
 */
const buildForligBlockingIssues = (input: EetSnapshotInput): Readonly<{
  issues: readonly EetIssue[];
  forligFactor: ReturnType<typeof resolveForligBlocking>['forligFactor'];
}> => {
  const forligBlocking = resolveForligBlocking(input.forlig);
  const forligDatoIssue = toFieldIssue('field-forlig-dato', input.forlig?.datoErrorMessage);
  return {
    issues: [
      ...(forligBlocking.issue ? [forligBlocking.issue] : []),
      ...(forligDatoIssue === null ? [] : [forligDatoIssue]),
    ],
    forligFactor: forligBlocking.forligFactor,
  };
};

/**
 * Forligsgraden, som fane 4 skal REDUCERE SIT EGET EAL-krav med.
 *
 * Kun et gyldigt forlig UNDER 100 % giver en reduktion – præcis samme `factor < 1`-regel som
 * differencekravet bruger, så et forlig på 100 % ikke skriver en forligsblok uden virkning.
 * Grundlaget er derimod fanens eget: her det rene EAL-krav, på differencekravet beløbet efter alle
 * fire ASL-fradrag. Se `eetEalForligSchema`.
 */
const resolveEfterEalForlig = (
  forligFactor: ReturnType<typeof resolveForligBlocking>['forligFactor'],
  dato: ISODateString | undefined
): EetEalForligInput | null => {
  if (forligFactor === null || forligFactor === undefined) return null;
  if (forligFactor.factor >= 1) return null;
  return { factor: forligFactor.factor, label: forligFactor.label, dato: dato ?? null };
};

const buildEfterEalProjection = (input: EetSnapshotInput): EetSnapshot['efterEal'] => {
  // EAL-motoren har TO fallbacks: EAL-% → ASL-rækkernes eetPct, og EAL-årsløn → ASL-årsløn
  // (`eetEalCalculation.ts:158-193`). Begge primærfelter er derfor altid afhængigheder.
  //
  // ASL-siden er en BETINGET afhængighed: den indgår KUN, når fallbacken faktisk nås – altså når primærværdien
  // er reelt tom. Uden det ville en rød ASL-værdi overblokere et panel, der har en gyldig EAL-primærværdi og
  // dermed slet ikke læser ASL. Med den bevares fallback-invarianten i den anden retning: en rød ASL-værdi må
  // ikke maskeres til tomhed og fodre motoren, når EAL-primærværdien er tom og fallbacken derfor bruges.
  const usesAslAarsloenFallback = !isUsableAmount(input.values.ealAarsloen);
  const usesAslEetPctFallback = !isUsableEetPct(input.values.ealEetPct);

  // Forliget er nu en afhængighed også HER, fordi fanen selv viser det forligsreducerede EAL-krav.
  const forligBlocking = buildForligBlockingIssues(input);

  const blockingIssues = [
    ...forligBlocking.issues,
    ...createFieldIssues(input.fieldErrors, [
      { id: 'field-beregningsdato', message: input.fieldErrors.erhvervsevnetab.beregningsdato?.message },
      { id: 'field-eal-eet-pct', message: input.fieldErrors.erhvervsevnetab.ealEetPct?.message },
      { id: 'field-aarsloen-eal', message: input.fieldErrors.faellesAarsloen.ealAarsloen?.message },
      ...(usesAslAarsloenFallback
        ? [{ id: 'field-aarsloen-asl', message: input.fieldErrors.faellesAarsloen.aslAarsloen?.message }]
        : []),
      { id: 'field-skadelidte-fodselsdato', message: input.fieldErrors.stamdata.skadelidteFodselsdato?.message },
      { id: 'field-skadedato', message: input.fieldErrors.stamdata.skadedato?.message },
    ]),
    ...(usesAslEetPctFallback ? aslAfgoerelserIssuesForEal(input) : []),
    ...createStamdataDateOrderIssues(input.stamdata),
  ];

  return buildGatedProjection(input, blockingIssues, () => computeEetEalCalculation({
    // Samme afgrænsning som differencekravet: en afgørelse med virkning efter beregningsdatoen indgår ikke.
    // Valgtes den seneste afgørelse uanset beregningsdatoen, kunne samme sag give to forskellige EAL-krav.
    erhvervsevnetab: {
      ...input.values,
      aslAfgoerelser: [...filterAslRowsKnownAtBeregningsdato(
        input.values.aslAfgoerelser,
        coerceToISODateString(input.values.beregningsdato)
      )],
    },
    skadedato: input.stamdata?.skadedato,
    skadestype: input.stamdata?.skadestype,
    skadelidteFodselsdato: input.values.skadelidteFodselsdato,
    reguleringssats,
    erhvervsevnetabEalMax,
    aarsloenAslMax,
    // ENESTE kaldested der sender et forlig: fane 4 opgør sit eget krav efter forliget.
    forlig: resolveEfterEalForlig(forligBlocking.forligFactor, input.forlig?.dato),
  }));
};

const buildDifferencekravProjection = (input: EetSnapshotInput): EetSnapshot['differencekrav'] => {
  const forligBlocking = buildForligBlockingIssues(input);

  // Differencekravet er en JOIN: det læser hele EAL- og ASL-siden PLUS forliget. Derfor er dens
  // afhængighedsliste unionen af søsterpanelernes – et rødt felt i enten EAL- eller ASL-grenen blokerer den.
  // Et ugyldigt forlig (eller en ugyldig forligsdato) er ligeledes en afhængighed, ikke et efterfølgende filter:
  // uden gaten ville motoren regne videre med `forligFactor: null`, dvs. som om der slet ikke var et forlig.
  const blockingIssues = [
    ...createFieldIssues(input.fieldErrors, [
      { id: 'field-beregningsdato', message: input.fieldErrors.erhvervsevnetab.beregningsdato?.message },
      { id: 'field-aarsloen-asl', message: input.fieldErrors.faellesAarsloen.aslAarsloen?.message },
      { id: 'field-eal-eet-pct', message: input.fieldErrors.erhvervsevnetab.ealEetPct?.message },
      { id: 'field-aarsloen-eal', message: input.fieldErrors.faellesAarsloen.ealAarsloen?.message },
      { id: 'field-skadelidte-fodselsdato', message: input.fieldErrors.stamdata.skadelidteFodselsdato?.message },
      { id: 'field-skadedato', message: input.fieldErrors.stamdata.skadedato?.message },
    ]),
    ...aslAfgoerelserIssues(input),
    ...createStamdataDateOrderIssues(input.stamdata),
    ...forligBlocking.issues,
  ];

  return buildGatedProjection(input, blockingIssues, () => computeEetDifferencekravCalculation({
    erhvervsevnetab: input.values,
    skadedato: input.stamdata?.skadedato,
    skadestype: input.stamdata?.skadestype,
    skadelidteFodselsdato: input.values.skadelidteFodselsdato,
    endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft:
      input.values.endeligEetGoerMidlertidigEndeligMedTilbagevirkendeKraft,
    indregnMerErstatningVedForhoejetPensionsalder:
      input.values.indregnMerErstatningVedForhoejetPensionsalder,
    forlig: forligBlocking.forligFactor,
    forligDato: input.forlig?.dato,
  }));
};

// Den reader-baserede projektion fører hver rød celle i ASL-afgørelsestabellen ind som `field-asl-afgoerelser`
// med cellen som mål. Beregning og dokumentgate er uafhængige af mounted reporters.
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

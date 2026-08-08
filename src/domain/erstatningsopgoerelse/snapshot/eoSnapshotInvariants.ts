import type { ValidationError } from '../../../types/validation';
import type { EetIssue } from '../../erhvervsevnetab/eetTypes';
import type { MoneyOre } from '../../money/money';
import {
  TAF_OVERLAP_ERROR_MESSAGE,
} from '../../../validators/erstatningsopgoerelseValidator';
import type { FieldIssue } from '../../../inputCore/inputIssue';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';

export type EoProjectionTarget = 'beregning' | 'inspektion' | 'eo_pdf' | 'taf_per_year_pdf' | 'taf_per_year_opreguleret_pdf';

/**
 * source klassificerer invariantens oprindelse:
 * - 'validation': stammer fra felter/valideringsregler (vises som feltfejl og i "Fejl og advarsler")
 * - 'system': stammer fra engine/beregningslag (vises i systemfejl-sektion, evt. med BugReportButton)
 */
export type EoInvariant = Readonly<{
  id: string;
  passed: boolean;
  severity: 'warning' | 'error';
  source: 'validation' | 'system';
  message: string;
  evidence?: ReadonlyArray<string>;
  blocksAuthoritativeComputation: boolean;
  blocksOutputs?: ReadonlyArray<EoProjectionTarget>;
}>;

const VALIDATION_BLOCKED_OUTPUTS: readonly EoProjectionTarget[] = ['beregning', 'inspektion', 'eo_pdf', 'taf_per_year_pdf', 'taf_per_year_opreguleret_pdf'];

const buildValidationInvariantId = (error: ValidationError, index: number): string => {
  const path = error.path ?? `${index}`;
  if (error.message === TAF_OVERLAP_ERROR_MESSAGE) {
    return `taf_perioder:overlap:${path}`;
  }
  if (path.includes('.loseFeriedage')) {
    return `taf_perioder:lose_feriedage:${path}`;
  }
  if (path === 'uspecificeredeFerieFridage') {
    return 'beregningsperiode:uspecificerede_feriefridage';
  }
  return `validation:${path}`;
};

export const buildValidationInvariants = (errors: readonly ValidationError[]): readonly EoInvariant[] => {
  return errors.map((error, index) => ({
    id: buildValidationInvariantId(error, index),
    passed: false,
    severity: error.severity === 'warning' ? 'warning' : 'error',
    source: 'validation' as const,
    message: error.message,
    evidence: error.path ? [error.path] : undefined,
    blocksAuthoritativeComputation: error.severity !== 'warning',
    blocksOutputs: error.severity === 'warning' ? [] : VALIDATION_BLOCKED_OUTPUTS,
  }));
};

/**
 * De "mangler"-beskeder, som legacy-validatoren danner, NÅR og FORDI readeren har maskeret en værdi bag en
 * rød feltfejl. Kun disse; enhver anden legacy-besked er en selvstændig regel og skal stå.
 */
const MASKING_INDUCED_MISSING_MESSAGES: ReadonlySet<string> = new Set([
  'Fra-dato mangler',
  'Til-dato mangler',
]);

/**
 * Fjerner de "mangler"-invarianter, som en STRUKTUREL feltfejl på samme felt allerede har dækket.
 *
 * Baggrunden er en direkte konsekvens af readerens maskering (§1.5): en værdi bag en rød feltfejl er
 * `undefined` for enhver consumer. Det er rigtigt over for MOTORERNE — de må ikke regne på en værdi, brugeren
 * har fået markeret som forkert — men legacy-validatoren læser samme maskerede værdier og konkluderer da, at
 * feltet er TOMT. Brugeren, der har indtastet en til-dato før fra-datoen, fik derfor fire beskeder om én fejl:
 * to sande kronologifejl plus to usande «Fra-dato mangler»/«Til-dato mangler» om datoer, der tydeligvis står i
 * felterne. Den usande halvdel er værst, fordi den peger brugeren mod en handling (udfyld feltet), som ikke
 * kan løse noget.
 *
 * Undertrykkelsen sker HER frem for i validatoren, fordi det er her de to lister mødes, og fordi kriteriet er
 * en egenskab ved PARRET af lister — ikke ved nogen af dem alene. Validatoren kan ikke selv vide, om en tom
 * værdi er brugerens tomhed eller readerens maskering; det kan kun den, der også kender feltissue-sættet.
 *
 * Matchningen går på felt-IDENTITET, ikke på tekst: `reader_field:eo.tafPerioder.fra#taf-1` og
 * `validation:tafPerioder[0].fra` peger på samme felt gennem hver sin adresseform. Rækkens stabile entity-id
 * oversættes kun til den legacy-validatorsti, der allerede bruges som evidence; den bliver ikke en ny
 * feltidentitet. Det præcise match er nødvendigt, fordi et felt med samme navn i en anden række fortsat kan
 * være en ægte mangel.
 */
const legacyPathForFieldIssue = (
  issue: FieldIssue,
  values: ErstatningsopgoerelseValues,
): string | undefined => {
  const supportedCollections = {
    tafPerioder: values.tafPerioder,
    svieSmertePerioder: values.svieSmertePerioder,
  } as const;
  const entity = issue.field.address.path.find((segment) => (
    segment.kind === 'entity' && segment.collection in supportedCollections
  ));
  if (entity?.kind !== 'entity') return undefined;

  const collection = entity.collection as keyof typeof supportedCollections;
  const rows = supportedCollections[collection];
  const index = rows.findIndex((row) => row.id === entity.entityId);
  if (index < 0) return undefined;
  if (issue.field.address.field !== 'fra' && issue.field.address.field !== 'til') return undefined;
  return `${collection}[${index}].${issue.field.address.field}`;
};

export const suppressMaskedMissingInvariants = (
  validationInvariants: readonly EoInvariant[],
  structuralFieldIssues: readonly FieldIssue[],
  values: ErstatningsopgoerelseValues,
): readonly EoInvariant[] => {
  if (structuralFieldIssues.length === 0) return validationInvariants;

  const maskedLegacyPaths = new Set(
    structuralFieldIssues
      .map((issue) => legacyPathForFieldIssue(issue, values))
      .filter((path): path is string => path !== undefined)
  );

  return validationInvariants.filter((invariant) => {
    if (!MASKING_INDUCED_MISSING_MESSAGES.has(invariant.message)) return true;
    const path = invariant.evidence?.[0];
    if (path === undefined) return true;
    return !maskedLegacyPaths.has(path);
  });
};

/**
 * Røde reader-feltfejl som blokerende invarianter (F2, `form-contract.md` §2.3 / `error-contract.md` §5).
 *
 * Tidligere gik `eoErrors` KUN til inspektionsvisningen, mens motorerne blev kaldt bagefter på readerens
 * MASKEREDE værdier (en rød værdi er `undefined` for motoren). Resultatet var falske tal bag en rød
 * feltmarkering — fx en forligsprocent på 150, der blev regnet som "intet forlig", dvs. 100 %.
 *
 * Invarianterne er den eksisterende, strukturelle blokerings-mekanisme i EO-snapshottet, og de bærer
 * `blocksOutputs` pr. output. Reader-fejl føres derfor ind ad samme vej som validator-invarianterne i
 * stedet for gennem en ny parallel sidekanal.
 *
 * Alle strukturelle feltissues blokerer deres afhængige consumer — inklusive `bounds`, jf.
 * `error-contract.md` §1.1's normative matrix: en bounds-værdi må GEMMES, men må ikke fodre en motor.
 * Samme kanoniske `FieldIssueSet` bærer både EO- og stamdataissues, inklusive nested rækkeceller.
 */
/**
 * De STRUKTURELLE røde feltissues som blokerende invarianter.
 *
 * Dette er EO-sektionens fuldstændige reader-fejl-vej. `buildReaderFieldIssueInvariants` over `eoErrors`
 * dækkede kun 11 top-level feltnavne, så en rød RÆKKECELLE (svie/smerte-periode, TAF-periode,
 * ferie-/fraværsdato, lønudviklingscelle) hverken blokerede den autoritative beregning eller sin egen gren:
 * motoren regnede videre på readerens maskerede tomværdi.
 *
 * Invariant-id'et bærer descriptor-id + de entity-id'er, adressen indeholder, så to røde celler i SAMME
 * collection giver to forskellige invarianter (issue-snapshottet har højst ét aktivt issue pr. adresse,
 * §1.8, så id'et er entydigt).
 */
export const buildStructuralFieldIssueInvariants = (
  issues: readonly FieldIssue[]
): readonly EoInvariant[] => issues.map((issue) => {
  const entityIds = issue.field.address.path.flatMap((segment) =>
    segment.kind === 'entity' ? [segment.entityId] : []);
  const suffix = entityIds.length > 0 ? `#${entityIds.join('.')}` : '';
  return {
    id: `reader_field:${issue.field.descriptor.id}${suffix}`,
    passed: false,
    severity: 'error' as const,
    source: 'validation' as const,
    message: issue.message,
    evidence: [issue.field.descriptor.id],
    blocksAuthoritativeComputation: true,
    blocksOutputs: VALIDATION_BLOCKED_OUTPUTS,
  };
});

export const buildMidlertidigtEetSourceInvariants = (
  issues: readonly EetIssue[]
): readonly EoInvariant[] => {
  return issues.map((issue) => ({
    id: `midlertidigt_eet_source:${issue.id}`,
    passed: false,
    severity: issue.severity,
    source: 'validation' as const,
    message: issue.message,
    evidence: ['erhvervsevnetab'],
    blocksAuthoritativeComputation: issue.severity === 'error',
    blocksOutputs: issue.severity === 'error' ? VALIDATION_BLOCKED_OUTPUTS : [],
  }));
};

export const buildTafPerYearAfrundingInvariant = (args: Readonly<{
  afrundingOre: MoneyOre;
  sumYearTafOre: MoneyOre;
  samletTafKravOre: MoneyOre;
}>): EoInvariant => ({
  id: 'taf_per_year:afrunding_over_100',
  passed: false,
  severity: 'error',
  source: 'system',
  message: 'TAF fordelt på år kan ikke afstemmes inden for 1 kr.',
  evidence: [
    `Afrunding: ${args.afrundingOre}`,
    `Årssum: ${args.sumYearTafOre}`,
    `Samlet TAF-krav: ${args.samletTafKravOre}`,
  ],
  blocksAuthoritativeComputation: false,
  blocksOutputs: ['taf_per_year_pdf', 'taf_per_year_opreguleret_pdf'],
});

export const buildTafPerYearOpreguleretManglendeReguleringssatsInvariant = (
  manglendeAar: readonly number[]
): EoInvariant => ({
  id: 'taf_per_year_opreguleret:manglende_reguleringssats',
  passed: false,
  severity: 'error',
  source: 'system',
  message: manglendeAar.length > 0
    ? `TAF opreguleret til beregningsåret kan ikke beregnes, fordi der mangler reguleringssats for ${manglendeAar.join(', ')}.`
    : 'TAF opreguleret til beregningsåret kan ikke beregnes, fordi der mangler reguleringssats.',
  evidence: manglendeAar.map((aar) => `Mangler reguleringssats for ${aar}`),
  blocksAuthoritativeComputation: false,
  blocksOutputs: ['taf_per_year_opreguleret_pdf'],
});

export const buildTafPerYearUnavailableInvariant = (reason: 'missing_loenudvikling' | 'missing_taf_indtaegter'): EoInvariant => ({
  id: `taf_per_year:${reason}`,
  passed: false,
  severity: 'error',
  source: 'system',
  message: reason === 'missing_loenudvikling'
    ? 'TAF fordelt på år kan ikke genereres, fordi lønudvikling ikke kunne beregnes autoritativt.'
    : 'TAF fordelt på år kan ikke genereres, fordi indtægter i TAF-perioden ikke kunne beregnes autoritativt.',
  blocksAuthoritativeComputation: false,
  blocksOutputs: ['taf_per_year_pdf', 'taf_per_year_opreguleret_pdf'],
});

export const buildControlMismatchInvariant = (messages: readonly string[]): EoInvariant => ({
  id: 'control:sammentaelling_mismatch',
  passed: false,
  severity: 'error',
  source: 'system',
  message: 'Der er konstateret kontroluoverensstemmelser i EO-beregningen.',
  evidence: messages,
  blocksAuthoritativeComputation: false,
  blocksOutputs: ['eo_pdf', 'taf_per_year_pdf', 'taf_per_year_opreguleret_pdf'],
});


export const hasAuthoritativeBlockingInvariant = (invariants: readonly EoInvariant[]): boolean =>
  invariants.some((invariant) => !invariant.passed && invariant.severity === 'error' && invariant.blocksAuthoritativeComputation);

export const getAuthoritativeBlockingInvariants = (
  invariants: readonly EoInvariant[]
): readonly EoInvariant[] => {
  return invariants.filter(
    (invariant) => !invariant.passed && invariant.severity === 'error' && invariant.blocksAuthoritativeComputation
  );
};

export const hasAnyErrorInvariant = (invariants: readonly EoInvariant[]): boolean =>
  invariants.some((invariant) => !invariant.passed && invariant.severity === 'error');

export const hasAnyWarningInvariant = (invariants: readonly EoInvariant[]): boolean =>
  invariants.some((invariant) => !invariant.passed && invariant.severity === 'warning');

export const getBlockingInvariantsForOutput = (
  invariants: readonly EoInvariant[],
  target: EoProjectionTarget
): readonly EoInvariant[] => {
  return invariants.filter((invariant) =>
    !invariant.passed && invariant.severity === 'error' && (invariant.blocksOutputs ?? []).includes(target)
  );
};

export const buildBlockingMessageForOutput = (
  invariants: readonly EoInvariant[],
  target: EoProjectionTarget,
  fallback: string
): string => {
  const messages = getBlockingInvariantsForOutput(invariants, target).map((invariant) => invariant.message);
  if (messages.length === 0) return fallback;
  return messages.join('; ');
};

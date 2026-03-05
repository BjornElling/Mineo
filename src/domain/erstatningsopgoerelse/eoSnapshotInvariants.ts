import type { ValidationError } from '../../types/validation';
import type { MoneyOre } from './eoPdfModel';
import {
  TAF_BOUNDS_ERROR_MESSAGE_BASE,
  TAF_OVERLAP_ERROR_MESSAGE,
} from '../../validators/erstatningsopgoerelseValidator';

export type EoProjectionTarget = 'beregning' | 'debug' | 'eo_pdf' | 'taf_per_year_pdf';

export type EoInvariant = Readonly<{
  id: string;
  passed: boolean;
  severity: 'warning' | 'error';
  message: string;
  evidence?: ReadonlyArray<string>;
  blocksAuthoritativeComputation?: boolean;
  blocksOutputs?: ReadonlyArray<EoProjectionTarget>;
}>;

const VALIDATION_BLOCKED_OUTPUTS: readonly EoProjectionTarget[] = ['beregning', 'debug', 'eo_pdf', 'taf_per_year_pdf'];

const buildValidationInvariantId = (error: ValidationError, index: number): string => {
  const path = error.path ?? `${index}`;
  if (error.message === TAF_OVERLAP_ERROR_MESSAGE) {
    return `taf_perioder:overlap:${path}`;
  }
  if (error.message.startsWith(TAF_BOUNDS_ERROR_MESSAGE_BASE)) {
    return `taf_perioder:bounds:${path}`;
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
    message: error.message,
    evidence: error.path ? [error.path] : undefined,
    blocksAuthoritativeComputation: error.severity !== 'warning',
    blocksOutputs: error.severity === 'warning' ? [] : VALIDATION_BLOCKED_OUTPUTS,
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
  message: 'TAF fordelt på år kan ikke afstemmes inden for 1 kr.',
  evidence: [
    `Afrunding: ${args.afrundingOre}`,
    `Årssum: ${args.sumYearTafOre}`,
    `Samlet TAF-krav: ${args.samletTafKravOre}`,
  ],
  blocksOutputs: ['taf_per_year_pdf'],
});

export const buildTafPerYearUnavailableInvariant = (reason: 'missing_loenudvikling' | 'missing_taf_indtaegter'): EoInvariant => ({
  id: `taf_per_year:${reason}`,
  passed: false,
  severity: 'error',
  message: reason === 'missing_loenudvikling'
    ? 'TAF fordelt på år kan ikke genereres, fordi lønudvikling ikke kunne beregnes autoritativt.'
    : 'TAF fordelt på år kan ikke genereres, fordi indtægter i TAF-perioden ikke kunne beregnes autoritativt.',
  blocksOutputs: ['taf_per_year_pdf'],
});

export const buildControlMismatchInvariant = (messages: readonly string[]): EoInvariant => ({
  id: 'debug:control_mismatch',
  passed: false,
  severity: 'error',
  message: 'Der er konstateret kontroluoverensstemmelser i EO-beregningen.',
  evidence: messages,
  blocksOutputs: ['eo_pdf', 'taf_per_year_pdf'],
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

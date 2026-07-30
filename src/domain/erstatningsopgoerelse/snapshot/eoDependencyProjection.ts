import type { FieldIssue } from '../../../inputCore/inputIssue';
import type {
  ErstatningsopgoerelseValues,
} from '../../../schemas/formSchemas';
import type { SvieSmerteEngineInputSnapshot } from '../engines/svieSmerteEngine';
import type { ForligAnsvarsgradInput } from '../engines/forligsgrad';
import type { TafCalculationStamdata, TafCalculationValues } from '../engines/tafCalculationInput';

/**
 * Issue-sættene fra de konkrete reader-projektioner, der bygger hver beregningsgrens input.
 * Sættene er output fra `createTrackedInputReader`; de vedligeholdes derfor ikke som felt-ID-metadata.
 */
export type EoDependencyProjection = Readonly<{
  svieSmerteInput?: SvieSmerteEngineInputSnapshot;
  forligInput?: ForligAnsvarsgradInput;
  tafInput?: Readonly<{
    values: TafCalculationValues;
    stamdata: TafCalculationStamdata;
  }>;
  oevrigeKravInput?: Pick<
    ErstatningsopgoerelseValues,
    'kravPaaOevrigeErstatningskrav' | 'oevrigeKravPerioder'
  >;
  svieSmerteIssues: readonly FieldIssue[];
  forligIssues: readonly FieldIssue[];
  tafIssues: readonly FieldIssue[];
  oevrigeKravIssues: readonly FieldIssue[];
  aggregateIssues: readonly FieldIssue[];
}>;

export type EoBlockedDependencies = Readonly<{
  svieSmerte: boolean;
  forlig: boolean;
  taf: boolean;
  oevrigeKrav: boolean;
  aggregate: boolean;
}>;

export const EMPTY_EO_DEPENDENCY_PROJECTION: EoDependencyProjection = Object.freeze({
  svieSmerteIssues: Object.freeze([]),
  forligIssues: Object.freeze([]),
  tafIssues: Object.freeze([]),
  oevrigeKravIssues: Object.freeze([]),
  aggregateIssues: Object.freeze([]),
});

export const resolveEoBlockedDependencies = (
  projection: EoDependencyProjection
): EoBlockedDependencies => Object.freeze({
  svieSmerte: projection.svieSmerteIssues.length > 0,
  forlig: projection.forligIssues.length > 0,
  taf: projection.tafIssues.length > 0,
  oevrigeKrav: projection.oevrigeKravIssues.length > 0,
  aggregate: projection.aggregateIssues.length > 0,
});

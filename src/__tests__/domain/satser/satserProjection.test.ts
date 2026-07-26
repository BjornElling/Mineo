import {
  reduceInputCommand,
  settleField,
  createInputEvaluation,
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
  type SettledInput,
} from '../../../inputCore';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import { satserAargangField } from '../../../inputCore/catalog/satserDescriptors';
import { satserAngivAarYearBounds, getSatserForYear } from '../../../data/lovbestemteRates';
import { projectSatser } from '../../../domain/satser/satserProjection';

// Greenfield Satser-projektion (§3.4/§3.9, Fase 3-slice): den rene reader-projektion erstatter den legacy
// den slettede legacyprojektion. Beviser de tre tilstande (§1.6/§1.7) og at ready-data == getSatserForYear.

const catalog = getProductionInputCatalog();
const token = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));
const aargangRef = satserAargangField.bind();
const { minYear, maxYear } = satserAngivAarYearBounds;
const midYear = Math.floor((minYear + maxYear) / 2);

const empty = (): SettledInput => catalog.validateSettledInput({
  sections: {
    stamdata: null, satser: null, aarsloen: null, faellesAarsloen: null, renteberegning: null,
    varigemen: null, forsoergertab: null, erstatningsopgoerelse: null, erhvervsevnetab: null,
  },
  rejectedInputs: {},
});

const settle = (input: SettledInput, raw: string): SettledInput => {
  const result = reduceInputCommand(input, settleField(aargangRef, raw), catalog);
  return result.changed ? result.input : input;
};

const project = (input: SettledInput) =>
  projectSatser(createInputEvaluation({ input, catalog, sourceToken: token }).reader);

describe('projectSatser (greenfield reader-projektion)', () => {
  it('tomt satsår → blocked (missing consumerfejl, §1.7)', () => {
    const result = project(empty());
    expect(result.status).toBe('blocked');
    if (result.status === 'blocked') {
      expect(result.issues.some((i) => i.kind === 'consumer' && i.reason === 'missing')).toBe(true);
    }
  });

  it.each([
    ['minYear', minYear],
    ['midt', midYear],
    ['maxYear', maxYear],
  ])('gyldigt år (%s) → ready med { year, satser } == getSatserForYear', (_name, year) => {
    const result = project(settle(empty(), String(year)));
    expect(result.status).toBe('ready');
    if (result.status === 'ready') {
      expect(result.value.year).toBe(year);
      expect(result.value.satser).toEqual(getSatserForYear(year));
    }
  });

  it.each([
    ['under interval', minYear - 1],
    ['over interval', maxYear + 1],
  ])('år %s → canonical men blocked med rødt bounds-feltissue, samme consumer-gate som formatfejl (§1.6)', (_name, year) => {
    const state = settle(empty(), String(year));
    // Efter kravændringen 2026-07-18 er et out-of-bounds satsår canonical (kan gemmes i .eo), men en
    // bounds-feltvalidator giver et rødt issue, som readeren skjuler → projektionen blokerer ligesom format.
    expect(state.sections.satser?.aargang).toBe(year);
    expect(Object.keys(state.rejectedInputs)).toHaveLength(0);
    const result = project(state);
    expect(result.status).toBe('blocked');
    if (result.status === 'blocked') {
      const fieldIssue = result.issues.find((i) => i.kind === 'field');
      expect(fieldIssue?.kind).toBe('field');
      expect(fieldIssue && 'reason' in fieldIssue ? fieldIssue.reason : undefined).toBe('bounds');
    }
  });

  it('ugyldigt format → blocked med rødt feltissue (format), identisk consumer-gate som bounds', () => {
    const result = project(settle(empty(), 'abc'));
    expect(result.status).toBe('blocked');
    if (result.status === 'blocked') {
      const fieldIssue = result.issues.find((i) => i.kind === 'field');
      expect(fieldIssue && 'reason' in fieldIssue ? fieldIssue.reason : undefined).toBe('format');
    }
  });

  it('ugyldigt settle efterlader ikke en tidligere gyldig værdi synlig for projektionen (§1.5)', () => {
    const valid = settle(empty(), String(midYear));
    expect(project(valid).status).toBe('ready');
    const invalidated = settle(valid, 'abc');
    // Den tidligere gyldige værdi må ALDRIG nå projektionen bag den røde fejl.
    const result = project(invalidated);
    expect(result.status).toBe('blocked');
  });
});

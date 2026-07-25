/**
 * Ækvivalens-test for flytningen af Årsløns download-gates fra `src/hooks/useAarsloenDocumentGates.ts`
 * til domænelaget (Fase 5, pass 4).
 *
 * Flytningen ændrede INPUTTET (komponent-samlet `AarsloenDocumentSnapshot` →
 * `AarsloenReaderProjection`), ikke REGLERNE. Denne test er beviset: for hvert scenarie køres den
 * gamle og den nye implementering på samme tilstand, og deres `canDownload` + første årsagskode skal
 * være identiske.
 *
 * Testen findes, fordi "reglerne er bevaret 1:1" ellers kun er en påstand i en kommentar. Den bør
 * SLETTES sammen med `useAarsloenDocumentGates`, når den gamle sti fjernes i pass 7 — indtil da er
 * den det eneste sted, de to implementeringer holdes op mod hinanden.
 */
import {
  resolveAarsloenDocumentEligibility,
  resolveShDageDocumentEligibility,
  type AarsloenDocumentSnapshot,
} from '../../../hooks/useAarsloenDocumentGates';
import {
  evaluateAarsloenDownloadGate,
  evaluateShDageDownloadGate,
} from '../../../domain/aarsloen/aarsloenDownloadGate';
import type { AarsloenReaderProjection } from '../../../domain/aarsloen/aarsloenProjection';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
  type ProjectionResult,
} from '../../../inputCore';
import type { AarsloenValues, StamdataValues } from '../../../schemas/formSchemas';
import { DEFAULT_APP_SETTINGS } from '../../../settings/appSettingsSchema';
import type { AarsloenBeregningResult } from '../../../types/calculation';
import type { PeriodeResult } from '../../../utils/periodeBeregning';
import type { TableError } from '../../../types/table';

const sourceToken = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));

const readyStamdata: ProjectionResult<StamdataValues> = Object.freeze({
  status: 'ready',
  value: {} as StamdataValues,
  issues: [],
  warnings: [],
  sourceToken,
});
const blockedStamdata: ProjectionResult<StamdataValues> = Object.freeze({
  status: 'blocked',
  issues: [{ code: 'stamdata.x', message: 'Stamdata indeholder fejl', severity: 'error' }],
  warnings: [],
  sourceToken,
} as unknown as ProjectionResult<StamdataValues>);

const beregningsData = {} as AarsloenBeregningResult;

/**
 * En række, der faktisk opfylder `hasAtLeastOneValidRow` for `loenperiode: 'maaned'`:
 * `hasCompletePeriodForLoenperiode` kræver både `col0_maaned` og `col1_maaned` udfyldt, og den
 * afledte `samlet` skal være forskellig fra 0 (`standardLoenRowCalculations.ts:363-379`).
 */
const validRow = {
  id: 'r1',
  col0_maaned: { kind: 'number', value: 1 },
  col1_maaned: { kind: 'number', value: 12 },
  col2: { kind: 'number', value: 30_000 },
} as unknown as AarsloenValues['tableData'][number];

type Scenario = Readonly<{
  name: string;
  values: Partial<AarsloenValues>;
  omregningAktiveret: boolean;
  periodeData: PeriodeResult | null;
  shDageAntal: number | null;
  harFatalBeregningsFejl: boolean;
  tableErrors: readonly TableError[];
  stamdata: ProjectionResult<StamdataValues>;
  /** Nyt: projektionen har ingen beregning, når feltgaten er rød (§3.9). */
  calculationIsNull?: boolean;
}>;

const baseValues = {
  tableData: [validRow],
  loenperiode: 'maaned',
  tillaegAngivesSom: 'procent',
  feriePct: 12.5,
  fritvalgPct: 0,
  shSoPct: 0,
  storeBededagPct: 0,
  pensionPct: 0,
  fuldLoenUnderFerie: 'Ja',
  retTilSjetteFerieuge: 'Nej',
  antalFeriedage: 25,
  loenPaaHelligdage: 'Almindelig løn',
  omregningTilFuldtAar: false,
} as unknown as AarsloenValues;

const SCENARIOS: readonly Scenario[] = [
  {
    name: 'alt gyldigt',
    values: {},
    omregningAktiveret: false,
    periodeData: null,
    shDageAntal: 5,
    harFatalBeregningsFejl: false,
    tableErrors: [],
    stamdata: readyStamdata,
  },
  {
    name: 'stamdata blokeret',
    values: {},
    omregningAktiveret: false,
    periodeData: null,
    shDageAntal: 5,
    harFatalBeregningsFejl: false,
    tableErrors: [],
    stamdata: blockedStamdata,
  },
  {
    name: 'tom tabel',
    values: { tableData: [] },
    omregningAktiveret: false,
    periodeData: null,
    shDageAntal: 5,
    harFatalBeregningsFejl: false,
    tableErrors: [],
    stamdata: readyStamdata,
  },
  {
    name: 'tabel-valideringsfejl',
    values: {},
    omregningAktiveret: false,
    periodeData: null,
    shDageAntal: 5,
    harFatalBeregningsFejl: false,
    tableErrors: [{ kind: 'cell', rowId: 'r1', columnKey: 'beloeb', message: 'fejl' } as unknown as TableError],
    stamdata: readyStamdata,
  },
  {
    name: 'fatal beregningsfejl',
    values: {},
    omregningAktiveret: false,
    periodeData: null,
    shDageAntal: 5,
    harFatalBeregningsFejl: true,
    tableErrors: [],
    stamdata: readyStamdata,
  },
  {
    name: 'omregning aktiv uden periodedata',
    values: {},
    omregningAktiveret: true,
    periodeData: null,
    shDageAntal: 5,
    harFatalBeregningsFejl: false,
    tableErrors: [],
    stamdata: readyStamdata,
  },
  {
    name: 'sh-dage: nul dage',
    values: {},
    omregningAktiveret: false,
    periodeData: { perioder: [] } as unknown as PeriodeResult,
    shDageAntal: 0,
    harFatalBeregningsFejl: false,
    tableErrors: [],
    stamdata: readyStamdata,
  },
  {
    name: 'sh-dage: antal ikke beregnet',
    values: {},
    omregningAktiveret: false,
    periodeData: { perioder: [] } as unknown as PeriodeResult,
    shDageAntal: null,
    harFatalBeregningsFejl: false,
    tableErrors: [],
    stamdata: readyStamdata,
  },
  {
    name: 'sh-dage: periodedata findes',
    values: {},
    omregningAktiveret: false,
    periodeData: { perioder: [] } as unknown as PeriodeResult,
    shDageAntal: 3,
    harFatalBeregningsFejl: false,
    tableErrors: [],
    stamdata: readyStamdata,
  },
];

const toSnapshot = (scenario: Scenario): AarsloenDocumentSnapshot => ({
  values: { ...baseValues, ...scenario.values } as AarsloenValues,
  omregningAktiveret: scenario.omregningAktiveret,
  periodeData: scenario.periodeData,
  shDageAntal: scenario.shDageAntal,
  beregnetAarsloen: 360_000,
  beregningsData,
  harFatalBeregningsFejl: scenario.harFatalBeregningsFejl,
  tableErrors: scenario.tableErrors,
  stamdataProjection: scenario.stamdata,
  settings: DEFAULT_APP_SETTINGS,
  isSourceCurrent: () => true,
});

const toProjection = (scenario: Scenario): AarsloenReaderProjection => ({
  values: { ...baseValues, ...scenario.values } as AarsloenValues,
  tableValidation: { summary: {}, errors: [...scenario.tableErrors] } as AarsloenReaderProjection['tableValidation'],
  omregningGate: {
    effectiveEnabled: scenario.omregningAktiveret,
  } as AarsloenReaderProjection['omregningGate'],
  calculation: scenario.calculationIsNull === true
    ? null
    : {
      periodeData: scenario.periodeData,
      shDageAntal: scenario.shDageAntal,
      beregnetAarsloen: 360_000,
      beregningsData,
      fejlmeddelelser: [],
      beregningsFejl: null,
      harFatalBeregningsFejl: scenario.harFatalBeregningsFejl,
    },
  fieldIssues: [],
  documentStamdata: scenario.stamdata,
  sourceToken,
});

describe('Årsløn-download-gates: gammel snapshot-gate ≡ ny projektions-gate', () => {
  it.each(SCENARIOS.map((s) => [s.name, s] as const))(
    'årsløn-gaten giver samme udfald for: %s',
    (_name, scenario) => {
      const gammel = resolveAarsloenDocumentEligibility(toSnapshot(scenario));
      const ny = evaluateAarsloenDownloadGate(toProjection(scenario));

      expect(ny.canDownload).toBe(gammel.canDownload);
      expect(ny.reasons[0]?.code).toBe(gammel.reasons[0]?.code);
      expect(ny.reasons[0]?.message).toBe(gammel.reasons[0]?.message);
    }
  );

  it.each(SCENARIOS.map((s) => [s.name, s] as const))(
    'sh-dage-gaten giver samme udfald for: %s',
    (_name, scenario) => {
      const gammel = resolveShDageDocumentEligibility(toSnapshot(scenario));
      const ny = evaluateShDageDownloadGate(toProjection(scenario));

      expect(ny.canDownload).toBe(gammel.canDownload);
      expect(ny.reasons[0]?.code).toBe(gammel.reasons[0]?.code);
      expect(ny.reasons[0]?.message).toBe(gammel.reasons[0]?.message);
    }
  );

  /**
   * Den ENE bevidste forskel: den gamle gate fik altid et forsøgt beregningsresultat, mens
   * projektionen sætter `calculation = null`, når feltgaten er rød (§3.9 — motoren kaldes ikke).
   * Den nye gate skal da blokere med `fatal-calculation-error`, som er den samme klasse, den gamle
   * gate ramte via `harFatalBeregningsFejl`.
   */
  it('blokerer med fatal-calculation-error, når projektionen ikke har nogen beregning', () => {
    const scenario: Scenario = { ...SCENARIOS[0], calculationIsNull: true };
    const ny = evaluateAarsloenDownloadGate(toProjection(scenario));
    expect(ny.canDownload).toBe(false);
    expect(ny.reasons[0]?.code).toBe('aarsloen:fatal-calculation-error');
  });
});

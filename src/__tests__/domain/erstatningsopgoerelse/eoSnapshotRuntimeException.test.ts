import { computeEoSnapshot } from '../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { toISODateString } from '../../../types/branded';

/**
 * Runtime-exception-stien i computeEoSnapshot.
 *
 * `eoSnapshot.test.ts` dækker schema_guard- og invariant_guard-fail-closed, men
 * kunne IKKE udløse selve catch-blokken (runtime_exception) udefra. Her tvinger vi
 * en engine inde i try-blokken til at kaste, og hævder fail-closed-kontrakten:
 * status='fail_closed', failClosedReason='runtime_exception', data=null, en
 * blokerende system-invariant, og at fejlen rapporteres via systemIssueReporter.
 *
 * computeTafNettoBeregning kaldes præcis ét sted – inde i try-blokken (eoSnapshot.ts:316)
 * – så et kast derfra rammer garanteret catch-stien (og ikke en tidligere gren).
 */

const { reportSystemIssueMock } = vi.hoisted(() => ({
  reportSystemIssueMock: vi.fn(),
}));

vi.mock('../../../utils/systemIssueReporter', () => ({
  reportSystemIssue: reportSystemIssueMock,
}));

vi.mock('../../../domain/erstatningsopgoerelse/engines/tafNettoBeregning', () => ({
  computeTafNettoBeregning: () => {
    throw new Error('Injiceret engine-fejl');
  },
}));

describe('computeEoSnapshot – runtime_exception fail-closed', () => {
  beforeEach(() => {
    reportSystemIssueMock.mockReset();
  });

  const buildValidArgs = () => {
    const eoValues = createErstatningsopgoerelseInitialValues();
    eoValues.vedroererPeriodeFra = toISODateString('2024-01-01');
    eoValues.vedroererPeriodeTil = toISODateString('2024-06-30');
    eoValues.tafBeregningsperiodeFra = toISODateString('2023-01-01');
    eoValues.tafBeregningsperiodeTil = toISODateString('2023-12-31');
    return {
      revision: 'runtime-exception-test',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues,
    };
  };

  it('engine-kast inde i try-blokken giver fail-closed med failClosedReason="runtime_exception"', () => {
    const snapshot = computeEoSnapshot(buildValidArgs());

    expect(snapshot.status).toBe('fail_closed');
    expect(snapshot.failClosedReason).toBe('runtime_exception');
    expect(snapshot.data).toBeNull();
  });

  it('producerer en blokerende system-invariant der spærrer alle autoritative outputs', () => {
    const snapshot = computeEoSnapshot(buildValidArgs());

    const runtimeInv = snapshot.invariants.find((inv) => inv.id === 'runtime_exception');
    expect(runtimeInv).toBeDefined();
    expect(runtimeInv!.passed).toBe(false);
    expect(runtimeInv!.severity).toBe('error');
    expect(runtimeInv!.source).toBe('system');
    expect(runtimeInv!.blocksAuthoritativeComputation).toBe(true);
    expect(runtimeInv!.blocksOutputs).toEqual(
      expect.arrayContaining(['beregning', 'inspektion', 'eo_pdf', 'taf_per_year_pdf'])
    );
    // Evidensen indeholder den faktiske fejlbesked (auditbarhed).
    expect(runtimeInv!.evidence).toContain('Injiceret engine-fejl');
  });

  it('rapporterer fejlen via systemIssueReporter med korrekt kode/område', () => {
    computeEoSnapshot(buildValidArgs());

    expect(reportSystemIssueMock).toHaveBeenCalledTimes(1);
    const call = reportSystemIssueMock.mock.calls[0]![0];
    expect(call.code).toBe('eo_snapshot:runtime_exception');
    expect(call.area).toBe('eo');
  });

  it('bevarer input-feltet (skadedata stadig tilgængeligt for fejl-UI)', () => {
    const snapshot = computeEoSnapshot(buildValidArgs());
    expect(snapshot.input.stamdata).not.toBeNull();
    expect(snapshot.input.erstatningsopgoerelse).not.toBeNull();
  });
});

import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';

/**
 * Valideringsfejl-grenen i `computeEoSnapshot` beregner stadig kontrolvisningens uafhængige grene (S/S-motoren,
 * TAF-ranges, kontrol-snapshot). Grenen lå tidligere uden for try-blokken, så en undtagelse dér væltede hele
 * Erstatningsopgørelse-siden i stedet for at ende i den kontrollerede `runtime_exception`-tilstand.
 */

const { reportSystemIssueMock, svieSmerteThrowFlag } = vi.hoisted(() => ({
  reportSystemIssueMock: vi.fn(),
  svieSmerteThrowFlag: { shouldThrow: false },
}));

vi.mock('../../../utils/systemIssueReporter', () => ({
  reportSystemIssue: reportSystemIssueMock,
}));

vi.mock('../../../domain/erstatningsopgoerelse/engines/svieSmerteEngine', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../domain/erstatningsopgoerelse/engines/svieSmerteEngine')>();
  return {
    ...actual,
    computeSvieSmerteEngine: (...args: Parameters<typeof actual.computeSvieSmerteEngine>) => {
      if (svieSmerteThrowFlag.shouldThrow) throw new Error('Injiceret S/S-fejl i valideringsfejl-grenen');
      return actual.computeSvieSmerteEngine(...args);
    },
  };
});

const { computeEoSnapshot } = await import('../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot');

describe('computeEoSnapshot – undtagelse i valideringsfejl-grenen', () => {
  afterEach(() => {
    svieSmerteThrowFlag.shouldThrow = false;
    reportSystemIssueMock.mockReset();
  });

  it('fail-closer kontrolleret i stedet for at kaste ud af snapshot-beregningen', () => {
    const args = {
      revision: 'validation-branch',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues: createErstatningsopgoerelseInitialValues(),
    };
    // Kontrol: den tomme sag lander i valideringsfejl-grenen og kører dér S/S-motoren.
    expect(computeEoSnapshot(args).status).toBe('error');

    svieSmerteThrowFlag.shouldThrow = true;
    const snapshot = computeEoSnapshot(args);

    expect(snapshot.status).toBe('fail_closed');
    expect(snapshot.failClosedReason).toBe('runtime_exception');
    expect(snapshot.data).toBeNull();
    expect(snapshot.inspektionSnapshot).toBeNull();
    expect(reportSystemIssueMock).toHaveBeenCalledWith(expect.objectContaining({
      code: 'eo_snapshot:runtime_exception',
      context: 'eoSnapshot.computeEoSnapshot',
    }));
  });
});

import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { toISODateString } from '../../../types/branded';

const { reportSystemIssueMock, pdfModelThrowFlag } = vi.hoisted(() => ({
  reportSystemIssueMock: vi.fn(),
  pdfModelThrowFlag: { shouldThrow: false },
}));

vi.mock('../../../utils/systemIssueReporter', () => ({
  reportSystemIssue: reportSystemIssueMock,
}));

// Vi mocker KUN buildErstatningsopgoerelsePdfModelFromComputed til at kaste. Den kaldes i
// computeEoSnapshot's try-blok EFTER debugSnapshot allerede er bygget — derved rammer vi præcist
// den sti hvor en delvist bygget debugSnapshot eksisterer, når runtime-exception fail-close indtræffer.
// Alle øvrige exports (bl.a. buildEoPdfPresentation, som kaldes før debugSnapshot) bevares uændret.
vi.mock('../../../domain/erstatningsopgoerelse/snapshot/eoPresentationModel', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../domain/erstatningsopgoerelse/snapshot/eoPresentationModel')>();
  return {
    ...actual,
    buildErstatningsopgoerelsePdfModelFromComputed: (...args: Parameters<typeof actual.buildErstatningsopgoerelsePdfModelFromComputed>) => {
      if (pdfModelThrowFlag.shouldThrow) {
        throw new Error('Forceret PDF-model-fejl til runtime_exception-test');
      }
      return actual.buildErstatningsopgoerelsePdfModelFromComputed(...args);
    },
  };
});

// Importeres efter mocks, så den mockede modul-binding er aktiv.
const { computeEoSnapshot } = await import('../../../domain/erstatningsopgoerelse/snapshot/eoSnapshot');

const buildValidEoValues = () => {
  const eoValues = createErstatningsopgoerelseInitialValues();
  eoValues.vedroererPeriodeFra = toISODateString('2024-01-01');
  eoValues.vedroererPeriodeTil = toISODateString('2024-12-31');
  eoValues.tafBeregningsperiodeFra = toISODateString('2023-01-01');
  eoValues.tafBeregningsperiodeTil = toISODateString('2023-12-31');
  return eoValues;
};

describe('computeEoSnapshot — runtime_exception fail-close', () => {
  afterEach(() => {
    pdfModelThrowFlag.shouldThrow = false;
    reportSystemIssueMock.mockReset();
  });

  it('nulstiller debugSnapshot i fail_closed-stien selv når den allerede var bygget (kontrakt §2.4)', () => {
    // Kontroltilfælde: uden forceret fejl bygges snapshot normalt med debugSnapshot.
    pdfModelThrowFlag.shouldThrow = false;
    const control = computeEoSnapshot({
      revision: 'runtime-control',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues: buildValidEoValues(),
    });
    expect(control.status).not.toBe('fail_closed');
    expect(control.debugSnapshot).not.toBeNull();

    // Forceret runtime-exception EFTER debugSnapshot er bygget.
    pdfModelThrowFlag.shouldThrow = true;
    const snapshot = computeEoSnapshot({
      revision: 'runtime-throw',
      stamdataValues: STAMDATA_INITIAL_VALUES,
      eoValues: buildValidEoValues(),
    });

    expect(snapshot.status).toBe('fail_closed');
    expect(snapshot.failClosedReason).toBe('runtime_exception');
    expect(snapshot.data).toBeNull();
    // Kontrakt §2.4: debugSnapshot er null i fail_closed — også selvom den nåede at blive bygget.
    expect(snapshot.debugSnapshot).toBeNull();
    expect(snapshot.invariants.some((invariant) => invariant.id === 'runtime_exception')).toBe(true);
    expect(reportSystemIssueMock).toHaveBeenCalledWith(
      expect.objectContaining({
        code: 'eo_snapshot:runtime_exception',
        context: 'eoSnapshot.computeEoSnapshot',
        revision: 'runtime-throw',
        // Diagnostik registrerer at en debugSnapshot var bygget, selvom resultatet nulstiller den.
        diagnostics: expect.objectContaining({ debugSnapshotAvailable: true }),
      })
    );
  });
});

// @vitest-environment jsdom
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import {
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
} from '../../../inputCore/evaluationSource';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import { toISODateString } from '../../../types/branded';

/**
 * Reader-projektionens feltissue-led kører FØR `computeEoSnapshot` og dermed uden for dens fail-closed-blok. En
 * undtagelse her skal give samme kontrollerede tilstand som en motorfejl, ikke vælte Erstatningsopgørelse-siden.
 */

const { reportSystemIssueMock, collectorThrowFlag, ratesThrowFlag } = vi.hoisted(() => ({
  reportSystemIssueMock: vi.fn(),
  collectorThrowFlag: { shouldThrow: false },
  ratesThrowFlag: { shouldThrow: false },
}));

vi.mock('../../../domain/erstatningsopgoerelse/loenindkomstSatsProjection', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../domain/erstatningsopgoerelse/loenindkomstSatsProjection')>();
  return {
    ...actual,
    projectLoenindkomstSatser: (...args: Parameters<typeof actual.projectLoenindkomstSatser>) => {
      if (ratesThrowFlag.shouldThrow) throw new Error('Injiceret fejl i satsprojektionen');
      return actual.projectLoenindkomstSatser(...args);
    },
  };
});

vi.mock('../../../utils/systemIssueReporter', () => ({
  reportSystemIssue: reportSystemIssueMock,
}));

vi.mock('../../../domain/erstatningsopgoerelse/tafRowCellIssues', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../domain/erstatningsopgoerelse/tafRowCellIssues')>();
  return {
    ...actual,
    collectTafRowCellIssues: (...args: Parameters<typeof actual.collectTafRowCellIssues>) => {
      if (collectorThrowFlag.shouldThrow) throw new Error('Injiceret fejl i TAF-cellernes feltissues');
      return actual.collectTafRowCellIssues(...args);
    },
  };
});

const { buildErstatningsopgoerelseReaderProjection } = await import(
  '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseReaderProjection'
);

const catalog = getProductionInputCatalog();

const buildReader = () => {
  const eo = createErstatningsopgoerelseInitialValues();
  eo.eoNummer = 'EO-1';
  eo.tafBeregningsperiodeFra = toISODateString('2023-01-01');
  eo.forligAnsvarsgradProcent = 150;
  const input = catalog.validateSettledInput({
    sections: {
      stamdata: STAMDATA_INITIAL_VALUES, satser: null, aarsloen: null, faellesAarsloen: null, renteberegning: null,
      varigemen: null, forsoergertab: null, erstatningsopgoerelse: eo, erhvervsevnetab: null,
    },
    rejectedInputs: {},
  });
  const sourceToken = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));
  return createInputEvaluation({ input, catalog, sourceToken }).reader;
};

describe('buildErstatningsopgoerelseReaderProjection – undtagelse før snapshot-beregningen', () => {
  afterEach(() => {
    collectorThrowFlag.shouldThrow = false;
    ratesThrowFlag.shouldThrow = false;
    reportSystemIssueMock.mockReset();
  });

  it('bevarer læste input og feltissues, når satsprojektionen kaster', () => {
    ratesThrowFlag.shouldThrow = true;

    const projection = buildErstatningsopgoerelseReaderProjection(buildReader(), { revision: 'rates-throw' });

    expect(projection.snapshot.status).toBe('fail_closed');
    expect(projection.snapshot.failClosedReason).toBe('runtime_exception');
    expect(projection.snapshot.data).toBeNull();
    expect(projection.snapshot.inspektionSnapshot).toBeNull();
    expect(projection.eoValues.eoNummer).toBe('EO-1');
    expect(projection.eoValues.tafBeregningsperiodeFra).toBe('2023-01-01');
    expect(projection.eoValues.forligAnsvarsgradProcent).toBeUndefined();
    expect(projection.eoErrors.all).toEqual(expect.arrayContaining([
      expect.objectContaining({ code: 'eo.forligAnsvarsgradProcent.bounds', reason: 'bounds' }),
    ]));
    expect(reportSystemIssueMock).toHaveBeenCalledWith(expect.objectContaining({
      code: 'eo_snapshot:runtime_exception',
      context: 'erstatningsopgoerelseReaderProjection',
    }));
  });

  it('returnerer en fail-closed projektion med de læste værdier i stedet for at kaste', () => {
    collectorThrowFlag.shouldThrow = true;

    const projection = buildErstatningsopgoerelseReaderProjection(buildReader(), { revision: 'collector-throw' });

    expect(projection.snapshot.status).toBe('fail_closed');
    expect(projection.snapshot.failClosedReason).toBe('runtime_exception');
    expect(projection.snapshot.revision).toBe('collector-throw');
    expect(projection.snapshot.data).toBeNull();
    // Fanerne kan stadig vise brugerens indtastninger.
    expect(projection.eoValues.eoNummer).toBe('EO-1');
    expect(projection.eoValues.tafBeregningsperiodeFra).toBe('2023-01-01');
    expect(projection.tafCellIssues.all).toEqual([]);
    expect(reportSystemIssueMock).toHaveBeenCalledWith(expect.objectContaining({
      code: 'eo_snapshot:runtime_exception',
      context: 'erstatningsopgoerelseReaderProjection',
    }));
  });
});

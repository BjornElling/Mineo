import type { ErhvervsevnetabComposedValues } from '../../../schemas/formSchemas';
import { ERHVERVSEVNETAB_INITIAL_VALUES } from '../../../domain/erhvervsevnetab/erhvervsevnetabInitialValues';
import { FAELLES_AARSLOEN_INITIAL_VALUES } from '../../../domain/aslEalAarsloen/faellesAarsloenInitialValues';
import {
  computeEetLoebendeYdelser,
} from '../../../domain/erhvervsevnetab/eetLoebendeYdelserCalculation';
import {
  buildEetImportContext,
  buildUnavailableEetImportContext,
  type EetImportSource,
} from '../../../domain/erhvervsevnetab/eetImportPort';
import { aarsloenAslMax } from '../../../data/lovbestemteRates';
import { toISODateString } from '../../../types/branded';

const { computeImportMock, reportSystemIssueMock } = vi.hoisted(() => ({
  computeImportMock: vi.fn(),
  reportSystemIssueMock: vi.fn(),
}));

vi.mock('../../../domain/erhvervsevnetab/eetLoebendeYdelserCalculation', async () => {
  const actual = await vi.importActual<typeof import('../../../domain/erhvervsevnetab/eetLoebendeYdelserCalculation')>(
    '../../../domain/erhvervsevnetab/eetLoebendeYdelserCalculation'
  );
  return { ...actual, computeEetLoebendeYdelserForEoImport: computeImportMock };
});

vi.mock('../../../utils/systemIssueReporter', () => ({
  reportSystemIssue: reportSystemIssueMock,
}));

const buildValues = (): ErhvervsevnetabComposedValues => ({
  ...ERHVERVSEVNETAB_INITIAL_VALUES,
  ...FAELLES_AARSLOEN_INITIAL_VALUES,
  beregningsdato: toISODateString('2026-03-19'),
  skadelidteFodselsdato: toISODateString('1980-01-01'),
  aslAarsloen: { kind: 'number', value: aarsloenAslMax[2019]! },
  aslAfgoerelser: [{
    id: 'eet-import-runtime',
    afgoerelsesDato: toISODateString('2026-02-01'),
    virkningsDato: toISODateString('2026-02-01'),
    eetPct: 15,
    kapDato: undefined,
    kapPct: undefined,
    afgoerelseType: 'Midlertidig',
    fsTilbageholdtEet: 'Nej',
    tidlKapDato: undefined,
  }],
});

const buildSource = (): EetImportSource => ({
  revision: 'eet-import-runtime',
  eetValues: buildValues(),
  skadedato: toISODateString('2024-07-01'),
});

const buildComputation = () => {
  const result = computeEetLoebendeYdelser({
    erhvervsevnetab: buildValues(),
    skadedato: toISODateString('2024-07-01'),
    skadelidteFodselsdato: toISODateString('1980-01-01'),
  });
  if (result.computation === null) {
    throw new Error('Testinvariant: EET-computation mangler');
  }
  return result.computation;
};

describe('buildEetImportContext – defensive runtime-facitter', () => {
  beforeEach(() => {
    computeImportMock.mockReset();
    reportSystemIssueMock.mockReset();
  });

  it('fail-closer og rapporterer et ukendt afgørelsestype fra computationen', () => {
    const computation = buildComputation();
    const invalidComputation = Object.assign(computation, {
      afgoerelser: computation.afgoerelser.map((afgoerelse) =>
        Object.assign({}, afgoerelse, { afgoerelseType: 'Ukendt' })
      ),
    });
    computeImportMock.mockReturnValue({ issues: [], computation: invalidComputation });

    const context = buildEetImportContext(buildSource(), toISODateString('2026-03-19'));

    expect(context).toEqual(expect.objectContaining({
      revision: 'eet-import-runtime',
      groups: [],
      issues: [expect.objectContaining({
        id: 'midlertidigt-eet-import-invariant',
        severity: 'error',
      })],
    }));
    expect(reportSystemIssueMock).toHaveBeenCalledWith(expect.objectContaining({
      code: 'eet_import_port:runtime',
      area: 'calculation',
    }));
  });

  it('fail-closer og rapporterer et ikke-konverterbart periodeoutput', () => {
    const computation = buildComputation();
    const afgoerelse = computation.afgoerelser[0];
    if (afgoerelse === undefined || afgoerelse.perioder[0] === undefined) {
      throw new Error('Testinvariant: EET-computation mangler en periode');
    }
    const invalidComputation = Object.assign(computation, {
      afgoerelser: [{
        ...afgoerelse,
        perioder: [Object.assign({}, afgoerelse.perioder[0], { fra: 'ikke-en-dato' }), ...afgoerelse.perioder.slice(1)],
      }, ...computation.afgoerelser.slice(1)],
    });
    computeImportMock.mockReturnValue({ issues: [], computation: invalidComputation });

    const context = buildEetImportContext(buildSource(), toISODateString('2026-03-19'));

    expect(context).toEqual(expect.objectContaining({
      revision: 'eet-import-runtime',
      groups: [],
      issues: [expect.objectContaining({
        id: 'midlertidigt-eet-import-invariant',
        severity: 'error',
      })],
    }));
    expect(reportSystemIssueMock).toHaveBeenCalledWith(expect.objectContaining({
      code: 'eet_import_port:runtime',
      area: 'calculation',
    }));
  });

  it('viser source-missing, når der ikke findes en importkilde', () => {
    expect(buildUnavailableEetImportContext(null, 'source_missing')).toEqual({
      revision: 'missing-source',
      groups: [],
      issues: [expect.objectContaining({
        id: 'midlertidigt-eet-source-missing',
        severity: 'error',
      })],
    });
  });

  it('viser manglende beregningsdato, når slutdatoen mangler og kilden ikke har datoen', () => {
    const source = buildSource();
    const sourceWithoutBeregningsdato: EetImportSource = {
      ...source,
      eetValues: { ...source.eetValues, beregningsdato: undefined },
    };

    expect(buildUnavailableEetImportContext(sourceWithoutBeregningsdato, 'taf_slutdato_missing'))
      .toEqual(expect.objectContaining({
        revision: 'eet-import-runtime',
        issues: [expect.objectContaining({
          id: 'beregningsdato-missing',
          severity: 'error',
        })],
      }));
  });

  it('viser manglende slutdato, når importkilden ellers har beregningsdato', () => {
    expect(buildUnavailableEetImportContext(buildSource(), 'taf_slutdato_missing'))
      .toEqual(expect.objectContaining({
        revision: 'eet-import-runtime',
        issues: [expect.objectContaining({
          id: 'midlertidigt-eet-slutdato-missing',
          severity: 'error',
        })],
      }));
  });
});

import { computeForsoergertabSnapshot } from '../../../domain/forsoergertab/forsoergertabSnapshot';
import type {
  FaellesAarsloenValues,
  ForsoergertabValues,
  StamdataValues,
} from '../../../schemas/formSchemas';

const asAmount = (value: number) => ({ kind: 'number' as const, value });

const createValues = (overrides: Partial<ForsoergertabValues> = {}): ForsoergertabValues => ({
  beregningsdato: '2026-03-19',
  efterladteFodselsdato: '1973-01-01',
  virkningsdato: '2025-01-01',
  koen: 'Kvinde',
  tilkendtForPeriodeAar: 10,
  ...overrides,
});

const createFaellesAarsloen = (overrides: Partial<FaellesAarsloenValues> = {}): FaellesAarsloenValues => ({
  aslAarsloen: asAmount(450000),
  ealAarsloen: asAmount(450000),
  ...overrides,
});

const createStamdata = (overrides: Partial<StamdataValues> = {}): StamdataValues => ({
  journalnr: '',
  advokat: '',
  sagsbehandler: '',
  skadelidte: 'Test',
  skadestype: 'Arbejdsulykke',
  skadedato: '2020-05-01',
  skadelidteFodselsdato: '1980-01-01',
  ...overrides,
});

describe('computeForsoergertabSnapshot', () => {
  it('bygger én autoritativ visning og PDF-projektion fra samme beregningsresultat', () => {
    const snapshot = computeForsoergertabSnapshot({
      values: createValues(),
      faellesAarsloen: createFaellesAarsloen(),
      stamdata: createStamdata(),
      fieldErrors: {
        forsoergertab: {},
        faellesAarsloen: {},
        stamdata: {},
      },
    });

    expect(snapshot.canShowEal).toBe(true);
    expect(snapshot.canShowAsl).toBe(true);
    expect(snapshot.canShowResult).toBe(true);
    expect(snapshot.canDownloadPdf).toBe(true);
    expect(snapshot.pdfProjection.result).toEqual(snapshot.calculation.result);
    expect(snapshot.pdfProjection.ealComputation).toEqual(snapshot.calculation.ealComputation);
    expect(snapshot.pdfProjection.aslComputation).toEqual(snapshot.calculation.aslComputation);
  });

  it('bevarer EAL-visning men blokerer ASL ved beregningsdato før virkningsdato', () => {
    const snapshot = computeForsoergertabSnapshot({
      values: createValues({
        beregningsdato: '2020-01-01',
        virkningsdato: '2020-02-01',
      }),
      faellesAarsloen: createFaellesAarsloen(),
      stamdata: createStamdata(),
      fieldErrors: {
        forsoergertab: {},
        faellesAarsloen: {},
        stamdata: {},
      },
    });

    expect(snapshot.fieldUi.beregningsdato.hasError).toBe(true);
    expect(snapshot.fieldUi.beregningsdatoForEal.hasError).toBe(false);
    expect(snapshot.canShowEal).toBe(true);
    expect(snapshot.canShowAsl).toBe(false);
    expect(snapshot.canShowResult).toBe(false);
    expect(snapshot.canDownloadPdf).toBe(true);
    expect(snapshot.pdfProjection.ealComputation).not.toBeNull();
    expect(snapshot.pdfProjection.aslComputation).toBeNull();
    expect(snapshot.pdfProjection.result).toBeNull();
  });

  it('lader feltfejl overstyre domænehelpertekst i snapshot-projektionen', () => {
    const snapshot = computeForsoergertabSnapshot({
      values: createValues(),
      faellesAarsloen: createFaellesAarsloen({
        ealAarsloen: undefined,
      }),
      stamdata: createStamdata(),
      fieldErrors: {
        forsoergertab: {},
        faellesAarsloen: {
          ealAarsloen: { message: 'Feltfejl fra UI' },
        },
        stamdata: {},
      },
    });

    expect(snapshot.fieldUi.ealAarsloen.hasError).toBe(true);
    expect(snapshot.fieldUi.ealAarsloen.helperText).toBe('Feltfejl fra UI');
    expect(snapshot.canShowEal).toBe(false);
    expect(snapshot.pdfProjection.ealComputation).toBeNull();
  });
});

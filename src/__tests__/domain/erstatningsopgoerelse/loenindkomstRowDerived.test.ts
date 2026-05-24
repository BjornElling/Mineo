import { calculateLoenindkomstRowDerived } from '../../../domain/erstatningsopgoerelse/helpers/loenindkomstRowDerived';
import {
  createDefaultLoenindkomstAnsaettelsesforhold,
  createErstatningsopgoerelseInitialValues,
} from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import type { StandardLoenTableRow } from '../../../schemas/formSchemas';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';

const asAmountValue = (value: number): AmountValue => ({ kind: 'number', value });

const createBaseContext = () => {
  const values = createErstatningsopgoerelseInitialValues();
  return {
    beregnesUdFra: values.beregnesUdFra,
    tafBeregningsperiodeFra: values.tafBeregningsperiodeFra,
    tafBeregningsperiodeTil: values.tafBeregningsperiodeTil,
    loenindkomstAnsaettelsesforhold: values.loenindkomstAnsaettelsesforhold,
    ferieperioder: values.ferieperioder,
    fravaerPerioder: values.fravaerPerioder,
  };
};

const createEmptyRow = (): StandardLoenTableRow => ({
  id: 'row-1',
  col0_maaned: '',
  col1_maaned: '',
  col0_uge: '',
  col1_uge: '',
  col0_dag: '',
  col1_dag: '',
  col2: undefined,
  col3: undefined,
  col4: undefined,
  col5: undefined,
});

describe('calculateLoenindkomstRowDerived', () => {
  it('fordeler manuel satsændring efter kalenderdage når TAF beregnes som måneder', () => {
    const ansaettelsesforhold = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      loenperiode: 'maaned' as const,
      loenudviklingBeregningsgrundlag: 'Manuelt angivet' as const,
      shSoPct: 0,
      loenudviklingManuelTableData: [
        { id: 'base', dato: '', grundloen: asAmountValue(0), feriepenge: '', shSoSats: '0', fritvalg: '', agPension: '' },
        { id: 'step', dato: '2024-01-15', grundloen: asAmountValue(0), feriepenge: '', shSoSats: '10', fritvalg: '', agPension: '' },
      ],
    };
    const row: StandardLoenTableRow = {
      ...createEmptyRow(),
      col0_maaned: '1',
      col1_maaned: '2024',
      col2: asAmountValue(3100),
    };
    const context = {
      ...createBaseContext(),
      beregnesUdFra: 'Angivet månedsløn' as const,
      loenindkomstAnsaettelsesforhold: [ansaettelsesforhold],
    };

    const result = calculateLoenindkomstRowDerived({
      row,
      ansaettelsesforhold,
      context,
    });

    expect(result.fpFvShSo).toBe(183.95);
    expect(result.samlet).toBe(3283.95);
  });

  it('bruger senest gældende manuel sats selv når satsændringen ligger før lønrækken', () => {
    const ansaettelsesforhold = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      loenperiode: 'maaned' as const,
      loenudviklingBeregningsgrundlag: 'Manuelt angivet' as const,
      feriePct: 15,
      shSoPct: 0,
      storeBededagPct: 0,
      pensionPct: 10,
      loenudviklingManuelTableData: [
        { id: 'base', dato: '2025-02-28', grundloen: asAmountValue(0), feriepenge: '15', shSoSats: '', fritvalg: '', agPension: '10' },
        { id: 'step', dato: '2025-05-01', grundloen: asAmountValue(0), feriepenge: '15', shSoSats: '', fritvalg: '', agPension: '12' },
      ],
    };
    const row: StandardLoenTableRow = {
      ...createEmptyRow(),
      col0_maaned: '6',
      col1_maaned: '2025',
      col2: asAmountValue(1000),
    };
    const context = {
      ...createBaseContext(),
      beregnesUdFra: 'Angivet månedsløn' as const,
      loenindkomstAnsaettelsesforhold: [ansaettelsesforhold],
    };

    const result = calculateLoenindkomstRowDerived({
      row,
      ansaettelsesforhold,
      context,
    });

    expect(result.fpFvShSo).toBe(154.5);
    expect(result.pension).toBe(138.54);
    expect(result.samlet).toBe(1293.04);
  });

  it('fordeler manuel satsændring efter arbejdsdage når TAF beregnes som arbejdsdage', () => {
    const ansaettelsesforhold = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      loenperiode: 'dag' as const,
      loenudviklingBeregningsgrundlag: 'Manuelt angivet' as const,
      shSoPct: 0,
      loenudviklingManuelTableData: [
        { id: 'base', dato: '', grundloen: asAmountValue(0), feriepenge: '', shSoSats: '0', fritvalg: '', agPension: '' },
        { id: 'step', dato: '2024-01-15', grundloen: asAmountValue(0), feriepenge: '', shSoSats: '10', fritvalg: '', agPension: '' },
      ],
    };
    const row: StandardLoenTableRow = {
      ...createEmptyRow(),
      col0_dag: '2024-01-01',
      col1_dag: '2024-01-19',
      col2: asAmountValue(1400),
    };
    const context = {
      ...createBaseContext(),
      beregnesUdFra: 'Angivet dagsløn' as const,
      loenindkomstAnsaettelsesforhold: [ansaettelsesforhold],
    };

    const result = calculateLoenindkomstRowDerived({
      row,
      ansaettelsesforhold,
      context,
    });

    expect(result.fpFvShSo).toBe(56.3);
    expect(result.samlet).toBe(1456.3);
  });

  it('arbejdsdags-sporet respekterer ferie og fravær ved manuel satsfordeling', () => {
    const ansaettelsesforhold = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      loenperiode: 'dag' as const,
      loenudviklingBeregningsgrundlag: 'Manuelt angivet' as const,
      shSoPct: 0,
      loenudviklingManuelTableData: [
        { id: 'base', dato: '', grundloen: asAmountValue(0), feriepenge: '', shSoSats: '0', fritvalg: '', agPension: '' },
        { id: 'step', dato: '2024-01-10', grundloen: asAmountValue(0), feriepenge: '', shSoSats: '10', fritvalg: '', agPension: '' },
      ],
    };
    const row: StandardLoenTableRow = {
      ...createEmptyRow(),
      col0_dag: '2024-01-08',
      col1_dag: '2024-01-12',
      col2: asAmountValue(1000),
    };
    const context = {
      ...createBaseContext(),
      beregnesUdFra: 'Angivet dagsløn' as const,
      loenindkomstAnsaettelsesforhold: [ansaettelsesforhold],
      ferieperioder: [{ id: 'ferie-1', fra: '2024-01-11' as const, til: '2024-01-11' as const }],
      fravaerPerioder: [{ id: 'fravaer-1', fra: '2024-01-12' as const, til: '2024-01-12' as const }],
    };

    const result = calculateLoenindkomstRowDerived({
      row,
      ansaettelsesforhold,
      context,
    });

    expect(result.fpFvShSo).toBe(37.83);
    expect(result.samlet).toBe(1037.83);
  });

  it('fordeler overenskomstsats pr. rækkedato i stedet for en fast sats på anvendt regulering', () => {
    const ansaettelsesforhold = {
      ...createDefaultLoenindkomstAnsaettelsesforhold(),
      harOverenskomst: true,
      overenskomstId: 'bygge-anlaeg',
      loenPaaHelligdage: 'Almindelig løn' as const,
      loenudviklingBeregningsgrundlag: 'Overenskomst' as const,
      feriePct: 0,
      fritvalgPct: 0,
      shSoPct: 0,
      storeBededagPct: 0,
      pensionPct: 0,
      loenperiode: 'dag' as const,
    };
    const row: StandardLoenTableRow = {
      ...createEmptyRow(),
      col0_dag: '2024-02-26',
      col1_dag: '2024-03-05',
      col2: asAmountValue(900),
    };
    const context = {
      ...createBaseContext(),
      beregnesUdFra: 'Angivet månedsløn' as const,
      loenindkomstAnsaettelsesforhold: [ansaettelsesforhold],
    };

    const result = calculateLoenindkomstRowDerived({
      row,
      ansaettelsesforhold,
      context,
    });

    expect(result.fpFvShSo).toBe(76.05);
    expect(result.samlet).toBe(1075.12);
  });
});

import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { buildEODebugTafBeregningsgrundlagRows } from '../../../domain/debug/eoDebugErstatningsopgoerelseModel';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/erstatningsopgoerelseInitialValues';
import { STAMDATA_INITIAL_VALUES } from '../../../domain/stamdata/stamdataInitialValues';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';

const makeValues = (patch: Partial<ErstatningsopgoerelseValues>): ErstatningsopgoerelseValues => {
  const base = structuredClone(createErstatningsopgoerelseInitialValues());
  return { ...base, ...patch };
};

const asAmountValue = (value: number): AmountValue => ({ kind: 'number', value });

describe('buildEODebugTafBeregningsgrundlagRows visibility', () => {
  it('hides beregningsperiode-only rows when beregnes ud fra is not Beregningsperiode', () => {
    const values = makeValues({
      beregnesUdFra: 'Angivet årsløn',
    });

    const rows = buildEODebugTafBeregningsgrundlagRows(values, {}, STAMDATA_INITIAL_VALUES);
    const ids = new Set(rows.map((row) => row.id));

    expect(ids.has('taf.beregningsgrundlag.beregningsperiode')).toBe(false);
    expect(ids.has('taf.beregningsgrundlag.ferie.empty')).toBe(false);
    expect(Array.from(ids).some((id) => id.startsWith('taf.beregningsgrundlag.ferie.'))).toBe(false);
    expect(ids.has('taf.beregningsgrundlag.uspecificeredeFerieFridage')).toBe(false);
    expect(ids.has('taf.beregningsgrundlag.oevrigtFravaerUdenLoen')).toBe(false);
    expect(ids.has('taf.beregningsgrundlag.oevrigeFravaersdage')).toBe(false);
    expect(ids.has('taf.beregningsgrundlag.oevrigeFravaersdageBeskrivelse')).toBe(false);
    expect(ids.has('taf.beregningsgrundlag.maaneder')).toBe(false);
  });

  it('hides Arbejdsdage when TAF beregnes som is Måneder', () => {
    const values = makeValues({
      beregnesUdFra: 'Beregningsperiode',
    });

    const rows = buildEODebugTafBeregningsgrundlagRows(values, {}, STAMDATA_INITIAL_VALUES);
    const ids = new Set(rows.map((row) => row.id));

    expect(ids.has('taf.beregningsgrundlag.arbejdsdage')).toBe(false);
    expect(ids.has('taf.beregningsgrundlag.maaneder')).toBe(true);
  });

  it('hides Måneder when TAF beregnes som is Arbejdsdage', () => {
    const values = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      periodeTilBeregningFra: '2024-01-01',
      periodeTilBeregningTil: '2024-12-31',
      loenindkomstAnsaettelsesforhold: [
        {
          ...createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold[0],
          fuldLoenUnderFerie: 'Nej',
          indtaegtsoplysningerTableData: [
            {
              id: 'row-workdays',
              col0_maaned: '1',
              col1_maaned: '2024',
              col0_uge: '',
              col1_uge: '',
              col0_dag: '',
              col1_dag: '',
              col2: asAmountValue(10000),
              col3: undefined,
              col4: undefined,
              col5: undefined,
            },
          ],
        },
      ],
    });

    const rows = buildEODebugTafBeregningsgrundlagRows(values, {}, STAMDATA_INITIAL_VALUES);
    const ids = new Set(rows.map((row) => row.id));

    expect(ids.has('taf.beregningsgrundlag.maaneder')).toBe(false);
    expect(ids.has('taf.beregningsgrundlag.arbejdsdage')).toBe(true);
  });

  it('adds error row for missing indkomst i beregningsperioden with period in message', () => {
    const values = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      periodeTilBeregningFra: '2025-01-01',
      periodeTilBeregningTil: '2025-01-31',
      loenindkomstAnsaettelsesforhold: [
        {
          ...createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold[0],
          indtaegtsoplysningerTableData: [],
        },
      ],
      offentligeYdelserRows: [],
    });

    const rows = buildEODebugTafBeregningsgrundlagRows(values, {}, STAMDATA_INITIAL_VALUES);
    const indkomstRow = rows.find((row) => row.id === 'taf.beregningsgrundlag.indkomst');

    expect(indkomstRow).toBeDefined();
    expect(indkomstRow?.label).toBe('Indkomst');
    expect(indkomstRow?.status).toBe('error');
    expect(indkomstRow?.displayValue).toBe('-');
    expect(indkomstRow?.message).toBe('Ingen indkomst i beregningsperioden (01-01-2025 - 31-01-2025)');
  });

  it('does not add missing-indkomst row when indkomst exists in beregningsperioden', () => {
    const values = makeValues({
      beregnesUdFra: 'Beregningsperiode',
      periodeTilBeregningFra: '2025-01-01',
      periodeTilBeregningTil: '2025-01-31',
      loenindkomstAnsaettelsesforhold: [
        {
          ...createErstatningsopgoerelseInitialValues().loenindkomstAnsaettelsesforhold[0],
          indtaegtsoplysningerTableData: [
            {
              id: 'row-1',
              col0_maaned: '1',
              col1_maaned: '2025',
              col0_uge: '',
              col1_uge: '',
              col0_dag: '',
              col1_dag: '',
              col2: asAmountValue(10000),
              col3: undefined,
              col4: undefined,
              col5: undefined,
            },
          ],
        },
      ],
      offentligeYdelserRows: [],
    });

    const rows = buildEODebugTafBeregningsgrundlagRows(values, {}, STAMDATA_INITIAL_VALUES);
    const indkomstRow = rows.find((row) => row.id === 'taf.beregningsgrundlag.indkomst');
    expect(indkomstRow).toBeUndefined();
  });
});

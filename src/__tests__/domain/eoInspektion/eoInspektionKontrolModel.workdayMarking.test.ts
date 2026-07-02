import { buildEOInspektionModel } from '../../../domain/eoInspektion/eoInspektionKontrolModel';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';
import { toISODateString } from '../../../types/branded';

const createBaseValues = () => ({
  ...createErstatningsopgoerelseInitialValues(),
  vedroererPeriodeFra: toISODateString('2024-01-01'),
  vedroererPeriodeTil: toISODateString('2024-01-03'),
  tafBeregningsperiodeFra: toISODateString('2024-01-01'),
  tafBeregningsperiodeTil: toISODateString('2024-01-03'),
  ferieperioder: [{ id: 'ferie-1', fra: toISODateString('2024-01-02'), til: toISODateString('2024-01-02') }],
});

describe('eoInspektionKontrolModel arbejdsdag-markering', () => {
  it('viser Beregningsperiode-kilden med tomme bounds når beregningsgrundlag ikke er Beregningsperiode', () => {
    const values = {
      ...createBaseValues(),
      beregnesUdFra: 'Angivet månedsløn' as const,
      tafBeregningsperiodeFra: toISODateString('2021-05-01'),
      tafBeregningsperiodeTil: toISODateString('2022-02-28'),
    };

    const model = buildEOInspektionModel(values);
    const beregningsperiodeSource = model.sources.find((source) => source.label === 'Beregningsperiode');
    expect(beregningsperiodeSource).toBeDefined();
    expect(beregningsperiodeSource?.fra).toBeUndefined();
    expect(beregningsperiodeSource?.til).toBeUndefined();
  });

  it('markerer hverdage som arbejdsdag ved Måneder, også når de er SH- eller feriedage', () => {
    const values = {
      ...createBaseValues(),
      beregnesUdFra: 'Angivet månedsløn' as const,
    };

    const model = buildEOInspektionModel(values);
    const indexSh = model.tableData.dates.indexOf(toISODateString('2024-01-01'));
    const indexFerie = model.tableData.dates.indexOf(toISODateString('2024-01-02'));

    expect(indexSh).toBeGreaterThanOrEqual(0);
    expect(indexFerie).toBeGreaterThanOrEqual(0);
    expect(model.getCell(indexSh, 'base:arbejdsdag')).toBe('x');
    expect(model.getCell(indexFerie, 'base:arbejdsdag')).toBe('x');
  });

  it('markerer ikke SH- eller feriedage som arbejdsdag ved Arbejdsdage', () => {
    const values = {
      ...createBaseValues(),
      beregnesUdFra: 'Angivet dagsløn' as const,
    };

    const model = buildEOInspektionModel(values);
    const indexSh = model.tableData.dates.indexOf(toISODateString('2024-01-01'));
    const indexFerie = model.tableData.dates.indexOf(toISODateString('2024-01-02'));

    expect(indexSh).toBeGreaterThanOrEqual(0);
    expect(indexFerie).toBeGreaterThanOrEqual(0);
    expect(model.getCell(indexSh, 'base:arbejdsdag')).toBe('');
    expect(model.getCell(indexFerie, 'base:arbejdsdag')).toBe('');
  });
});

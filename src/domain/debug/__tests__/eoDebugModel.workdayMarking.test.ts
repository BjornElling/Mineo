import { describe, expect, it } from 'vitest';
import { buildEODebugModel } from '../eoDebugModel';
import { createErstatningsopgoerelseInitialValues } from '../../erstatningsopgoerelse/erstatningsopgoerelseInitialValues';

const createBaseValues = () => ({
  ...createErstatningsopgoerelseInitialValues(),
  vedroererPeriodeFra: '2024-01-01',
  vedroererPeriodeTil: '2024-01-03',
  periodeTilBeregningFra: '2024-01-01',
  periodeTilBeregningTil: '2024-01-03',
  ferieperioder: [{ id: 'ferie-1', fra: '2024-01-02', til: '2024-01-02' }],
});

describe('eoDebugModel arbejdsdag-markering', () => {
  it('markerer hverdage som arbejdsdag ved Måneder, også når de er SH- eller feriedage', () => {
    const values = {
      ...createBaseValues(),
      beregnesUdFra: 'Angivet månedsløn' as const,
    };

    const model = buildEODebugModel(values);
    const indexSh = model.tableData.dates.indexOf('2024-01-01');
    const indexFerie = model.tableData.dates.indexOf('2024-01-02');

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

    const model = buildEODebugModel(values);
    const indexSh = model.tableData.dates.indexOf('2024-01-01');
    const indexFerie = model.tableData.dates.indexOf('2024-01-02');

    expect(indexSh).toBeGreaterThanOrEqual(0);
    expect(indexFerie).toBeGreaterThanOrEqual(0);
    expect(model.getCell(indexSh, 'base:arbejdsdag')).toBe('');
    expect(model.getCell(indexFerie, 'base:arbejdsdag')).toBe('');
  });
});

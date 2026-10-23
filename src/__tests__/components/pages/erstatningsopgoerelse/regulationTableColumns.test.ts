import { getRegulationTableColumns } from '../../../../components/pages/erstatningsopgoerelse/regulationTableColumns';

describe('getRegulationTableColumns', () => {
  it('beholder «Grundløn» og højrestiller den som de øvrige talkolonner (BB-309)', () => {
    const columns = getRegulationTableColumns({
      id: 't',
      columns: ['Fra-dato', 'Grundløn', 'Store Bededagstillæg', 'AG-pension'],
      rows: [],
    });
    expect(columns.map((column) => column.header)).toEqual(['Fra-dato', 'Grundløn', 'Store Bededagstillæg', 'AG-pension']);
    expect(columns.map((column) => column.align)).toEqual(['center', 'right', 'right', 'right']);
  });

  it('omdøber «Dato» til «Fra-dato»', () => {
    expect(getRegulationTableColumns({ id: 't', columns: ['Dato'], rows: [] })[0]?.header).toBe('Fra-dato');
  });
});

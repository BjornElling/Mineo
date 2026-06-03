import type { OffentligeYdelserRow } from '../../../schemas/formSchemas';
import { insertOffentligeYdelserRowsBeforeTrailingEmpty } from '../../../domain/erstatningsopgoerelse/helpers/offentligeYdelserRowInsertion';

const makeRow = (id: string, overrides: Partial<OffentligeYdelserRow> = {}): OffentligeYdelserRow => ({
  id,
  fraDato: undefined,
  tilDato: undefined,
  ydelse: undefined,
  tillaeg: undefined,
  ydelsestype: '',
  ...overrides,
});

describe('insertOffentligeYdelserRowsBeforeTrailingEmpty', () => {
  it('indsætter forrest når alle eksisterende rækker er tomme', () => {
    const existingRows = [makeRow('empty-1'), makeRow('empty-2')];
    const insertedRows = [makeRow('inserted', { ydelsestype: 'dagpenge' })];

    expect(insertOffentligeYdelserRowsBeforeTrailingEmpty(existingRows, insertedRows).map((row) => row.id)).toEqual([
      'inserted',
      'empty-1',
      'empty-2',
    ]);
  });

  it('indsætter sidst når alle eksisterende rækker er udfyldte', () => {
    const existingRows = [
      makeRow('filled-1', { ydelsestype: 'dagpenge' }),
      makeRow('filled-2', { ydelsestype: 'sygedagpenge' }),
    ];
    const insertedRows = [makeRow('inserted', { ydelsestype: 'midlertidigt_eet' })];

    expect(insertOffentligeYdelserRowsBeforeTrailingEmpty(existingRows, insertedRows).map((row) => row.id)).toEqual([
      'filled-1',
      'filled-2',
      'inserted',
    ]);
  });

  it('indsætter præcis før trailing tomme rækker', () => {
    const existingRows = [
      makeRow('filled-1', { ydelsestype: 'dagpenge' }),
      makeRow('filled-2', { ydelsestype: 'sygedagpenge' }),
      makeRow('filled-3', { ydelsestype: 'andet' }),
      makeRow('empty-1'),
      makeRow('empty-2'),
    ];
    const insertedRows = [
      makeRow('inserted-1', { ydelsestype: 'midlertidigt_eet' }),
      makeRow('inserted-2', { ydelsestype: 'midlertidigt_eet' }),
    ];

    expect(insertOffentligeYdelserRowsBeforeTrailingEmpty(existingRows, insertedRows).map((row) => row.id)).toEqual([
      'filled-1',
      'filled-2',
      'filled-3',
      'inserted-1',
      'inserted-2',
      'empty-1',
      'empty-2',
    ]);
  });

  it('returnerer kopi af eksisterende rækker når insertedRows er tom', () => {
    const existingRows = [makeRow('filled-1', { ydelsestype: 'dagpenge' })];
    const result = insertOffentligeYdelserRowsBeforeTrailingEmpty(existingRows, []);

    expect(result).toEqual(existingRows);
    expect(result).not.toBe(existingRows);
  });
});

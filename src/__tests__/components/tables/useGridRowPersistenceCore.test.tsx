// @vitest-environment jsdom
import * as React from 'react';
import { act, render } from '@testing-library/react';
import { useGridRowPersistenceCore } from '../../../components/tables/gridCore/useGridRowPersistenceCore';
import { normalizeGridRows } from '../../../components/tables/gridCore/gridModel';
import { createEmptyRowId } from '../../../utils/rowId';

type Row = { id: string; value?: string };

const isRowEmpty = (row: Row): boolean => row.value === undefined || row.value.trim() === '';
const getRowId = (row: Row): string => row.id;
const withRowId = (row: Row, id: string): Row => ({ ...row, id });
const fingerprint = (rows: readonly Row[]): string => JSON.stringify(rows.map((r) => [r.id, r.value ?? null]));

const makeNormalize = (minRows: number, prefix = 'row') => (rows: readonly Row[]): Row[] =>
  normalizeGridRows({ rows, minRows, getRowId, isRowEmpty, createEmptyRow: (seed) => ({ id: createEmptyRowId(prefix, seed) }) });

type Harness = {
  api: ReturnType<typeof useGridRowPersistenceCore<Row>>;
};

const renderCore = (
  initialTableData: Row[],
  onTableDataChange: (rows: Row[], origin?: { fieldPath?: string }) => void,
  options?: { minRows?: number; keepLeadingRows?: number; normalizeRows?: (rows: readonly Row[]) => Row[] }
) => {
  const ref: Harness = { api: null as unknown as Harness['api'] };
  const normalizeRows = options?.normalizeRows ?? makeNormalize(options?.minRows ?? 2);
  const Comp = ({ tableData }: { tableData: Row[] }) => {
    ref.api = useGridRowPersistenceCore<Row>({
      tableData,
      onTableDataChange,
      normalizeRows,
      isRowEmpty,
      getRowId,
      withRowId,
      fingerprint,
      keepLeadingRows: options?.keepLeadingRows,
    });
    return null;
  };
  const utils = render(<Comp tableData={initialTableData} />);
  return { ref, rerender: (tableData: Row[]) => utils.rerender(<Comp tableData={tableData} />) };
};

describe('useGridRowPersistenceCore', () => {
  it('strip-empties: en commit persisterer kun non-empty rækker (ikke den efterfølgende tomme)', async () => {
    const onChange = vi.fn();
    const { ref } = renderCore([{ id: 'r1', value: 'a' }], onChange);

    await act(async () => {
      ref.api.setInternalTableData((prev) => {
        const updated = prev.map((row) => (row.id === 'r1' ? { ...row, value: 'b' } : row));
        const normalized = makeNormalize(2)(updated);
        ref.api.queuePersist(normalized, 'r1:0');
        return normalized;
      });
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    const [persistedRows, origin] = onChange.mock.calls[0]!;
    expect((persistedRows as Row[]).every((row) => !isRowEmpty(row))).toBe(true);
    expect(persistedRows).toEqual([{ id: 'r1', value: 'b' }]);
    expect(origin).toEqual({ fieldPath: 'r1:0' });
  });

  it('reconcile-resync: en prop-resync til tom række kan bevare tidligere id (undo-fokus-invariant)', async () => {
    const onChange = vi.fn();
    // Start med én udfyldt række (id r1); efter commit er internal = [r1(udfyldt), trailing-empty].
    const { ref, rerender } = renderCore([{ id: 'r1', value: 'a' }], onChange);

    await act(async () => {
      ref.api.setInternalTableData((prev) => {
        const normalized = makeNormalize(2)(prev.map((r) => (r.id === 'r1' ? { ...r, value: 'committed' } : r)));
        ref.api.queuePersist(normalized, 'r1:0');
        return normalized;
      });
    });

    const idAtRow0Before = ref.api.internalTableData[0]!.id;
    expect(idAtRow0Before).toBe('r1');

    // Undo: forælderen sender den tomme tilstand tilbage. Reconcile skal bevare id 'r1' på position 0,
    // så cellens undo-fokus-mål (r1:0) stadig kan rammes.
    await act(async () => {
      rerender([]);
    });

    expect(ref.api.internalTableData[0]!.id).toBe('r1');
    expect(isRowEmpty(ref.api.internalTableData[0]!)).toBe(true);
  });

  it('reconcile-resync: en ikke-tom incoming-række beholder data-id og får fokus-alias', async () => {
    const onChange = vi.fn();
    const { ref, rerender } = renderCore([{ id: 'old-id', value: 'a' }], onChange);

    await act(async () => {
      rerender([{ id: 'new-id', value: 'b' }]);
    });

    expect(ref.api.internalTableData[0]).toEqual({ id: 'new-id', value: 'b' });
    expect(ref.api.getUndoFieldPathAliases('new-id', 0)).toEqual(['old-id:0']);
  });

  it('keepLeadingRows: en låst ledende række gemmes altid, selv når den er tom', async () => {
    const onChange = vi.fn();
    // Base-bevidst normalisering (som Lønudvikling manuel): rows[0] er den låste basisrække,
    // resten normaliseres som en tail med én efterfølgende tom række.
    const baseAwareNormalize = (rows: readonly Row[]): Row[] => {
      const baseRow = rows[0] ?? { id: 'base' };
      const tail = makeNormalize(1, 'tail')(rows.slice(1));
      return [baseRow, ...tail];
    };
    // Basisrække (idx 0) tom + én udfyldt tail-række.
    const { ref } = renderCore([{ id: 'base' }, { id: 't1', value: 'x' }], onChange, {
      keepLeadingRows: 1,
      normalizeRows: baseAwareNormalize,
    });

    await act(async () => {
      ref.api.setInternalTableData((prev) => {
        const normalized = baseAwareNormalize(prev);
        ref.api.queuePersist(normalized);
        return normalized;
      });
    });

    expect(onChange).toHaveBeenCalled();
    const persisted = onChange.mock.calls.at(-1)![0] as Row[];
    // Basisrækken (tom) er bevaret som første element; den syntetiske trailing-empty er strippet.
    expect(persisted[0]).toEqual({ id: 'base' });
    expect(persisted.some((row) => row.id === 't1')).toBe(true);
    expect(persisted.filter((row) => isRowEmpty(row) && row.id !== 'base')).toHaveLength(0);
  });

  it('flush-guard: et køet payload, der ikke længere matcher den aktuelle state, droppes (ingen stale persist)', async () => {
    const onChange = vi.fn();
    const { ref } = renderCore([{ id: 'r1', value: 'a' }], onChange);

    // Kø et payload OG overskriv staten i samme commit med noget andet end det køede.
    await act(async () => {
      ref.api.setInternalTableData((prev) => {
        const stale = makeNormalize(2)(prev.map((r) => (r.id === 'r1' ? { ...r, value: 'stale' } : r)));
        ref.api.queuePersist(stale, 'r1:0');
        // Returnér en ANDEN state end den køede — flush-guarden skal opdage mismatch og droppe payloadet.
        return makeNormalize(2)(prev.map((r) => (r.id === 'r1' ? { ...r, value: 'actual' } : r)));
      });
    });

    expect(onChange).not.toHaveBeenCalled();
  });
});

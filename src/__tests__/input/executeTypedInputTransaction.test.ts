// @vitest-environment jsdom
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import { getInputEnvelopeStorageKey } from '../../config/storageManifest';
import {
  executeInputTransaction,
  executeTypedInputTransaction,
} from '../../input/inputTransactionRunner';
import { parseInputEnvelope } from '../../input/inputEnvelope';
import {
  commitImmediateField,
  deleteRow,
  insertRow,
  reorderRows,
  settleField,
} from '../../input/inputCommands';
import {
  renteberegningBeregningsdatoBinding,
  rentekravRowsBinding,
} from '../../input/catalog/renteberegningInputBindings';
import { satserAargangBinding } from '../../input/catalog/satserInputBindings';
import { createEmptyRentekravCommittedRow } from '../../domain/renteberegning/rentekravTableModel';
import { inputRuntimeStore, type HistoryFrameOrigin } from '../../stores/inputRuntimeStore';

const origin: HistoryFrameOrigin = {
  route: '/renteberegning',
  tabKey: null,
  sectionKey: 'renteberegning',
  fieldPath: 'beregningsdato',
  focusToken: null,
};

const reset = () => {
  sessionStorage.clear();
  inputRuntimeStore.getState().clearAll({ hydrated: true, persistedDataVersion: PERSISTED_DATA_VERSION });
};

const storedSections = () => {
  const raw = sessionStorage.getItem(getInputEnvelopeStorageKey());
  return raw === null ? null : parseInputEnvelope(raw).input.sections;
};

describe('executeTypedInputTransaction', () => {
  beforeEach(reset);

  it('commitImmediateField skriver canonical værdi, revision og history som én transaktion', () => {
    const before = inputRuntimeStore.getState().revision;
    const result = executeTypedInputTransaction(
      commitImmediateField(satserAargangBinding.createRef(), 2025),
      { origin, now: 100 }
    );
    expect(result.changed).toBe(true);
    expect(result.revision).toBe(before + 1);
    expect(inputRuntimeStore.getState().input.sections.satser).toEqual({ aargang: 2025 });
    expect(inputRuntimeStore.getState().history.past).toHaveLength(1);
    expect(storedSections()?.satser).toEqual({ aargang: 2025 });
  });

  it('er observationelt identisk med den tilsvarende replaceSection', () => {
    executeTypedInputTransaction(commitImmediateField(satserAargangBinding.createRef(), 2025), { origin });
    const viaTyped = inputRuntimeStore.getState().input.sections.satser;
    reset();
    executeInputTransaction({ kind: 'replaceSection', section: 'satser', value: { aargang: 2025 } }, { origin });
    expect(inputRuntimeStore.getState().input.sections.satser).toEqual(viaTyped);
  });

  it('settleField gyldig fletter feltet ind i en tom sektion', () => {
    executeTypedInputTransaction(
      settleField(renteberegningBeregningsdatoBinding.createRef(), '01-01-2024'),
      { origin }
    );
    expect(inputRuntimeStore.getState().input.sections.renteberegning).toEqual({
      beregningsdato: '2024-01-01',
      rentekravRows: [],
    });
  });

  it('settleField ugyldig bevarer den rå tekst under feltets legacy-fieldPath (identisk read-view)', () => {
    executeTypedInputTransaction(
      settleField(renteberegningBeregningsdatoBinding.createRef(), '12..20'),
      { origin }
    );
    // Canonical sektion er uændret (ingen gyldig værdi skrevet)
    expect(inputRuntimeStore.getState().input.sections.renteberegning).toBeNull();
    // Legacy invalidDrafts-viewet ser den rå tekst under 'beregningsdato' — som reporter-kanalen ville.
    expect(inputRuntimeStore.getState().invalidDrafts.renteberegning.beregningsdato).toBe('12..20');
  });

  it('commitImmediateField rydder feltets rejected input atomisk', () => {
    executeTypedInputTransaction(
      settleField(renteberegningBeregningsdatoBinding.createRef(), '12..20'),
      { origin }
    );
    expect(inputRuntimeStore.getState().invalidDrafts.renteberegning.beregningsdato).toBe('12..20');

    executeTypedInputTransaction(
      commitImmediateField(renteberegningBeregningsdatoBinding.createRef(), undefined),
      { origin }
    );
    expect(inputRuntimeStore.getState().invalidDrafts.renteberegning.beregningsdato).toBeUndefined();
  });

  it('afviser semantisk no-op uden storage-write, history eller revision', () => {
    executeTypedInputTransaction(commitImmediateField(satserAargangBinding.createRef(), 2025), { origin });
    const before = inputRuntimeStore.getState();
    const setItem = vi.spyOn(Object.getPrototypeOf(window.sessionStorage) as Storage, 'setItem');

    const result = executeTypedInputTransaction(commitImmediateField(satserAargangBinding.createRef(), 2025), { origin });
    setItem.mockRestore();

    expect(result.changed).toBe(false);
    expect(inputRuntimeStore.getState().revision).toBe(before.revision);
    expect(inputRuntimeStore.getState().history).toBe(before.history);
  });

  it('insert/reorder/delete muterer collection-sektionen', () => {
    executeTypedInputTransaction(insertRow(rentekravRowsBinding, createEmptyRentekravCommittedRow('a')), { origin });
    executeTypedInputTransaction(insertRow(rentekravRowsBinding, createEmptyRentekravCommittedRow('b')), { origin });
    expect(inputRuntimeStore.getState().input.sections.renteberegning?.rentekravRows.map((row) => row.id))
      .toEqual(['a', 'b']);

    executeTypedInputTransaction(reorderRows(rentekravRowsBinding, ['b', 'a']), { origin });
    expect(inputRuntimeStore.getState().input.sections.renteberegning?.rentekravRows.map((row) => row.id))
      .toEqual(['b', 'a']);

    executeTypedInputTransaction(deleteRow(rentekravRowsBinding, 'b'), { origin });
    expect(inputRuntimeStore.getState().input.sections.renteberegning?.rentekravRows.map((row) => row.id))
      .toEqual(['a']);
  });

  it('afviser typed write når storage er blokeret', () => {
    inputRuntimeStore.getState().__setMetaUnsafe({ inputWritesBlocked: true });
    expect(() => executeTypedInputTransaction(commitImmediateField(satserAargangBinding.createRef(), 2025)))
      .toThrow('Inputændringer er blokeret');
  });
});

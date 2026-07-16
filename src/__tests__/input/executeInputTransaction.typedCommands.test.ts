// @vitest-environment jsdom
import { PERSISTED_DATA_VERSION } from '../../config/persistenceVersion';
import { getInputEnvelopeStorageKey } from '../../config/storageManifest';
import { executeInputTransaction } from '../../input/inputTransactionRunner';
import { parseInputEnvelope } from '../../input/inputEnvelope';
import {
  clearCase,
  commitImmediateField,
  deleteRow,
  insertRow,
  redoInput,
  reorderRows,
  replaceCase,
  resetSection,
  settleField,
  undoInput,
} from '../../input/inputCommands';
import { createEmptyPersistedInputSections } from '../../input/inputState';
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

describe('executeInputTransaction — typed commands', () => {
  beforeEach(reset);

  it('commitImmediateField skriver canonical værdi, revision og history som én transaktion', () => {
    const before = inputRuntimeStore.getState().revision;
    const result = executeInputTransaction(
      commitImmediateField(satserAargangBinding.createRef(), 2025),
      { origin, now: 100 }
    );
    expect(result.changed).toBe(true);
    expect(result.revision).toBe(before + 1);
    expect(inputRuntimeStore.getState().input.sections.satser).toEqual({ aargang: 2025 });
    expect(inputRuntimeStore.getState().history.past).toHaveLength(1);
    expect(storedSections()?.satser).toEqual({ aargang: 2025 });
  });

  it('settleField gyldig fletter feltet ind i en tom sektion', () => {
    executeInputTransaction(
      settleField(renteberegningBeregningsdatoBinding.createRef(), '01-01-2024'),
      { origin }
    );
    expect(inputRuntimeStore.getState().input.sections.renteberegning).toEqual({
      beregningsdato: '2024-01-01',
      rentekravRows: [],
    });
  });

  it('settleField ugyldig bevarer den rå tekst i compatibility-read-viewet', () => {
    executeInputTransaction(
      settleField(renteberegningBeregningsdatoBinding.createRef(), '12..20'),
      { origin }
    );
    expect(inputRuntimeStore.getState().input.sections.renteberegning).toBeNull();
    expect(inputRuntimeStore.getState().invalidDrafts.renteberegning.beregningsdato).toBe('12..20');
  });

  it('commitImmediateField rydder feltets rejected input atomisk', () => {
    executeInputTransaction(
      settleField(renteberegningBeregningsdatoBinding.createRef(), '12..20'),
      { origin }
    );
    executeInputTransaction(
      commitImmediateField(renteberegningBeregningsdatoBinding.createRef(), undefined),
      { origin }
    );
    expect(inputRuntimeStore.getState().invalidDrafts.renteberegning.beregningsdato).toBeUndefined();
  });

  it('afviser semantisk no-op uden storage-write, history eller revision', () => {
    executeInputTransaction(commitImmediateField(satserAargangBinding.createRef(), 2025), { origin });
    const before = inputRuntimeStore.getState();
    const setItem = vi.spyOn(Object.getPrototypeOf(window.sessionStorage) as Storage, 'setItem');

    const result = executeInputTransaction(commitImmediateField(satserAargangBinding.createRef(), 2025), { origin });
    setItem.mockRestore();

    expect(result.changed).toBe(false);
    expect(inputRuntimeStore.getState().revision).toBe(before.revision);
    expect(inputRuntimeStore.getState().history).toBe(before.history);
  });

  it('insert/reorder/delete muterer collection-sektionen', () => {
    executeInputTransaction(insertRow(rentekravRowsBinding, createEmptyRentekravCommittedRow('a')), { origin });
    executeInputTransaction(insertRow(rentekravRowsBinding, createEmptyRentekravCommittedRow('b')), { origin });
    expect(inputRuntimeStore.getState().input.sections.renteberegning?.rentekravRows.map((row) => row.id))
      .toEqual(['a', 'b']);

    executeInputTransaction(reorderRows(rentekravRowsBinding, ['b', 'a']), { origin });
    expect(inputRuntimeStore.getState().input.sections.renteberegning?.rentekravRows.map((row) => row.id))
      .toEqual(['b', 'a']);

    executeInputTransaction(deleteRow(rentekravRowsBinding, 'b'), { origin });
    expect(inputRuntimeStore.getState().input.sections.renteberegning?.rentekravRows.map((row) => row.id))
      .toEqual(['a']);
  });

  it('resetSection bruger samme typed reducer og kan fortrydes', () => {
    executeInputTransaction(
      settleField(renteberegningBeregningsdatoBinding.createRef(), '12..20'),
      { origin }
    );
    executeInputTransaction(resetSection('renteberegning', null), { origin });
    expect(inputRuntimeStore.getState().input.sections.renteberegning).toBeNull();
    expect(inputRuntimeStore.getState().invalidDrafts.renteberegning).toEqual({});

    executeInputTransaction(undoInput());
    expect(inputRuntimeStore.getState().invalidDrafts.renteberegning.beregningsdato).toBe('12..20');
  });

  it('replaceCase og clearCase går gennem det kanoniske system-command-spor', () => {
    const sections = {
      ...createEmptyPersistedInputSections(),
      satser: { aargang: 2024 },
    };
    executeInputTransaction(replaceCase({ sections, rejectedInputs: {} }), { history: 'clear' });
    expect(inputRuntimeStore.getState().input.sections.satser).toEqual({ aargang: 2024 });
    expect(inputRuntimeStore.getState().history.past).toEqual([]);

    executeInputTransaction(clearCase(), { history: 'clear' });
    expect(inputRuntimeStore.getState().input.sections.satser).toBeNull();
    expect(sessionStorage.getItem(getInputEnvelopeStorageKey())).toBeNull();
  });

  it('undoInput og redoInput gendanner typed commits', () => {
    executeInputTransaction(commitImmediateField(satserAargangBinding.createRef(), 2024), { origin });
    executeInputTransaction(commitImmediateField(satserAargangBinding.createRef(), 2025), { origin });

    executeInputTransaction(undoInput());
    expect(inputRuntimeStore.getState().input.sections.satser).toEqual({ aargang: 2024 });
    executeInputTransaction(redoInput());
    expect(inputRuntimeStore.getState().input.sections.satser).toEqual({ aargang: 2025 });
  });

  it('afviser typed writes når storage er blokeret, men tillader clearCase', () => {
    inputRuntimeStore.getState().__setMetaUnsafe({ inputWritesBlocked: true });
    expect(() => executeInputTransaction(commitImmediateField(satserAargangBinding.createRef(), 2025)))
      .toThrow('Inputændringer er blokeret');

    expect(executeInputTransaction(clearCase(), { history: 'clear' }).changed).toBe(true);
    expect(inputRuntimeStore.getState().meta.inputWritesBlocked).not.toBe(true);
  });
});

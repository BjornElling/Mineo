// @vitest-environment jsdom
import { getInputEnvelopeStorageKey } from '../../config/storageManifest';
import { executeInputTransaction } from '../../input/inputTransactionRunner';
import { parseInputEnvelope } from '../../input/inputEnvelope';
import { inputRuntimeStore, type HistoryFrameOrigin } from '../../stores/inputRuntimeStore';

const origin: HistoryFrameOrigin = {
  route: '/satser',
  tabKey: null,
  sectionKey: 'satser',
  fieldPath: 'aargang',
  focusToken: null,
};

describe('executeInputTransaction', () => {
  beforeEach(() => {
    sessionStorage.clear();
    inputRuntimeStore.getState().clearAll({ hydrated: true, persistedDataVersion: '3.9' });
  });

  it('skriver aggregate, revision og history som én transaktion', () => {
    const before = inputRuntimeStore.getState().revision;
    let notifications = 0;
    const unsubscribe = inputRuntimeStore.subscribe(() => { notifications += 1; });

    const result = executeInputTransaction(
      { kind: 'replaceSection', section: 'satser', value: { aargang: 2025 } },
      { origin, now: 100 }
    );
    unsubscribe();

    expect(result.changed).toBe(true);
    expect(result.revision).toBe(before + 1);
    expect(notifications).toBe(1);
    expect(inputRuntimeStore.getState().history.past).toHaveLength(1);
    const stored = sessionStorage.getItem(getInputEnvelopeStorageKey());
    expect(stored).not.toBeNull();
    expect(parseInputEnvelope(stored!).input.sections.satser).toEqual({ aargang: 2025 });
  });

  it('afviser semantisk no-op uden storage, history eller revision', () => {
    executeInputTransaction(
      { kind: 'replaceSection', section: 'satser', value: { aargang: 2025 } },
      { origin }
    );
    const before = inputRuntimeStore.getState();
    const setItem = vi.spyOn(Object.getPrototypeOf(window.sessionStorage) as Storage, 'setItem');

    const result = executeInputTransaction(
      { kind: 'replaceSection', section: 'satser', value: { aargang: 2025 } },
      { origin }
    );

    expect(result.changed).toBe(false);
    expect(setItem).not.toHaveBeenCalled();
    expect(inputRuntimeStore.getState().revision).toBe(before.revision);
    expect(inputRuntimeStore.getState().history).toBe(before.history);
  });

  it('deep-freezer committede sektioner og history-snapshots efter envelope-genparse', () => {
    executeInputTransaction(
      { kind: 'replaceSection', section: 'satser', value: { aargang: 2024 } },
      { origin }
    );
    executeInputTransaction(
      { kind: 'replaceSection', section: 'satser', value: { aargang: 2025 } },
      { origin }
    );

    const state = inputRuntimeStore.getState();
    const currentSatser = state.input.sections.satser;
    const previousSatser = state.history.past.at(-1)?.input.sections.satser;
    expect(Object.isFrozen(currentSatser)).toBe(true);
    expect(Object.isFrozen(previousSatser)).toBe(true);
    expect(() => {
      if (currentSatser !== null) (currentSatser as { aargang?: number }).aargang = 2030;
    }).toThrow(TypeError);
    expect(() => {
      if (previousSatser !== null && previousSatser !== undefined) {
        (previousSatser as { aargang?: number }).aargang = 2031;
      }
    }).toThrow(TypeError);
    expect(state.input.sections.satser?.aargang).toBe(2025);
    expect(state.history.past.at(-1)?.input.sections.satser?.aargang).toBe(2024);
  });

  it('undo og redo gendanner hele inputaggregaten med nye monotone revisioner', () => {
    executeInputTransaction(
      { kind: 'replaceSection', section: 'satser', value: { aargang: 2025 } },
      { origin }
    );
    executeInputTransaction(
      { kind: 'changeRejectedInputs', changes: [{ pageKey: 'satser', fieldPath: 'aargang', draft: '20x' }] },
      { origin }
    );
    const afterInvalid = inputRuntimeStore.getState().revision;

    expect(executeInputTransaction({ kind: 'undo' }).restoredFrame).not.toBeNull();
    expect(inputRuntimeStore.getState().invalidDrafts.satser.aargang).toBeUndefined();
    expect(inputRuntimeStore.getState().revision).toBe(afterInvalid + 1);

    expect(executeInputTransaction({ kind: 'redo' }).restoredFrame).not.toBeNull();
    expect(inputRuntimeStore.getState().invalidDrafts.satser.aargang).toBe('20x');
    expect(inputRuntimeStore.getState().revision).toBe(afterInvalid + 2);
  });

  it('bevarer runtime og history hvis storage-skrivning fejler', () => {
    const before = inputRuntimeStore.getState();
    const setItem = vi.spyOn(Object.getPrototypeOf(window.sessionStorage) as Storage, 'setItem').mockImplementation(() => {
      throw new DOMException('fyldt', 'QuotaExceededError');
    });

    expect(() => executeInputTransaction(
      { kind: 'replaceSection', section: 'satser', value: { aargang: 2025 } },
      { origin }
    )).toThrow('fyldt');
    expect(inputRuntimeStore.getState().input).toBe(before.input);
    expect(inputRuntimeStore.getState().history).toBe(before.history);
    expect(inputRuntimeStore.getState().revision).toBe(before.revision);
    setItem.mockRestore();
  });

  it('hel-sags-erstatning rydder history og rejected input', () => {
    executeInputTransaction(
      { kind: 'changeRejectedInputs', changes: [{ pageKey: 'satser', fieldPath: 'aargang', draft: 'x' }] },
      { origin }
    );
    executeInputTransaction({
      kind: 'replaceCase',
      sections: {
        stamdata: undefined,
        satser: { aargang: 2024 },
        aarsloen: undefined,
        faellesAarsloen: undefined,
        renteberegning: undefined,
        varigemen: undefined,
        forsoergertab: undefined,
        erstatningsopgoerelse: undefined,
        erhvervsevnetab: undefined,
      },
    }, { history: 'clear' });

    expect(inputRuntimeStore.getState().history.past).toEqual([]);
    expect(inputRuntimeStore.getState().input.rejectedInputs).toEqual({});
    expect(inputRuntimeStore.getState().sections.satser).toEqual({ aargang: 2024 });
  });

  it('afviser schema-ugyldig sektion før storage og runtime', () => {
    const before = inputRuntimeStore.getState();
    expect(() => executeInputTransaction({
      kind: 'replaceSection',
      section: 'satser',
      value: { aargang: {} },
    })).toThrow();
    expect(inputRuntimeStore.getState()).toBe(before);
    expect(sessionStorage.getItem(getInputEnvelopeStorageKey())).toBeNull();
  });

  it('invaliderer redo ved en ny history-preserve mutation', () => {
    executeInputTransaction(
      { kind: 'replaceSection', section: 'satser', value: { aargang: 2024 } },
      { origin }
    );
    executeInputTransaction(
      { kind: 'replaceSection', section: 'satser', value: { aargang: 2025 } },
      { origin }
    );
    executeInputTransaction({ kind: 'undo' });
    expect(inputRuntimeStore.getState().history.future).toHaveLength(1);

    executeInputTransaction({
      kind: 'changeRejectedInputs',
      changes: [{ pageKey: 'satser', fieldPath: 'aargang', draft: '20x' }],
    }, { history: 'preserve' });

    expect(inputRuntimeStore.getState().history.future).toEqual([]);
    expect(executeInputTransaction({ kind: 'redo' }).changed).toBe(false);
  });

  it('gendanner midlertidige component-fejl sammen med history uden en åben gate-periode', () => {
    inputRuntimeStore.getState().setFieldError('satser', 'aargang', 'rule', {
      message: 'Før',
      severity: 'error',
    });
    executeInputTransaction(
      { kind: 'replaceSection', section: 'satser', value: { aargang: 2025 } },
      { origin }
    );
    inputRuntimeStore.getState().setFieldError('satser', 'aargang', 'rule', {
      message: 'Efter',
      severity: 'error',
    });

    executeInputTransaction({ kind: 'undo' });

    expect(inputRuntimeStore.getState().fieldErrors.satser.aargang?.rule?.message).toBe('Før');
  });

  it('blokerer normale writes efter startupfejl, men tillader eksplicit Slet alt', () => {
    inputRuntimeStore.getState().hydrateInputRuntime(
      inputRuntimeStore.getState().input,
      { writesBlocked: true }
    );

    expect(() => executeInputTransaction({
      kind: 'replaceSection',
      section: 'satser',
      value: { aargang: 2025 },
    })).toThrow('blokeret');
    expect(sessionStorage.getItem(getInputEnvelopeStorageKey())).toBeNull();

    expect(executeInputTransaction({ kind: 'clearCase' }, { history: 'clear' }).changed).toBe(true);
    expect(inputRuntimeStore.getState().meta.inputWritesBlocked).not.toBe(true);
  });

  it('resetSection rydder sektionen og dens rejected input i samme undo-bare transaktion', () => {
    executeInputTransaction({
      kind: 'replaceSection',
      section: 'satser',
      value: { aargang: 2025 },
      rejectedChanges: [{ pageKey: 'satser', fieldPath: 'aargang', draft: '20x' }],
    }, { origin });

    executeInputTransaction({ kind: 'resetSection', section: 'satser' }, { origin });
    expect(inputRuntimeStore.getState().sections.satser).toBeNull();
    expect(inputRuntimeStore.getState().invalidDrafts.satser).toEqual({});

    executeInputTransaction({ kind: 'undo' });
    expect(inputRuntimeStore.getState().sections.satser).toEqual({ aargang: 2025 });
    expect(inputRuntimeStore.getState().invalidDrafts.satser.aargang).toBe('20x');
  });

  it('pruneRejectedInputs fjerner kun de valgte entries uden eget history-trin', () => {
    executeInputTransaction({
      kind: 'changeRejectedInputs',
      changes: [
        { pageKey: 'satser', fieldPath: 'aargang', draft: '20x' },
        { pageKey: 'satser', fieldPath: 'andet', draft: 'x' },
      ],
    }, { origin });
    const pastLength = inputRuntimeStore.getState().history.past.length;

    executeInputTransaction({
      kind: 'pruneRejectedInputs',
      section: 'satser',
      fieldPaths: ['aargang'],
    }, { history: 'preserve' });

    expect(inputRuntimeStore.getState().invalidDrafts.satser).toEqual({ andet: 'x' });
    expect(inputRuntimeStore.getState().history.past).toHaveLength(pastLength);
  });

  it('begrænser både undo- og redo-grene til 50 frames', () => {
    for (let index = 0; index < 55; index += 1) {
      executeInputTransaction({
        kind: 'replaceSection',
        section: 'satser',
        value: { aargang: 2000 + index },
      }, { origin, now: index });
    }
    expect(inputRuntimeStore.getState().history.past).toHaveLength(50);

    for (let index = 0; index < 50; index += 1) executeInputTransaction({ kind: 'undo' });
    expect(inputRuntimeStore.getState().history.future).toHaveLength(50);
    expect(executeInputTransaction({ kind: 'undo' }).changed).toBe(false);
  });
});

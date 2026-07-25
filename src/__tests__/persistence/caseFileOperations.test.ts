// @vitest-environment jsdom
import {
  insertRow,
  serializeFieldAddress,
  settleField,
} from '../../inputCore';
import {
  __createSlimInputTestStore,
  dispatchInput,
  type RuntimeInputCommand,
  type SlimInputStore,
} from '../../inputCore/runtime';
import { captureStableInput, readSourceToken } from '../../inputCore/runtime/evaluationSourceBinding';
import {
  buildLoadReplaceCaseCandidate,
  createCaseFileOperations,
  type CaseRuntimeAccess,
} from '../../persistence/caseFileOperations';
import { projectEoSave } from '../../persistence/eoSaveProjection';
import {
  aargangField,
  belobField,
  createTestCatalog,
  makeRow,
  rentekravRowsRef,
} from '../inputCore/testCatalog';

const catalog = createTestCatalog();

const buildRuntime = (store: SlimInputStore): CaseRuntimeAccess => Object.freeze({
  catalog,
  getSettledInput: () => store.getState().input,
  captureSaveSource: () => {
    const { input, token } = captureStableInput(store);
    return { input, token };
  },
  applyReplaceCase: (candidate) => {
    dispatchInput(store, catalog, { kind: 'replaceCase', input: candidate });
  },
});

const settle = <TField, TEntity>(
  store: SlimInputStore,
  command: RuntimeInputCommand<TField, TEntity>
): void => {
  dispatchInput(store, catalog, command);
};

describe('caseFileOperations', () => {
  describe('evaluateSave', () => {
    it('blokerer med den præcise rejected adresse ved format-fejl (§1.6/§3.9)', () => {
      const store = __createSlimInputTestStore();
      settle(store, settleField(aargangField.bind(), 'ikke-et-tal'));
      const ops = createCaseFileOperations(buildRuntime(store));

      const outcome = ops.evaluateSave();

      expect(outcome.status).toBe('blocked');
      if (outcome.status !== 'blocked') return;
      expect(outcome.rejectedAddresses).toEqual([serializeFieldAddress(aargangField.bind().address)]);
    });

    it('gemmer schema-gyldigt canonical input med afledt bounds-issue (§1.6)', () => {
      const store = __createSlimInputTestStore();
      settle(store, insertRow(rentekravRowsRef(), makeRow('r1')));
      settle(store, settleField(aargangField.bind(), '1800'));
      settle(store, settleField(belobField.bind('r1'), '-25'));
      const ops = createCaseFileOperations(buildRuntime(store));

      const outcome = ops.evaluateSave();

      expect(outcome.status).toBe('ready');
      if (outcome.status !== 'ready') return;
      expect(outcome.snapshot.satser?.aargang).toBe(1800);
      // Kildetokenet matcher runtime på save-tidspunktet (§3.9 pkt. 2).
      expect(outcome.token).toEqual(readSourceToken(store));
    });

    it('leverer samme snapshot som projectEoSave direkte (porten er en ren orkestrering)', () => {
      const store = __createSlimInputTestStore();
      settle(store, settleField(aargangField.bind(), '2020'));
      const ops = createCaseFileOperations(buildRuntime(store));

      const outcome = ops.evaluateSave();
      const direct = projectEoSave(store.getState().input, catalog);

      expect(outcome.status).toBe('ready');
      expect(direct.status).toBe('ready');
      if (outcome.status !== 'ready' || direct.status !== 'ready') return;
      expect(outcome.snapshot).toEqual(direct.snapshot);
    });
  });

  describe('applyLoadedSnapshot', () => {
    it('anvender et indlæst snapshot som autoritativ replacement og rydder history (§3.7)', () => {
      const store = __createSlimInputTestStore();
      settle(store, settleField(aargangField.bind(), '2020'));
      const generationBefore = store.getState().replacementGeneration;
      const ops = createCaseFileOperations(buildRuntime(store));

      const loadedSnapshot = projectEoSave(store.getState().input, catalog);
      expect(loadedSnapshot.status).toBe('ready');
      if (loadedSnapshot.status !== 'ready') return;

      // Skift runtime væk fra den gemte tilstand, og genanvend det "indlæste" snapshot.
      settle(store, settleField(aargangField.bind(), '1999'));
      ops.applyLoadedSnapshot(loadedSnapshot.snapshot);

      expect(store.getState().input.sections.satser?.aargang).toBe(2020);
      expect(store.getState().replacementGeneration).toBeGreaterThan(generationBefore);
      // history ryddet af replaceCase (§3.7): undo er et no-op.
      const beforeUndo = store.getState().revision;
      dispatchInput(store, catalog, { kind: 'undo' });
      expect(store.getState().revision).toBe(beforeUndo);
    });

    it('mapper undefined-sektioner til null i replace-kandidaten', () => {
      const candidate = buildLoadReplaceCaseCandidate({
        stamdata: undefined,
        satser: { aargang: 2020 },
        aarsloen: undefined,
        faellesAarsloen: undefined,
        renteberegning: undefined,
        varigemen: undefined,
        forsoergertab: undefined,
        erstatningsopgoerelse: undefined,
        erhvervsevnetab: undefined,
      });
      expect(candidate.sections.stamdata).toBeNull();
      expect(candidate.sections.satser).toEqual({ aargang: 2020 });
      expect(candidate.rejectedInputs).toEqual({});
    });
  });

  describe('hasAnyData', () => {
    it('er falsk på tom sag og sand efter et canonical felt', () => {
      const store = __createSlimInputTestStore();
      const ops = createCaseFileOperations(buildRuntime(store));
      expect(ops.hasAnyData()).toBe(false);

      settle(store, settleField(aargangField.bind(), '2020'));
      expect(ops.hasAnyData()).toBe(true);
    });

    it('er SAND for rejected-only input (tomt canonical slot + fejlende råtekst, §1.6)', () => {
      // Ellers kunne en load overskrive afsluttet fejlende brugerinput uden overwrite-bekræftelse.
      const store = __createSlimInputTestStore();
      settle(store, settleField(aargangField.bind(), 'ikke-et-tal'));
      const ops = createCaseFileOperations(buildRuntime(store));

      // Canonical slot er ryddet til tomværdien, men rejectedInputs bærer råteksten.
      expect(store.getState().input.sections.satser?.aargang).toBeUndefined();
      expect(Object.keys(store.getState().input.rejectedInputs).length).toBeGreaterThan(0);
      expect(ops.hasAnyData()).toBe(true);
    });
  });

  // Critical-action-kontrakten §5: en async-grænse mellem evaluering og skrivning (fx directory-/fil-pickeren)
  // kræver, at HELE kildetokenet genlæses og sammenlignes umiddelbart før den irreversible skrivning.
  describe('isSaveSourceStillCurrent', () => {
    it('er sand, når kilden ikke har ændret sig siden evalueringen', () => {
      const store = __createSlimInputTestStore();
      settle(store, settleField(aargangField.bind(), '2020'));
      const ops = createCaseFileOperations(buildRuntime(store));

      const outcome = ops.evaluateSave();
      expect(outcome.status).toBe('ready');
      if (outcome.status !== 'ready') return;

      expect(ops.isSaveSourceStillCurrent(outcome.token)).toBe(true);
    });

    it('er FALSK, når inputrevisionen ændres efter evalueringen (ville ellers gemme en ældre sag)', () => {
      const store = __createSlimInputTestStore();
      settle(store, settleField(aargangField.bind(), '2020'));
      const ops = createCaseFileOperations(buildRuntime(store));

      const outcome = ops.evaluateSave();
      expect(outcome.status).toBe('ready');
      if (outcome.status !== 'ready') return;

      // Brugeren redigerer, mens fil-pickeren er åben.
      settle(store, settleField(aargangField.bind(), '2021'));

      expect(ops.isSaveSourceStillCurrent(outcome.token)).toBe(false);
    });

    it('er FALSK, når settingsrevisionen ændres efter evalueringen', () => {
      const store = __createSlimInputTestStore();
      settle(store, settleField(aargangField.bind(), '2020'));
      const ops = createCaseFileOperations(buildRuntime(store));

      const outcome = ops.evaluateSave();
      expect(outcome.status).toBe('ready');
      if (outcome.status !== 'ready') return;

      // En dokumentrelevant indstilling ændres, mens fil-pickeren er åben. Begge revisioner indgår i tokenet,
      // fordi begge kan ændre det, der ville blive skrevet.
      store.getState().bumpSettingsRevision();

      expect(readSourceToken(store)).not.toEqual(outcome.token);
      expect(ops.isSaveSourceStillCurrent(outcome.token)).toBe(false);
    });
  });
});

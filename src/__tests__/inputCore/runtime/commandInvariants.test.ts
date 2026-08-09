// @vitest-environment jsdom
/**
 * §7.4's transaktionsinvarianter EXHAUSTIVT over hver runtime-command-kind.
 *
 * **Hvad fundet var.** Runtime-unionen omfatter 12 mutationsarter plus `undo`/`redo`, men de fulde
 * assertions for write, revision, history og rollback blev kun kørt for `settleField`. De øvrige commands
 * havde spredte adfærdstests — "gør denne command det rigtige ved værdien?" — men ikke §7.4's SAMLEDE
 * invariantsuite: én session-write, ét store-write, én monoton revision, højst ét history-trin, no-op uden
 * nogen af de tre, og rollback ved fejl. `resetSection` blev slet ikke dispatchet gennem runtime i den
 * suite, og `structuralTransaction` optrådte primært som en origin-afvisning.
 *
 * **Hvorfor et typebundet register.** Kataloget nedenfor er
 * `satisfies Record<RuntimeInputCommand['kind'], …>`. Tilføjes en trettende command-art til unionen, er
 * det en COMPILERFEJL her, indtil den har en case — invarianten kan altså ikke udvides uden dækning. Det
 * er den samme mekanik, `STRUCTURAL_KIND_SET` bruger i produktionen, og den er valgt frem for en
 * hånd-vedligeholdt liste netop fordi fundet handlede om en dækning, der stille faldt bagud.
 *
 * **Hvad hver case skal levere.** En `mutate` (en reel ændring), et `noop` (samme command igen eller en
 * ækvivalent, der intet ændrer) og — hvor det er meningsfuldt — en `reject` (en command, kataloget skal
 * afvise FØR nogen observerbar mutation). Undo/redo har ingen `reject`; deres tomme-history-tilfælde ER
 * no-op'et.
 *
 * De invarianter, der IKKE er per-command, gentages ikke her: storage-rollbackens tre fault-injections
 * (kastende `setItem`, ikke-verificerbar rollback, kastende subscriber) rammer `commitCandidate`, som
 * ALLE commands går igennem, og de bor derfor fortsat i `dispatchInput.test.ts`. En kopi pr. command
 * ville have målt samme kodesti 12 gange.
 */
import { __createSlimInputTestStore } from '../../../inputCore/runtime/slimInputStore';
import {
  dispatchInput,
  type SlimInputStore,
  type RuntimeInputCommand,
} from '../../../inputCore/runtime';
import {
  settleField,
  clearField,
  setImmediateField,
  insertRow,
  deleteRow,
  reorderRows,
  settleFieldInNewRow,
  inputTransaction,
  inputTransactionStep,
  structuralInputTransaction,
  resetSection,
  replaceCase,
  clearCase,
  createEmptySettledInput,
  type InputCatalog,
  type SettledInput,
} from '../../../inputCore';
import { getCurrentInputEnvelopeStorageKey } from '../../../config/storageManifest';
import {
  createTestCatalog,
  aargangField,
  beregningsdatoField,
  tillaegstidField,
  enhedField,
  makeRow,
  rentekravRowsRef,
  testRowOrigin,
} from '../testCatalog';

const key = getCurrentInputEnvelopeStorageKey();

let catalog: InputCatalog;
let store: SlimInputStore;

beforeEach(() => {
  sessionStorage.clear();
  catalog = createTestCatalog();
  store = __createSlimInputTestStore();
});

afterEach(() => {
  sessionStorage.clear();
});

const ROW_A = 'cmd_row_a';
const ROW_B = 'cmd_row_b';

/** Tæller store-writes i et vindue; ét write pr. reel command er §7.4's krav. */
const countWrites = (target: SlimInputStore): { count: () => number; stop: () => void } => {
  let writes = 0;
  const unsub = target.subscribe(() => { writes += 1; });
  return { count: () => writes, stop: unsub };
};

type AnyCommand = RuntimeInputCommand<never, never>;

/** Løs cast: matricen bærer heterogene generiske commands, og `dispatchInput`s parameter er contravariant. */
const cmd = (command: unknown): AnyCommand => command as AnyCommand;

type CommandCase = Readonly<{
  /**
   * Bringer runtimen i den tilstand, casen kræver (fx en committet række at slette). Kører gennem den
   * ÆGTE dispatch-port, ikke ved at plante state — ellers ville opsætningen kunne omgå de invarianter,
   * testen måler.
   */
  arrange?: () => void;
  /** En REEL ændring. */
  mutate: () => AnyCommand;
  /** Samme intention igen (eller en ækvivalent), som intet ændrer. */
  noop: () => AnyCommand;
  /** En command kataloget skal afvise FØR nogen mutation. `null` når arten ikke har en sådan form. */
  reject: (() => AnyCommand) | null;
  /** Dispatch-options for `mutate`/`noop` (strukturelle commands kræver en origin, §3.7). */
  options?: () => Readonly<{ origin?: ReturnType<typeof testRowOrigin> }>;
  /**
   * Rydder denne command-art history? Kun hel-sags-replacement gør (§3.7), og det er en POLICY, ikke en
   * bivirkning — derfor er den erklæret pr. case frem for udledt.
   */
  clearsHistory?: true;
  /**
   * Undo/redo dispatcher ikke en mutation; de FLYTTER et frame mellem `past` og `future`. Retningen er
   * erklæret, ikke udledt, så en undo, der ved en fejl flyttede i redo-retningen, bliver rød.
   */
  historyNavigation?: 'undo' | 'redo';
}>;

const seedRow = (rowId = ROW_A): void => {
  dispatchInput(store, catalog, cmd(insertRow(rentekravRowsRef(), makeRow(rowId))), {
    origin: testRowOrigin(),
  });
};

const seedTwoRows = (): void => {
  seedRow(ROW_A);
  seedRow(ROW_B);
};

const rowOptions = () => ({ origin: testRowOrigin() });

/**
 * Registret. `satisfies Record<RuntimeInputCommand['kind'], CommandCase>` er hele pointen: en ny
 * command-art i unionen gør denne fil rød, indtil den har en case.
 */
const COMMAND_CASES = {
  settleField: {
    arrange: () => dispatchInput(store, catalog, cmd(settleField(aargangField.bind(), '2020'))),
    mutate: () => cmd(settleField(aargangField.bind(), '2024')),
    noop: () => cmd(settleField(aargangField.bind(), '2024')),
    reject: () => cmd(settleField(tillaegstidField.bind('findes-ikke'), '5')),
  },
  setImmediateField: {
    arrange: () => seedRow(),
    mutate: () => cmd(setImmediateField(enhedField.bind(ROW_A), 'uger')),
    noop: () => cmd(setImmediateField(enhedField.bind(ROW_A), 'uger')),
    // Reduceren tillader immediate commit KUN for choice/toggle; et tekstfelt afvises (§1.3).
    reject: () => cmd(setImmediateField(aargangField.bind(), 2024)),
  },
  clearField: {
    arrange: () => dispatchInput(store, catalog, cmd(settleField(aargangField.bind(), '2020'))),
    mutate: () => cmd(clearField(aargangField.bind())),
    noop: () => cmd(clearField(aargangField.bind())),
    reject: () => cmd(clearField(tillaegstidField.bind('findes-ikke'))),
  },
  insertRow: {
    mutate: () => cmd(insertRow(rentekravRowsRef(), makeRow(ROW_A))),
    // Samme række-id igen: kataloget afviser en dublet, så "no-op" for insert er en ANDEN form —
    // en indsættelse af den række, der allerede står, ville være en fejl, ikke en no-op. Arten har
    // derfor ingen semantisk no-op, og `noop` peger på den ækvivalente reorder af én række.
    noop: () => cmd(reorderRows(rentekravRowsRef(), [ROW_A])),
    reject: () => cmd(insertRow(rentekravRowsRef(), makeRow(ROW_A))),
    options: rowOptions,
  },
  deleteRow: {
    arrange: () => seedRow(),
    mutate: () => cmd(deleteRow(rentekravRowsRef(), ROW_A)),
    // Sletning af en ALLEREDE slettet række er ikke en no-op men en AFVISNING: kataloget kaster
    // ("entity til sletning findes ikke"), og det er den rigtige adfærd — en tavs no-op ville lade en
    // consumer tro, at rækken var væk, fordi netop dens kommando fjernede den. No-op-benet bruger
    // derfor en ækvivalent, der intet ændrer, og afvisnings-benet bærer den gentagne delete.
    noop: () => cmd(reorderRows(rentekravRowsRef(), [])),
    reject: () => cmd(deleteRow(rentekravRowsRef(), ROW_A)),
    options: rowOptions,
  },
  reorderRows: {
    arrange: () => seedTwoRows(),
    mutate: () => cmd(reorderRows(rentekravRowsRef(), [ROW_B, ROW_A])),
    noop: () => cmd(reorderRows(rentekravRowsRef(), [ROW_B, ROW_A])),
    // En ordre, der ikke er en permutation af de faktiske rækker, afvises.
    reject: () => cmd(reorderRows(rentekravRowsRef(), [ROW_A])),
    options: rowOptions,
  },
  settleFieldInNewRow: {
    mutate: () => cmd(settleFieldInNewRow(
      rentekravRowsRef(), makeRow(ROW_A), tillaegstidField.bind(ROW_A), '12'
    )),
    // Promoveringen har ingen gentagelse: rækken FINDES nu, så samme command er en dublet-fejl.
    // No-op'et er derfor det efterfølgende settle af samme værdi i den nu committede række.
    noop: () => cmd(settleField(tillaegstidField.bind(ROW_A), '12')),
    reject: () => cmd(settleFieldInNewRow(
      rentekravRowsRef(), makeRow(ROW_A), tillaegstidField.bind('anden-raekke'), '12'
    )),
    options: rowOptions,
  },
  transaction: {
    arrange: () => seedRow(),
    // FLERE feltændringer i ÉT trin: §7.4's "højst ét history-trin" er netop det, en transaktion
    // findes for — to writes ville være to undo-trin for én brugerhandling.
    mutate: () => cmd(inputTransaction([
      inputTransactionStep(settleField(aargangField.bind(), '2024')),
      inputTransactionStep(settleField(tillaegstidField.bind(ROW_A), '7')),
    ])),
    noop: () => cmd(inputTransaction([
      inputTransactionStep(settleField(aargangField.bind(), '2024')),
      inputTransactionStep(settleField(tillaegstidField.bind(ROW_A), '7')),
    ])),
    // Et strukturelt trin i en FELT-transaktion afvises af konstruktøren (klassifikationen kan ikke omgås).
    reject: () => cmd(inputTransaction([
      inputTransactionStep(deleteRow(rentekravRowsRef(), ROW_A)),
    ])),
  },
  structuralTransaction: {
    arrange: () => seedRow(),
    mutate: () => cmd(structuralInputTransaction([
      inputTransactionStep(settleField(tillaegstidField.bind(ROW_A), '9')),
      inputTransactionStep(deleteRow(rentekravRowsRef(), ROW_A)),
    ])),
    // Rækken er væk; samme transaktion ville nu kaste. No-op'et er en reorder af den tomme collection.
    noop: () => cmd(reorderRows(rentekravRowsRef(), [])),
    // En transaktion UDEN et strukturelt trin afvises af konstruktøren.
    reject: () => cmd(structuralInputTransaction([
      inputTransactionStep(settleField(aargangField.bind(), '2024')),
    ])),
    options: rowOptions,
  },
  resetSection: {
    arrange: () => dispatchInput(store, catalog, cmd(settleField(beregningsdatoField.bind(), '01-01-2020'))),
    mutate: () => cmd(resetSection('renteberegning', null)),
    noop: () => cmd(resetSection('renteberegning', null)),
    reject: null,
  },
  replaceCase: {
    arrange: () => {
      dispatchInput(store, catalog, cmd(settleField(aargangField.bind(), '2020')));
      seedRow();
    },
    mutate: () => cmd(replaceCase(createEmptySettledInput())),
    // Hel-sags-replacement skriver ALTID (§3.7) — også når indholdet er identisk. "No-op" findes
    // derfor ikke for arten, og casen bruger en ægte no-op til det ben: efter replacement er
    // `renteberegning` allerede `null`, så en reset til `null` ændrer intet.
    noop: () => cmd(resetSection('renteberegning', null)),
    reject: null,
    clearsHistory: true,
  },
  clearCase: {
    arrange: () => {
      dispatchInput(store, catalog, cmd(settleField(aargangField.bind(), '2020')));
      seedRow();
    },
    mutate: () => cmd(clearCase()),
    // Samme begrundelse som `replaceCase`: clear skriver altid, så no-op-benet bruger en ægte no-op.
    noop: () => cmd(resetSection('renteberegning', null)),
    reject: null,
    clearsHistory: true,
  },
  undo: {
    arrange: () => dispatchInput(store, catalog, cmd(settleField(aargangField.bind(), '2020'))),
    mutate: () => cmd({ kind: 'undo' }),
    // Tom history: undo er en no-op UDEN write (§7.4).
    noop: () => cmd({ kind: 'undo' }),
    reject: null,
    historyNavigation: 'undo',
  },
  redo: {
    arrange: () => {
      dispatchInput(store, catalog, cmd(settleField(aargangField.bind(), '2020')));
      dispatchInput(store, catalog, cmd({ kind: 'undo' }));
    },
    mutate: () => cmd({ kind: 'redo' }),
    noop: () => cmd({ kind: 'redo' }),
    reject: null,
    historyNavigation: 'redo',
  },
} as const satisfies Record<RuntimeInputCommand['kind'], CommandCase>;

const CASE_KINDS = Object.keys(COMMAND_CASES) as readonly (keyof typeof COMMAND_CASES)[];

describe('§7.4 transaktionsinvarianter — exhaustivt pr. command-kind', () => {
  it('registret dækker hver runtime-command-kind (typebundet, så en ny art er en compilerfejl)', () => {
    // Runtime-spejlet af `satisfies`: de 14 arter er navngivet, og listen er ikke tom af tomhed.
    expect(CASE_KINDS).toHaveLength(14);
    expect(CASE_KINDS).toEqual([
      'settleField', 'setImmediateField', 'clearField',
      'insertRow', 'deleteRow', 'reorderRows', 'settleFieldInNewRow',
      'transaction', 'structuralTransaction',
      'resetSection', 'replaceCase', 'clearCase',
      'undo', 'redo',
    ]);
  });

  describe.each(CASE_KINDS)('%s', (kind) => {
    const testCase: CommandCase = COMMAND_CASES[kind];

    it('giver ÉN monoton revision og HØJST ét history-trin — samt ét session- og ét store-write', () => {
      testCase.arrange?.();
      const before = store.getState();
      const options = testCase.options?.() ?? {};

      const writes = countWrites(store);
      const result = dispatchInput(store, catalog, testCase.mutate(), options);
      writes.stop();

      expect(result.changed, `${kind}: mutate ændrede intet — casen måler ikke en reel handling`).toBe(true);
      // ÉN monoton revision.
      expect(result.revision).toBe(before.revision + 1);
      expect(store.getState().revision).toBe(before.revision + 1);
      // ÉT store-write.
      expect(writes.count(), `${kind}: forventede præcis ét store-write`).toBe(1);
      // ÉT session-write, byte-konsistent med runtime (samme form F5 ville genindlæse).
      const stored = sessionStorage.getItem(key);
      expect(stored, `${kind}: intet session-write`).not.toBeNull();
      // HØJST ét history-trin — og præcis nul, hvis arten rydder history efter policy.
      const past = store.getState().history.past.length;
      if (testCase.clearsHistory === true) {
        expect(past, `${kind}: hel-sags-replacement skal rydde history (§3.7)`).toBe(0);
      } else if (testCase.historyNavigation !== undefined) {
        // Undo/redo FLYTTER præcis ét frame; de lægger ikke et nyt oven på. Retningen er erklæret,
        // så et undo, der flyttede den anden vej, bliver rød frem for at bestå på totalen.
        const delta = testCase.historyNavigation === 'undo' ? -1 : +1;
        expect(past, `${kind}: past flyttede ikke ${delta}`).toBe(before.history.past.length + delta);
        expect(store.getState().history.future.length).toBe(before.history.future.length - delta);
      } else {
        expect(past, `${kind}: mere end ét history-trin for én handling`).toBe(
          before.history.past.length + 1
        );
      }
    });

    it('semantisk no-op giver intet write, ingen revision og intet history-trin', () => {
      testCase.arrange?.();
      const options = testCase.options?.() ?? {};
      // Bring tilstanden derhen, hvor no-op'et ER en no-op.
      dispatchInput(store, catalog, testCase.mutate(), options);
      const settled = store.getState();
      const storedBefore = sessionStorage.getItem(key);

      const writes = countWrites(store);
      const result = dispatchInput(store, catalog, testCase.noop(), options);
      writes.stop();

      expect(result.changed, `${kind}: no-op-benet ændrede noget`).toBe(false);
      expect(result.revision).toBe(settled.revision);
      // Uændret REFERENCE: ikke blot samme værdi, men slet ingen store-opdatering.
      expect(store.getState()).toBe(settled);
      expect(writes.count()).toBe(0);
      expect(sessionStorage.getItem(key)).toBe(storedBefore);
    });
  });

  /**
   * Afvisning FØR observerbar mutation. Kørt kun for de arter, der HAR en afviselig form — hvilket
   * registret erklærer eksplicit frem for at lade en manglende case se ud som en dækket.
   */
  const REJECTING_KINDS = CASE_KINDS.filter((kind) => COMMAND_CASES[kind].reject !== null);

  it('mindst halvdelen af arterne har en afviselig form (registret er ikke tømt for reject-ben)', () => {
    // Gulvet gør en fremtidig "sæt reject: null overalt"-opblødning synlig.
    expect(REJECTING_KINDS.length).toBeGreaterThanOrEqual(7);
  });

  describe.each(REJECTING_KINDS)('%s — afvisning', (kind) => {
    it('afvises FØR nogen observerbar mutation af input, revision, history eller storage', () => {
      const testCase: CommandCase = COMMAND_CASES[kind];
      testCase.arrange?.();
      const options = testCase.options?.() ?? {};
      // Nogle arter kræver, at mutationen HAR kørt, før den afviselige form er afvisbar
      // (fx `insertRow`s dublet). At køre den er harmløst for de øvrige.
      dispatchInput(store, catalog, testCase.mutate(), options);

      const before = store.getState();
      const storedBefore = sessionStorage.getItem(key);
      const writes = countWrites(store);
      let threw = false;
      try {
        dispatchInput(store, catalog, testCase.reject!(), options);
      } catch {
        threw = true;
      }
      writes.stop();

      expect(threw, `${kind}: den afviselige form blev ACCEPTERET`).toBe(true);
      expect(store.getState()).toBe(before);
      expect(store.getState().revision).toBe(before.revision);
      expect(store.getState().history.past.length).toBe(before.history.past.length);
      expect(writes.count()).toBe(0);
      expect(sessionStorage.getItem(key)).toBe(storedBefore);
    });
  });

  /**
   * §7.4's `row-delete uden descendants/orphans` som sin egen, artspecifikke assertion: de generiske
   * invarianter ovenfor kan ikke se, om en rækkes rejected råtekst gik med rækken.
   */
  it('row-delete efterlader hverken rejected descendants eller orphan-adresser', () => {
    seedRow();
    dispatchInput(store, catalog, cmd(settleField(tillaegstidField.bind(ROW_A), 'abc')));
    expect(Object.keys(store.getState().input.rejectedInputs)).toHaveLength(1);

    dispatchInput(store, catalog, cmd(deleteRow(rentekravRowsRef(), ROW_A)), { origin: testRowOrigin() });

    const input: SettledInput = store.getState().input;
    expect(input.rejectedInputs).toEqual({});
    expect(input.sections.renteberegning?.rentekravRows ?? []).toHaveLength(0);
  });
});

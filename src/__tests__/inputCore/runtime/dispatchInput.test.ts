// @vitest-environment jsdom
import {
  __createSlimInputTestStore,
  dispatchInput,
  initializeInputRuntime,
  captureStableInput,
  captureStableInputEvaluation,
  readSourceToken,
  serializeCurrentEnvelope,
  parseCurrentEnvelope,
  CURRENT_INPUT_ENVELOPE_VERSION,
  type SlimInputStore,
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
  replaceCase,
  clearCase,
  createEmptySettledInput,
  serializeFieldAddress,
  type InputCatalog,
  type FieldRef,
  type SettledInput,
} from '../../../inputCore';
import { createValidationReader } from '../../../inputCore/inputReader';
import { getCurrentInputEnvelopeStorageKey } from '../../../config/storageManifest';
import { PERSISTED_DATA_VERSION } from '../../../config/persistenceVersion';
import {
  createTestCatalog,
  aargangField,
  belobField,
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

const canonical = <T>(input: SettledInput, field: FieldRef<T>): T =>
  createValidationReader(input, catalog).readCanonical(field);

const rejectedAt = <T>(input: SettledInput, field: FieldRef<T>) =>
  input.rejectedInputs[serializeFieldAddress(field.address)];

const readStoredInput = (): SettledInput | null => {
  const raw = sessionStorage.getItem(key);
  return raw === null ? null : parseCurrentEnvelope(raw);
};

const countWrites = (target: SlimInputStore): { count: () => number; stop: () => void } => {
  let writes = 0;
  const unsub = target.subscribe(() => { writes += 1; });
  return { count: () => writes, stop: unsub };
};

describe('dispatchInput — transaktionsinvarianter (§7.4)', () => {
  it('afviser en ukendt/slettet feltreference FØR nogen observerbar mutation', () => {
    const before = store.getState();
    expect(() => dispatchInput(store, catalog, settleField(tillaegstidField.bind('findes-ikke'), '5')))
      .toThrow();
    expect(store.getState()).toBe(before); // ingen store-mutation
    expect(sessionStorage.getItem(key)).toBeNull(); // ingen session-write
  });

  it('ét gyldigt settle: canonical skrives, ét store-write, én monoton revision, ét history-trin', () => {
    const writes = countWrites(store);
    const result = dispatchInput(store, catalog, settleField(aargangField.bind(), '2020'), { now: 1 });
    writes.stop();

    expect(result).toEqual({ changed: true, revision: 1 });
    expect(writes.count()).toBe(1);
    expect(store.getState().revision).toBe(1);
    expect(store.getState().history.past).toHaveLength(1);
    expect(canonical(store.getState().input, aargangField.bind())).toBe(2020);
    // Storage og runtime er byte-konsistente.
    expect(readStoredInput()).toEqual(store.getState().input);
  });

  it('ugyldigt settle rydder canonical til tomværdi OG skriver rå fejlende tekst atomisk (XOR §1.5)', () => {
    dispatchInput(store, catalog, settleField(aargangField.bind(), '2020'), { now: 1 });
    dispatchInput(store, catalog, settleField(aargangField.bind(), 'abc'), { now: 2 });

    const input = store.getState().input;
    expect(canonical(input, aargangField.bind())).toBeUndefined(); // 2020 er væk fra current
    expect(rejectedAt(input, aargangField.bind())).toEqual({ raw: 'abc', reason: 'format' });
    expect(readStoredInput()).toEqual(input);
  });

  it('semantisk no-op giver intet write, ingen ny revision og intet history-trin', () => {
    dispatchInput(store, catalog, settleField(aargangField.bind(), '2020'), { now: 1 });
    const afterFirst = store.getState();
    const storedBefore = sessionStorage.getItem(key);

    const writes = countWrites(store);
    const result = dispatchInput(store, catalog, settleField(aargangField.bind(), '2020'), { now: 2 });
    writes.stop();

    expect(result).toEqual({ changed: false, revision: afterFirst.revision });
    expect(store.getState()).toBe(afterFirst); // uændret reference
    expect(writes.count()).toBe(0);
    expect(sessionStorage.getItem(key)).toBe(storedBefore);
  });

  it('at rydde et allerede ryddet felt er en no-op (round-trip-normalisering, ikke falsk ændring)', () => {
    // Afdækker JSON-normaliseringsfælden: kandidatens `{aargang: undefined}` normaliseres til samme `{}` som den
    // gemte form, så re-clear ikke fejlagtigt tæller som en ændring.
    dispatchInput(store, catalog, settleField(aargangField.bind(), '2020'), { now: 1 });
    dispatchInput(store, catalog, clearField(aargangField.bind()), { now: 2 }); // rydder 2020
    const afterClear = store.getState();

    const writes = countWrites(store);
    const result = dispatchInput(store, catalog, clearField(aargangField.bind()), { now: 3 });
    writes.stop();

    expect(result.changed).toBe(false);
    expect(store.getState()).toBe(afterClear);
    expect(writes.count()).toBe(0);
  });

  it('ruller storage og runtime tilbage ved en storage-skrivefejl', () => {
    const realStorage = window.sessionStorage;
    const throwingStorage: Storage = {
      getItem: () => null,
      setItem: () => { throw new DOMException('lager fyldt', 'QuotaExceededError'); },
      removeItem: () => undefined,
      clear: () => undefined,
      key: () => null,
      length: 0,
    };
    Object.defineProperty(window, 'sessionStorage', { value: throwingStorage, configurable: true });
    try {
      expect(() => dispatchInput(store, catalog, settleField(aargangField.bind(), '2020'))).toThrow();
    } finally {
      Object.defineProperty(window, 'sessionStorage', { value: realStorage, configurable: true });
    }
    expect(store.getState().revision).toBe(0); // ingen revision
    expect(store.getState().history.past).toHaveLength(0);
    expect(sessionStorage.getItem(key)).toBeNull(); // rigtig storage aldrig skrevet
  });

  it('blokerer efterfølgende writes, når storage-rollback ikke kan byte-verificeres', () => {
    const realStorage = window.sessionStorage;
    let stored: string | null = null;
    const corruptStorage: Storage = {
      getItem: () => stored,
      setItem: () => { stored = 'korrupt-readback'; },
      // Simulerer en storage, som ignorerer rollback-fjernelsen.
      removeItem: () => undefined,
      clear: () => undefined,
      key: () => null,
      length: 1,
    };
    Object.defineProperty(window, 'sessionStorage', { value: corruptStorage, configurable: true });
    try {
      expect(() => dispatchInput(store, catalog, settleField(aargangField.bind(), '2020')))
        .toThrow(/rollback fejlede/);
    } finally {
      Object.defineProperty(window, 'sessionStorage', { value: realStorage, configurable: true });
    }

    expect(store.getState().revision).toBe(0);
    expect(store.getState().meta.inputWritesBlocked).toBe(true);
    expect(() => dispatchInput(store, catalog, settleField(aargangField.bind(), '2020'))).toThrow(/blokeret/);
  });

  it('ruller runtime tilbage til før-snapshot, hvis et store-write kaster efter set', () => {
    let calls = 0;
    const unsub = store.subscribe(() => { calls += 1; if (calls === 1) throw new Error('subscriber-fejl'); });
    try {
      expect(() => dispatchInput(store, catalog, settleField(aargangField.bind(), '2020'))).toThrow();
    } finally {
      unsub();
    }
    // Rollback gendrev til før-snapshot; storage rullet tilbage til fraværende.
    expect(store.getState().revision).toBe(0);
    expect(canonical(store.getState().input, aargangField.bind())).toBeUndefined();
    expect(sessionStorage.getItem(key)).toBeNull();
  });

  it('autoritativ replacement (replaceCase) skriver altid, rydder history og skaber ny revision', () => {
    dispatchInput(store, catalog, settleField(aargangField.bind(), '2020'), { now: 1 });
    dispatchInput(store, catalog, insertRow(rentekravRowsRef(), makeRow('r1')), { now: 2, origin: testRowOrigin() });
    expect(store.getState().history.past.length).toBe(2);

    const revisionBefore = store.getState().revision;
    const result = dispatchInput(store, catalog, replaceCase(createEmptySettledInput()), { now: 3 });

    expect(result.changed).toBe(true);
    expect(result.revision).toBe(revisionBefore + 1); // ny monoton revision
    expect(store.getState().history.past).toHaveLength(0); // history ryddet
    expect(store.getState().input).toEqual(createEmptySettledInput());
  });
});

describe('dispatchInput — undo/redo (§3.6/§7.2)', () => {
  it('gyldig A → ugyldig X → undo → redo gendanner hele tilstandene, hver med en ny revision', () => {
    dispatchInput(store, catalog, settleField(aargangField.bind(), '2020'), { now: 1 });
    dispatchInput(store, catalog, settleField(aargangField.bind(), 'abc'), { now: 2 });
    expect(rejectedAt(store.getState().input, aargangField.bind())?.raw).toBe('abc');
    const revAfterX = store.getState().revision;

    const undo = dispatchInput(store, catalog, { kind: 'undo' }, { now: 3 });
    expect(undo.changed).toBe(true);
    expect(undo.revision).toBe(revAfterX + 1);
    expect(canonical(store.getState().input, aargangField.bind())).toBe(2020);
    expect(rejectedAt(store.getState().input, aargangField.bind())).toBeUndefined();
    expect(readStoredInput()).toEqual(store.getState().input);

    const redo = dispatchInput(store, catalog, { kind: 'redo' }, { now: 4 });
    expect(redo.changed).toBe(true);
    expect(redo.revision).toBe(revAfterX + 2);
    expect(canonical(store.getState().input, aargangField.bind())).toBeUndefined();
    expect(rejectedAt(store.getState().input, aargangField.bind())?.raw).toBe('abc');
    expect(readStoredInput()).toEqual(store.getState().input);
  });

  it('undo uden history er en no-op uden write', () => {
    const writes = countWrites(store);
    const result = dispatchInput(store, catalog, { kind: 'undo' });
    writes.stop();
    expect(result.changed).toBe(false);
    expect(writes.count()).toBe(0);
    expect(store.getState().revision).toBe(0);
  });

  it('række-fejl → slet række → undo → redo bevarer hele snapshotkæden', () => {
    dispatchInput(store, catalog, insertRow(rentekravRowsRef(), makeRow('r1')), { now: 1, origin: testRowOrigin() });
    dispatchInput(store, catalog, settleField(tillaegstidField.bind('r1'), 'abc'), { now: 2 }); // format-rejected råtekst
    dispatchInput(store, catalog, deleteRow(rentekravRowsRef(), 'r1'), { now: 3, origin: testRowOrigin() });

    dispatchInput(store, catalog, { kind: 'undo' }, { now: 4 });
    expect(rejectedAt(store.getState().input, tillaegstidField.bind('r1'))?.raw).toBe('abc');

    dispatchInput(store, catalog, { kind: 'redo' }, { now: 5 });
    expect(store.getState().input.sections.renteberegning?.rentekravRows ?? []).toHaveLength(0);
    expect(Object.keys(store.getState().input.rejectedInputs)).toHaveLength(0);
  });

  it('en ny inputgren efter undo rydder redo-fremtiden', () => {
    dispatchInput(store, catalog, settleField(aargangField.bind(), '2020'), { now: 1 });
    dispatchInput(store, catalog, settleField(aargangField.bind(), '2021'), { now: 2 });
    dispatchInput(store, catalog, { kind: 'undo' }, { now: 3 });
    expect(store.getState().history.future).toHaveLength(1);
    dispatchInput(store, catalog, settleField(aargangField.bind(), '2022'), { now: 4 });
    expect(store.getState().history.future).toHaveLength(0);
    expect(canonical(store.getState().input, aargangField.bind())).toBe(2022);
  });
});

describe('dispatchInput — restoredOrigin surfaces kun ved en gennemført undo/redo (§3.7, WI-003)', () => {
  const originFor = <T>(field: FieldRef<T>) => ({
    kind: 'field' as const,
    field: field.address,
    editorLocationId: 'test:aargang',
    route: '/satser',
    tabKey: null,
  });

  it('undo/redo returnerer det gendannede frames origin efter en gennemført commit', () => {
    // Push et frame MED origin: originen fanges på det FØR-snapshot, pushInputHistory gemmer ved den næste ændring.
    dispatchInput(store, catalog, settleField(aargangField.bind(), '2020'),
      { now: 1, origin: originFor(aargangField.bind()) });
    dispatchInput(store, catalog, settleField(aargangField.bind(), '2021'),
      { now: 2, origin: originFor(aargangField.bind()) });

    const undo = dispatchInput(store, catalog, { kind: 'undo' }, { now: 3 });
    expect(undo.changed).toBe(true);
    expect(undo.restoredOrigin).toEqual(originFor(aargangField.bind()));

    const redo = dispatchInput(store, catalog, { kind: 'redo' }, { now: 4 });
    expect(redo.changed).toBe(true);
    expect(redo.restoredOrigin).toEqual(originFor(aargangField.bind()));
  });

  it('en no-op undo (ingen history) surfacer ingen origin', () => {
    const result = dispatchInput(store, catalog, { kind: 'undo' });
    expect(result.changed).toBe(false);
    expect(result.restoredOrigin).toBeUndefined();
  });

  // En STRUKTUREL rækkehandling bærer en origin UDEN feltadresse (§3.7): der er intet enkelt felt, men route +
  // fane skal med, så undo af en slet/indsæt/sortér navigerer til den tabel, ændringen kom fra.
  it('en rækkehandlings origin (uden feltadresse) surfacer route + fane ved undo', () => {
    const rowOrigin = {
      kind: 'collection' as const,
      collection: 'rentekravRows',
      editorLocationId: 'test.rentekrav:rows:rentekravRows',
      route: '/renteberegning',
      tabKey: null,
    };

    dispatchInput(store, catalog, insertRow(rentekravRowsRef(), makeRow('r1')), { now: 1, origin: rowOrigin });
    dispatchInput(store, catalog, insertRow(rentekravRowsRef(), makeRow('r2')), { now: 2, origin: rowOrigin });

    const undo = dispatchInput(store, catalog, { kind: 'undo' }, { now: 3 });

    expect(undo.changed).toBe(true);
    expect(undo.restoredOrigin).toEqual(rowOrigin);
    expect(undo.restoredOrigin?.kind).toBe('collection');
  });

  // WI-004 runde 4 (fund S4): en STRUKTUREL rækkecommand skal have en origin, så undo/redo altid har et
  // restore-anker. Kernetypen krævede route+fane, men PORTEN tillod at udelade origin HELT — history gemte da
  // `undefined`, og en undo kunne gendanne en række uden noget sted at navigere til.
  //
  // Kravet er "origin SKAL være der", ikke "origin skal være af arten collection": en række-PROMOVERING er
  // kontraktligt et felt-settle (§3.8) og bærer med rette et feltorigin, så undo fokuserer den skrevne celle.
  describe('strukturelle rækkecommands kræver en origin (§3.7)', () => {
    const structuralCommands = [
      { navn: 'insertRow', command: () => insertRow(rentekravRowsRef(), makeRow('r9')) },
      { navn: 'deleteRow', command: () => deleteRow(rentekravRowsRef(), 'r1') },
      { navn: 'reorderRows', command: () => reorderRows(rentekravRowsRef(), ['r1']) },
      {
        navn: 'settleFieldInNewRow',
        command: () => settleFieldInNewRow(rentekravRowsRef(), makeRow('r9'), belobField.bind('r9'), '100'),
      },
      {
        navn: 'structuralInputTransaction',
        command: () => structuralInputTransaction([inputTransactionStep(deleteRow(rentekravRowsRef(), 'r1'))]),
      },
    ] as const;

    for (const { navn, command } of structuralCommands) {
      it(`${navn} uden origin kaster UDEN at mutere input, revision, history eller storage`, () => {
        dispatchInput(store, catalog, insertRow(rentekravRowsRef(), makeRow('r1')), { origin: testRowOrigin() });
        const before = store.getState();
        const storedBefore = sessionStorage.getItem(key);

        // @ts-expect-error — origin er PÅKRÆVET for en strukturel command; castet efterligner utypet kode.
        expect(() => dispatchInput(store, catalog, command(), {})).toThrow(/kræver en history-origin/);

        const after = store.getState();
        expect(after.input).toEqual(before.input);
        expect(after.revision).toBe(before.revision);
        expect(after.history).toEqual(before.history);
        expect(sessionStorage.getItem(key)).toBe(storedBefore);
      });
    }

    // Runtime-værnet findes præcis for de kald, der omgår typerne — så det skal afvise et DELVIST origin, ikke
    // kun et helt tomt. `{ kind: 'collection' }` har `undefined` i sine felter, og `undefined !== ''` er sandt:
    // en ren tomstrengs-sammenligning ville lade et ubrugeligt anker passere.
    const invalidOrigins: ReadonlyArray<readonly [string, unknown]> = [
      ['helt tomt objekt', {}],
      ['kun kind: collection', { kind: 'collection' }],
      ['kun kind: field', { kind: 'field' }],
      ['collection uden route', { kind: 'collection', collection: 'rentekravRows', editorLocationId: 'x', tabKey: null }],
      ['collection uden tabKey', { kind: 'collection', collection: 'rentekravRows', editorLocationId: 'x', route: '/r' }],
      ['collection med tom route', { kind: 'collection', collection: 'rentekravRows', editorLocationId: 'x', route: '', tabKey: null }],
      ['field uden feltadresse', { kind: 'field', editorLocationId: 'x', route: '/r', tabKey: null }],
      ['tom editorLocationId', { kind: 'collection', collection: 'rentekravRows', editorLocationId: '', route: '/r', tabKey: null }],
      // Re-review T3: en UKENDT `kind` faldt før ned i rækkehandlings-grenen og passerede som noget, den ikke er.
      ['ukendt kind med collection-felter', {
        kind: 'bogus', collection: 'rentekravRows', editorLocationId: 'x', route: '/r', tabKey: null,
      }],
      // ...og et feltanker med en HALV adresse fejlede først ved serialisering i restoren — langt fra fejlkilden.
      ['field med halv adresse', { kind: 'field', editorLocationId: 'x', field: { section: 'renteberegning' } }],
      ['field med adresse uden path', {
        kind: 'field', editorLocationId: 'x', field: { section: 'renteberegning', field: 'belob' },
      }],
      // Verifikationsrunde: et array er ikke nok — SEGMENTERNES form skal også være gyldig, ellers fejler
      // først `serializeFieldAddress` inde i restoren. Valideres nu mod det kanoniske `fieldAddressSchema`.
      ['field med tomt path-segment', {
        kind: 'field',
        editorLocationId: 'x',
        field: { section: 'renteberegning', path: [{}], field: 'belob' },
      }],
      ['field med ukendt sektion', {
        kind: 'field',
        editorLocationId: 'x',
        field: { section: 'findes-ikke', path: [], field: 'belob' },
      }],
      ['field med entity-segment uden entityId', {
        kind: 'field',
        editorLocationId: 'x',
        field: {
          section: 'renteberegning',
          path: [{ kind: 'entity', collection: 'rentekravRows' }],
          field: 'belob',
        },
      }],
      // ...og et whitespace-anker er heller ikke brugbart: `' ' !== ''` er sandt, men restoren ville lede
      // efter en lokation/route, der ikke findes. Samme standard som `addressPartSchema`.
      ['collection med whitespace-felter', {
        kind: 'collection', collection: ' ', editorLocationId: ' ', route: ' ', tabKey: null,
      }],
      ['collection med whitespace-route', {
        kind: 'collection', collection: 'rentekravRows', editorLocationId: 'x', route: '  ', tabKey: null,
      }],
      ['collection med utrimmet locationId', {
        kind: 'collection', collection: 'rentekravRows', editorLocationId: 'x ', route: '/r', tabKey: null,
      }],
      // Et FELT-anker må udelade destinationen (standalone er ikke-navigerbar), men er den ANGIVET, skal den
      // være brugbar — ellers sendes restoren efter en route/fane, der ikke findes.
      ['field med whitespace-route', {
        kind: 'field',
        editorLocationId: 'x',
        field: { section: 'renteberegning', path: [], field: 'beregningsdato' },
        route: ' ',
        tabKey: null,
      }],
      ['field med whitespace-tabKey', {
        kind: 'field',
        editorLocationId: 'x',
        field: { section: 'renteberegning', path: [], field: 'beregningsdato' },
        route: '/renteberegning',
        tabKey: '  ',
      }],
    ];

    for (const [navn, origin] of invalidOrigins) {
      it(`afviser et castet, ubrugeligt origin (${navn})`, () => {
        expect(() => dispatchInput(
          store,
          catalog,
          insertRow(rentekravRowsRef(), makeRow('r1')),
          { origin: origin as never }
        )).toThrow(/kræver en history-origin/);
        expect(store.getState().revision).toBe(0);
      });
    }

    it('ACCEPTERER et feltanker UDEN destination (standalone er ikke-navigerbar)', () => {
      // Grænsen for stramningen ovenfor: en UDELADT route/fane er lovlig og dokumenteret (standalone
      // MinProcesrente); kun en ANGIVET, ubrugelig værdi afvises. Ellers ville værnet brække standalone.
      const result = dispatchInput(
        store,
        catalog,
        settleFieldInNewRow(rentekravRowsRef(), makeRow('r1'), belobField.bind('r1'), '100'),
        {
          now: 1,
          origin: {
            kind: 'field',
            field: belobField.bind('r1').address,
            editorLocationId: 'standalone.rentekrav:cell:belob',
          },
        }
      );

      expect(result.changed).toBe(true);
    });

    it('ACCEPTERER en promovering med FELTORIGIN — undo fokuserer den skrevne celle', () => {
      // Promoveringen er et felt-settle (§3.8). Et krav om collection-origin dér ville give en DÅRLIGERE
      // restore: brugeren ville blot landes på tabellen i stedet for i cellen.
      const fieldOrigin = {
        kind: 'field' as const,
        field: belobField.bind('r1').address,
        editorLocationId: 'test.rentekrav:cell:belob',
        route: '/renteberegning',
        tabKey: null,
      };

      const result = dispatchInput(
        store,
        catalog,
        settleFieldInNewRow(rentekravRowsRef(), makeRow('r1'), belobField.bind('r1'), '100'),
        { now: 1, origin: fieldOrigin }
      );
      expect(result.changed).toBe(true);

      const undo = dispatchInput(store, catalog, { kind: 'undo' }, { now: 2 });
      expect(undo.restoredOrigin).toEqual(fieldOrigin);
      expect(undo.restoredOrigin?.kind).toBe('field');
    });

    it('en ren felttransaktion kræver INGEN origin — den er ikke strukturel', () => {
      // Modstykket: kravet må ikke blive så bredt, at en feltransaktion skal opfinde en rækkeorigin.
      expect(() => dispatchInput(
        store,
        catalog,
        inputTransaction([inputTransactionStep(settleField(aargangField.bind(), '2024'))])
      )).not.toThrow();
    });

    it('`inputTransaction` afviser et strukturelt trin, så klassifikationen ikke kan omgås', () => {
      expect(() => inputTransaction([inputTransactionStep(deleteRow(rentekravRowsRef(), 'r1'))]))
        .toThrow(/structuralInputTransaction/);
    });
  });

  it('et frame uden origin surfacer ingen origin ved undo', () => {
    // Ingen origin sendt med → frame'et bærer ingen origin → restoren navigerer ikke.
    dispatchInput(store, catalog, settleField(aargangField.bind(), '2020'), { now: 1 });
    dispatchInput(store, catalog, settleField(aargangField.bind(), '2021'), { now: 2 });
    const undo = dispatchInput(store, catalog, { kind: 'undo' }, { now: 3 });
    expect(undo.changed).toBe(true);
    expect(undo.restoredOrigin).toBeUndefined();
  });

  it('en fejlende restore-commit surfacer ingen origin (kaster i stedet, ruller tilbage)', () => {
    dispatchInput(store, catalog, settleField(aargangField.bind(), '2020'),
      { now: 1, origin: originFor(aargangField.bind()) });
    dispatchInput(store, catalog, settleField(aargangField.bind(), '2021'),
      { now: 2, origin: originFor(aargangField.bind()) });

    const realStorage = window.sessionStorage;
    const throwingStorage: Storage = {
      getItem: () => null,
      setItem: () => { throw new DOMException('lager fyldt', 'QuotaExceededError'); },
      removeItem: () => undefined,
      clear: () => undefined,
      key: () => null,
      length: 0,
    };
    Object.defineProperty(window, 'sessionStorage', { value: throwingStorage, configurable: true });
    try {
      // commitCandidate kaster ved storage-fejl FØR restoredOrigin nogensinde sættes.
      expect(() => dispatchInput(store, catalog, { kind: 'undo' }, { now: 3 })).toThrow();
    } finally {
      Object.defineProperty(window, 'sessionStorage', { value: realStorage, configurable: true });
    }
  });
});

describe('dispatchInput — styrende valg rydder nu-irrelevant fejl (§1.9/§3.6)', () => {
  it('setImmediateField der gør et felt med aktiv bounds-fejl irrelevant rydder canonical som ét trin; bevarer gyldigt nabofelt', () => {
    dispatchInput(store, catalog, insertRow(rentekravRowsRef(), makeRow('r1')), { now: 1, origin: testRowOrigin() });
    dispatchInput(store, catalog, settleField(belobField.bind('r1'), '500'), { now: 2 });
    // '999' > max 100 committes canonical (999) med en rød bounds-feltfejl (§1.6).
    dispatchInput(store, catalog, settleField(tillaegstidField.bind('r1'), '999'), { now: 3 });
    expect(canonical(store.getState().input, tillaegstidField.bind('r1'))).toBe(999);
    expect(rejectedAt(store.getState().input, tillaegstidField.bind('r1'))).toBeUndefined();

    dispatchInput(store, catalog, setImmediateField(enhedField.bind('r1'), 'uger'), { now: 4 });

    const input = store.getState().input;
    // §3.6 trin 5: en canonical bounds-værdi, der bliver irrelevant, ryddes til tomværdien.
    expect(canonical(input, tillaegstidField.bind('r1'))).toBeUndefined();
    expect(rejectedAt(input, tillaegstidField.bind('r1'))).toBeUndefined();
    expect(canonical(input, belobField.bind('r1'))).toBeDefined(); // bevaret
    expect(store.getState().history.past.length).toBe(4); // netop ét history-trin for valget
  });
});

describe('currentSessionEnvelope', () => {
  it('round-trip bevarer det afsluttede input', () => {
    dispatchInput(store, catalog, settleField(aargangField.bind(), '2020'));
    dispatchInput(store, catalog, settleField(aargangField.bind(), 'abc'));
    const input = store.getState().input;
    expect(parseCurrentEnvelope(serializeCurrentEnvelope(input))).toEqual(input);
  });

  it('bærer den aktuelle envelope-version og afviser en forkert version', () => {
    const serialized = serializeCurrentEnvelope(createEmptySettledInput());
    expect(JSON.parse(serialized).envelopeVersion).toBe(CURRENT_INPUT_ENVELOPE_VERSION);
    const wrongVersion = JSON.stringify({ ...JSON.parse(serialized), envelopeVersion: '1' });
    expect(() => parseCurrentEnvelope(wrongVersion)).toThrow();
    expect(() => parseCurrentEnvelope('ikke json{')).toThrow();
  });

  it('afviser en anden persisted dataversion som current-session-korruption', () => {
    const serialized = JSON.parse(serializeCurrentEnvelope(createEmptySettledInput())) as Record<string, unknown>;
    expect(serialized.persistedDataVersion).toBe(PERSISTED_DATA_VERSION);
    expect(() => parseCurrentEnvelope(JSON.stringify({
      ...serialized,
      persistedDataVersion: 'forældet-version',
    }))).toThrow();
  });
});

describe('initializeInputRuntime — hydration og fail-closed (§1.12/§3.10)', () => {
  it('uden en aktiv session starter tomt med writes tilladt', () => {
    const startup = initializeInputRuntime(store, catalog);
    expect(startup.notice).toBeNull();
    expect(store.getState().meta.hydrated).toBe(true);
    expect(store.getState().meta.inputWritesBlocked).toBeUndefined();
    // Writes er tilladt.
    expect(dispatchInput(store, catalog, settleField(aargangField.bind(), '2020')).changed).toBe(true);
  });

  it('genindlæser en gyldig gemt session', () => {
    dispatchInput(store, catalog, settleField(aargangField.bind(), '2020'), { now: 1 });
    const persisted = store.getState().input;

    const fresh = __createSlimInputTestStore();
    const startup = initializeInputRuntime(fresh, catalog);
    expect(startup.notice).toBeNull();
    expect(fresh.getState().input).toEqual(persisted);
    expect(canonical(fresh.getState().input, aargangField.bind())).toBe(2020);
  });

  it('fail-closed ved korruption: bevarer rå kilde, blokerer writes, viser fejl', () => {
    sessionStorage.setItem(key, 'korrupt envelope}{');
    const startup = initializeInputRuntime(store, catalog);

    expect(startup.notice?.type).toBe('error');
    expect(store.getState().meta.inputWritesBlocked).toBe(true);
    expect(sessionStorage.getItem(key)).toBe('korrupt envelope}{'); // rå kilde uændret

    // Normale writes er blokeret …
    expect(() => dispatchInput(store, catalog, settleField(aargangField.bind(), '2020'))).toThrow(/blokeret/);
    expect(sessionStorage.getItem(key)).toBe('korrupt envelope}{'); // stadig uændret

    // … men `Slet alt` rydder kilden og ophæver blokeringen (§1.12).
    const cleared = dispatchInput(store, catalog, clearCase(), { now: 9 });
    expect(cleared.changed).toBe(true);
    expect(store.getState().meta.inputWritesBlocked).toBeUndefined();
    expect(parseCurrentEnvelope(sessionStorage.getItem(key)!)).toEqual(createEmptySettledInput());
    // Efter recovery er writes tilladt igen.
    expect(dispatchInput(store, catalog, settleField(aargangField.bind(), '2020')).changed).toBe(true);
  });

  it('fail-closer en envelope med anden persisted dataversion og bevarer de rå bytes', () => {
    const raw = JSON.stringify({
      ...JSON.parse(serializeCurrentEnvelope(createEmptySettledInput())),
      persistedDataVersion: 'forældet-version',
    });
    sessionStorage.setItem(key, raw);

    const startup = initializeInputRuntime(store, catalog);

    expect(startup.notice?.type).toBe('error');
    expect(store.getState().meta.inputWritesBlocked).toBe(true);
    expect(sessionStorage.getItem(key)).toBe(raw);
  });
});

describe('EvaluationSourceToken-binding (§3.4)', () => {
  it('input-mutation gør tokenet stale; settingsbump gør det også stale', () => {
    const t0 = readSourceToken(store);
    dispatchInput(store, catalog, settleField(aargangField.bind(), '2020'));
    const t1 = readSourceToken(store);
    expect(t1.inputRevision).not.toBe(t0.inputRevision);

    store.getState().bumpSettingsRevision();
    const t2 = readSourceToken(store);
    expect(t2.settingsRevision).not.toBe(t1.settingsRevision);
    expect(t2.inputRevision).toBe(t1.inputRevision); // uændret input
  });

  it('captureStableInput binder input til den aktuelle revision', () => {
    dispatchInput(store, catalog, settleField(aargangField.bind(), '2020'));
    const snapshot = captureStableInput(store);
    expect(snapshot.token.inputRevision).toBe(store.getState().revision);
    expect(snapshot.input).toEqual(store.getState().input);
  });

  it('captureStableInputEvaluation skjuler en værdi bag en aktiv feltfejl', () => {
    dispatchInput(store, catalog, settleField(aargangField.bind(), 'abc'));
    const evaluation = captureStableInputEvaluation(store, catalog, {});
    expect(evaluation.reader.read(aargangField.bind()).status).toBe('error');
    expect(evaluation.reader.sourceToken.inputRevision).toBe(store.getState().revision);
  });
});

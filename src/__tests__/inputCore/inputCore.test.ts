import {
  reduceInputCommand,
  settleField,
  setImmediateField,
  clearField,
  insertRow,
  deleteRow,
  reorderRows,
  settleFieldInNewRow,
  inputTransaction,
  inputTransactionStep,
  resetSection,
  replaceCase,
  clearCase,
  createInputEvaluation,
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
  captureStableSource,
  runProjection,
  createInputHistory,
  pushInputHistory,
  undoInputHistory,
  redoInputHistory,
  serializeFieldAddress,
  createInputCatalog,
  catalogFields,
  defineField,
  createIntegerFieldCodec,
  createDateFieldCodec,
  type SettledInput,
  type InputMutationCommand,
  type InputHistory,
  type FieldRef,
  MAX_INPUT_HISTORY_STEPS,
} from '../../inputCore';
import { projectEoSave } from '../../persistence/eoSaveProjection';
import { createValidationReader, deriveFieldIssueSet } from '../../inputCore/inputReader';
import { activeFieldIssue } from '../../inputCore/inputIssue';
import {
  createTestCatalog,
  createAutoPruningTestCatalog,
  aargangField,
  beregningsdatoField,
  belobField,
  tillaegstidField,
  enhedField,
  makeRow,
  rentekravRowsRef,
} from './testCatalog';

const catalog = createTestCatalog();

const token = createEvaluationSourceToken(createInputRevision(1), createSettingsRevision(1));

const empty = (): SettledInput => catalog.validateSettledInput({
  sections: {
    stamdata: null, satser: null, aarsloen: null, faellesAarsloen: null, renteberegning: null,
    varigemen: null, forsoergertab: null, erstatningsopgoerelse: null, erhvervsevnetab: null,
  },
  rejectedInputs: {},
});

// Lille runtime-harness: anvend en mutation, valider, og skub history ved reel ændring (som Fase-2-runneren vil).
type State = Readonly<{ input: SettledInput; history: InputHistory }>;
const start = (): State => {
  const input = empty();
  return { input, history: createInputHistory() };
};
const apply = <TField, TEntity>(state: State, command: InputMutationCommand<TField, TEntity>): State => {
  const result = reduceInputCommand(state.input, command, catalog);
  if (!result.changed) return state;
  return { input: result.input, history: pushInputHistory(state.history, state.input) };
};

const reader = (input: SettledInput) => {
  return createInputEvaluation({ input, catalog, sourceToken: token }).reader;
};

const rejectedAt = <T>(input: SettledInput, field: FieldRef<T>) =>
  input.rejectedInputs[serializeFieldAddress(field.address)];

describe('Feltdefinitioner', () => {
  it('afviser datofelter uden en aktiv dateBounds-erklæring', () => {
    expect(() => defineField({
      id: 'renteberegning.testDatoUdenBounds',
      template: { section: 'renteberegning', path: [], field: 'testDatoUdenBounds' },
      codec: createDateFieldCodec({ twoDigitYearPolicy: 'infer' }),
      emptyValue: undefined,
      isEmpty: (value) => value === undefined,
      label: 'Testdato uden bounds',
      controlKind: 'text',
      readCanonical: () => undefined,
      writeCanonical: (sections) => sections,
    })).toThrow(/dateBounds/);
  });
});

describe('SettledInput XOR-invariant (§1.5, §2.1)', () => {
  it('gyldig A → ugyldig X efterlader ikke A i current snapshot', () => {
    const afterValid = apply(start(), settleField(aargangField.bind(), '2020'));
    expect(catalog.validateSettledInput(afterValid.input).sections.satser).toEqual({ aargang: 2020 });

    const afterInvalid = apply(afterValid, settleField(aargangField.bind(), 'abc'));
    const canonical = createValidationReader(afterInvalid.input, catalog).readCanonical(aargangField.bind());

    expect(canonical).toBeUndefined(); // A (2020) er væk fra current state
    expect(rejectedAt(afterInvalid.input, aargangField.bind())).toEqual({ raw: 'abc', reason: 'format' });
  });

  it('afviser en kandidat med både rejected råtekst og en ikke-tom canonical værdi', () => {
    const address = serializeFieldAddress(aargangField.bind().address);
    expect(() => catalog.validateSettledInput({
      sections: { ...empty().sections, satser: { aargang: 2020 } },
      rejectedInputs: { [address]: { raw: 'abc', reason: 'format' } },
    })).toThrow(/ikke-tom canonical/);
  });

  it('afviser rejected råtekst, der ikke matcher feltets codec', () => {
    const address = serializeFieldAddress(tillaegstidField.bind('r1').address);
    const sections = {
      ...empty().sections,
      renteberegning: { beregningsdato: undefined, kommentarer: undefined, rentekravRows: [makeRow('r1')] },
    };
    expect(() => catalog.validateSettledInput({
      sections,
      rejectedInputs: { [address]: { raw: '999', reason: 'format' } },
    })).toThrow(/matcher ikke feltets codec/);
  });

  it('AFVISER en færdig tilstand med rejected råtekst i et skjult felt (§7.5 pkt. 2)', () => {
    // Relevans-invarianten er det, der BEVISER, at `reduceImmediateChoice`s rydning er komplet: en skjult
    // rejection ville blokere `.eo`-save globalt (§8) fra et felt, brugeren hverken kan se eller rette.
    const address = serializeFieldAddress(tillaegstidField.bind('r1').address);
    const sections = {
      ...empty().sections,
      renteberegning: {
        beregningsdato: undefined,
        kommentarer: undefined,
        rentekravRows: [makeRow('r1', { enhed: 'uger' })], // gør tillaegstid irrelevant
      },
    };
    expect(() => catalog.validateSettledInput({
      sections,
      rejectedInputs: { [address]: { raw: 'abc', reason: 'format' } },
    })).toThrow(/ikke relevant/);

    // Reducerens egen før/efter-læsning har brug for præcis den mellemtilstand, invarianten afviser —
    // derfor den ene undtagelsesvej. Ingen anden kalder må bruge den.
    const intermediate = catalog.validateSettledInputBeforeRelevanceCleanup({
      sections,
      rejectedInputs: { [address]: { raw: 'abc', reason: 'format' } },
    });
    expect(intermediate.rejectedInputs[address]?.raw).toBe('abc');
    // Og selv i mellemtilstanden er det skjulte felt tavst: issuet hører til det synlige (§1.9).
    const issues = deriveFieldIssueSet(createValidationReader(intermediate, catalog), catalog);
    expect(activeFieldIssue(issues, address)).toBeUndefined();
  });

  it('ugyldigt settle af tom tekst er umuligt — codec resolver tom som canonical tomværdi', () => {
    const cleared = apply(apply(start(), settleField(aargangField.bind(), '2020')), settleField(aargangField.bind(), '   '));
    expect(rejectedAt(cleared.input, aargangField.bind())).toBeUndefined();
    expect(createValidationReader(cleared.input, catalog).readCanonical(aargangField.bind())).toBeUndefined();
  });

  it('ugyldig råtekst → tomt settle rydder rejected uden at genoplive en gammel canonical værdi', () => {
    let state = apply(start(), settleField(aargangField.bind(), '2020'));
    state = apply(state, settleField(aargangField.bind(), 'abc'));
    state = apply(state, settleField(aargangField.bind(), ''));
    expect(rejectedAt(state.input, aargangField.bind())).toBeUndefined();
    expect(createValidationReader(state.input, catalog).readCanonical(aargangField.bind())).toBeUndefined();
  });
});

describe('Inputtransaktioner', () => {
  it('samler flere commands i én atomisk reducerændring og ét history-trin', () => {
    const initial = start();
    const state = apply(initial, inputTransaction([
      inputTransactionStep(settleField(aargangField.bind(), '2020')),
      inputTransactionStep(settleField(beregningsdatoField.bind(), '01-02-2024')),
    ]));

    expect(createValidationReader(state.input, catalog).readCanonical(aargangField.bind())).toBe(2020);
    expect(createValidationReader(state.input, catalog).readCanonical(beregningsdatoField.bind())).toBe('2024-02-01');
    expect(state.history.past).toHaveLength(1);
  });

  it('afviser hele transaktionen, når et senere trin er ugyldigt', () => {
    const initial = start();
    const command = inputTransaction([
      inputTransactionStep(settleField(aargangField.bind(), '2020')),
      inputTransactionStep(settleField(tillaegstidField.bind('mangler'), '1')),
    ]);

    expect(() => reduceInputCommand(initial.input, command, catalog)).toThrow(/ukendt, slettet eller forkert bundet/);
    expect(createValidationReader(initial.input, catalog).readCanonical(aargangField.bind())).toBeUndefined();
  });
});

describe('Ens rød konsekvens, men strukturel save-sondring for format og bounds (§1.6)', () => {
  it('format og bounds giver begge en rød feltfejl, der skjuler værdien for consumers', () => {
    const formatState = apply(start(), settleField(aargangField.bind(), 'abc'));
    const boundsState = apply(start(), settleField(aargangField.bind(), '1800')); // under bounds-min 1900

    for (const [state, reason] of [[formatState, 'format'], [boundsState, 'bounds']] as const) {
      const read = reader(state.input).read(aargangField.bind());
      expect(read.status).toBe('error');
      expect(read.status === 'error' && read.issue.reason).toBe(reason);
    }
  });

  it('format er rejected råtekst (canonical ryddet) og blokerer .eo strukturelt', () => {
    const formatState = apply(start(), settleField(aargangField.bind(), 'abc'));
    expect(rejectedAt(formatState.input, aargangField.bind())?.reason).toBe('format');
    expect(createValidationReader(formatState.input, catalog).readCanonical(aargangField.bind())).toBeUndefined();
    expect(projectEoSave(formatState.input, catalog).status).toBe('blocked');
  });

  it('bounds bevarer den canonical værdi, blokerer IKKE .eo, men skjuler værdien bag et rødt issue (§1.6 anden repr.)', () => {
    // Et schema-repræsenterbart årstal uden for [1900,2100] committes canonical (§1.6).
    const boundsState = apply(start(), settleField(aargangField.bind(), '1800'));
    expect(rejectedAt(boundsState.input, aargangField.bind())).toBeUndefined();
    expect(createValidationReader(boundsState.input, catalog).readCanonical(aargangField.bind())).toBe(1800);
    // Rød feltfejl blokerer afhængige consumers, men save-gaten er strukturel over rejectedInputs → ikke blokeret.
    const boundsSave = projectEoSave(boundsState.input, catalog);
    expect(boundsSave.status).toBe('ready');
    expect(boundsSave.status === 'ready' && boundsSave.snapshot.satser?.aargang).toBe(1800);
    const read = reader(boundsState.input).read(aargangField.bind());
    expect(read.status === 'error' && read.issue.reason).toBe('bounds');

    // Samme mønster for en tværgående/kronologisk bounds-regel på et datofelt.
    const dateState = apply(start(), settleField(beregningsdatoField.bind(), '01-01-1990'));
    expect(createValidationReader(dateState.input, catalog).readCanonical(beregningsdatoField.bind())).toBeDefined();
    expect(rejectedAt(dateState.input, beregningsdatoField.bind())).toBeUndefined();
    expect(projectEoSave(dateState.input, catalog).status).toBe('ready');
    expect(reader(dateState.input).read(beregningsdatoField.bind()).status).toBe('error');
  });
});

describe('Tomhed og missing (§1.7)', () => {
  it('et tomt felt giver ingen rød feltfejl og blokerer ikke .eo', () => {
    const snapshot = deriveFieldIssueSet(createValidationReader(empty(), catalog), catalog);
    expect(snapshot.all).toHaveLength(0);
    expect(reader(empty()).read(aargangField.bind()).status).toBe('usable');
  });

  it('en consumer, der kræver et tomt felt, får en missing-consumerfejl (ingen rød markering)', () => {
    const projection = runProjection(reader(empty()), 'test-consumer', (c) => c.require(aargangField.bind()));
    expect(projection.status).toBe('blocked');
    expect(projection.status === 'blocked' && projection.issues[0]?.kind).toBe('consumer');
    // Missing blokerer kun sin egen consumer, aldrig .eo: der er intet rejected input i aggregaten.
    expect(projectEoSave(empty(), catalog).status).toBe('ready');
  });

  it('en gyldig default er ikke missing, selv om den også er feltets clear-værdi', () => {
    const withRow = apply(start(), insertRow(rentekravRowsRef(), makeRow('r1')));
    const projection = runProjection(reader(withRow.input), 'default-consumer', (c) => c.require(enhedField.bind('r1')));
    expect(projection.status).toBe('ready');
  });
});

describe('Immediate commit og clear (§1.3)', () => {
  it('setImmediateField committer direkte og clearField sætter tomværdien', () => {
    const withRow = apply(start(), insertRow(rentekravRowsRef(), makeRow('r1')));
    const set = apply(withRow, setImmediateField(enhedField.bind('r1'), 'uger'));
    expect(createValidationReader(set.input, catalog).readCanonical(enhedField.bind('r1'))).toBe('uger');
    const cleared = apply(set, clearField(enhedField.bind('r1')));
    expect(createValidationReader(cleared.input, catalog).readCanonical(enhedField.bind('r1'))).toBe('dage');
  });

  it('afviser immediate commit på tekstfelter og værdier uden for codecets kontrakt', () => {
    expect(() => reduceInputCommand(empty(), setImmediateField(aargangField.bind(), 2020), catalog)).toThrow(/choice\/toggle/);
    const withRow = apply(start(), insertRow(rentekravRowsRef(), makeRow('r1')));
    expect(() => reduceInputCommand(
      withRow.input,
      setImmediateField(enhedField.bind('r1'), 'ukendt' as 'dage'),
      catalog
    )).toThrow(/accepteres ikke/);
  });
});

describe('Automatisk rydning af tomme tabelrækker (§9)', () => {
  const autoPruningCatalog = createAutoPruningTestCatalog();
  const autoEmpty = (): SettledInput => autoPruningCatalog.validateSettledInput({
    sections: {
      stamdata: null, satser: null, aarsloen: null, faellesAarsloen: null, renteberegning: null,
      varigemen: null, forsoergertab: null, erstatningsopgoerelse: null, erhvervsevnetab: null,
    },
    rejectedInputs: {},
  });
  const autoDispatch = <TField, TEntity>(
    input: SettledInput,
    command: InputMutationCommand<TField, TEntity>
  ): SettledInput => reduceInputCommand(input, command, autoPruningCatalog).input;

  it('fjerner den sidst ryddede række atomisk og bevarer de øvrige rækkers rækkefølge', () => {
    let input = autoDispatch(autoEmpty(), insertRow(rentekravRowsRef(), makeRow('første')));
    input = autoDispatch(input, insertRow(rentekravRowsRef(), makeRow('anden')));
    input = autoDispatch(input, settleField(belobField.bind('første'), '100'));
    input = autoDispatch(input, settleField(belobField.bind('anden'), '200'));

    const cleared = autoDispatch(input, clearField(belobField.bind('første')));

    expect(autoPruningCatalog.listEntityIds(cleared.sections, rentekravRowsRef())).toEqual(['anden']);
    expect(createValidationReader(cleared, autoPruningCatalog).readCanonical(belobField.bind('anden')))
      .toMatchObject({ value: 200 });
  });

  it('bevarer en række med rejected råtekst, men rydder den når brugeren eksplicit tømmer fejlfeltet', () => {
    let input = autoDispatch(autoEmpty(), insertRow(rentekravRowsRef(), makeRow('fejl')));
    input = autoDispatch(input, settleField(belobField.bind('fejl'), 'ikke-et-beløb'));

    expect(rejectedAt(input, belobField.bind('fejl'))?.raw).toBe('ikke-et-beløb');
    expect(autoPruningCatalog.listEntityIds(input.sections, rentekravRowsRef())).toEqual(['fejl']);

    const cleared = autoDispatch(input, clearField(belobField.bind('fejl')));
    expect(autoPruningCatalog.listEntityIds(cleared.sections, rentekravRowsRef())).toEqual([]);
  });

  it('udsætter rydningen til transaktionens færdige rækkestatus', () => {
    let input = autoDispatch(autoEmpty(), insertRow(rentekravRowsRef(), makeRow('begge')));
    input = autoDispatch(input, settleField(belobField.bind('begge'), '100'));
    input = autoDispatch(input, settleField(tillaegstidField.bind('begge'), '3'));

    const cleared = autoDispatch(input, inputTransaction([
      inputTransactionStep(clearField(belobField.bind('begge'))),
      inputTransactionStep(clearField(tillaegstidField.bind('begge'))),
    ]));

    expect(autoPruningCatalog.listEntityIds(cleared.sections, rentekravRowsRef())).toEqual([]);
  });

  it('bevarer et immediate valgt enhed alene, indtil brugeren eksplicit rydder den', () => {
    let input = autoDispatch(autoEmpty(), insertRow(rentekravRowsRef(), makeRow('enhed')));
    input = autoDispatch(input, setImmediateField(enhedField.bind('enhed'), 'uger'));

    expect(autoPruningCatalog.listEntityIds(input.sections, rentekravRowsRef())).toEqual(['enhed']);

    const cleared = autoDispatch(input, clearField(enhedField.bind('enhed')));
    expect(autoPruningCatalog.listEntityIds(cleared.sections, rentekravRowsRef())).toEqual([]);
  });
});

describe('Styrende valg: gyldigt bevares, skjult+rødt ryddes (§1.9, §3.6, §7.5)', () => {
  // §7.5's todelte regel. Hovedreglen: et valg er ikke en sletteknap — en GYLDIG værdi består, også når
  // valget skjuler feltet. Undtagelsen: bar feltet en aktiv RØD fejl, og skjuler valget det, ryddes feltet
  // tavst, fordi en rød fejl brugeren ikke kan SE, ikke kan rettes — og ellers kunne blokere `.eo`-save
  // eller en beregning fra et usynligt felt.
  //
  // '999' > max 100 er efter kravændringen 2026-07-18 IKKE rejected: værdien committes canonical (999) og
  // bærer en rød bounds-feltfejl (§1.6). Undtagelsen dækker BEGGE fejlformer — canonical bounds/rule OG
  // rejected råtekst.
  const seedRowWithBoundsTillaegstid = (): State => {
    let state = apply(start(), insertRow(rentekravRowsRef(), makeRow('r1')));
    state = apply(state, settleField(belobField.bind('r1'), '500')); // gyldig, skal bevares
    state = apply(state, settleField(tillaegstidField.bind('r1'), '999')); // canonical 999 + bounds-fejl (max 100)
    return state;
  };

  const boundsIssueAt = (state: State, rowId: string): boolean => {
    const read = reader(state.input).read(tillaegstidField.bind(rowId));
    return read.status === 'error' && read.issue.reason === 'bounds';
  };

  it('rydder et felt, der bliver skjult OG havde en aktiv rød bounds-fejl; bevarer det gyldige nabofelt', () => {
    const seeded = seedRowWithBoundsTillaegstid();
    // Værdien er canonical, men bag en rød bounds-feltfejl (ikke rejected råtekst).
    expect(rejectedAt(seeded.input, tillaegstidField.bind('r1'))).toBeUndefined();
    expect(createValidationReader(seeded.input, catalog).readCanonical(tillaegstidField.bind('r1'))).toBe(999);
    expect(boundsIssueAt(seeded, 'r1')).toBe(true);

    // Enhed=uger gør tillægstid irrelevant efter testkatalogets inputdrevne relevansregel.
    const chosen = apply(seeded, setImmediateField(enhedField.bind('r1'), 'uger'));

    const validation = createValidationReader(chosen.input, catalog);
    // Den røde værdi er ryddet: brugeren kunne ikke have set eller rettet fejlen bag et skjult felt.
    expect(validation.readCanonical(tillaegstidField.bind('r1'))).toBeUndefined();
    expect(rejectedAt(chosen.input, tillaegstidField.bind('r1'))).toBeUndefined();
    // Nabofeltet er GYLDIGT og bevares — rydningen rammer kun det røde felt.
    expect(validation.readCanonical(belobField.bind('r1'))).toBeDefined();
    expect(validation.readCanonical(enhedField.bind('r1'))).toBe('uger');
  });

  it('bevarer en GYLDIG værdi, der bliver irrelevant (§1.9)', () => {
    // Hovedreglen: uden en rød fejl er der intet usynligt at rette, så værdien må ikke slettes. Den kommer
    // uændret til syne igen, når valget skiftes tilbage.
    let state = apply(start(), insertRow(rentekravRowsRef(), makeRow('r1')));
    state = apply(state, settleField(tillaegstidField.bind('r1'), '50')); // gyldig
    const chosen = apply(state, setImmediateField(enhedField.bind('r1'), 'uger'));
    expect(createValidationReader(chosen.input, catalog).readCanonical(tillaegstidField.bind('r1'))).toBe(50);

    const reverted = apply(chosen, setImmediateField(enhedField.bind('r1'), 'dage'));
    expect(createValidationReader(reverted.input, catalog).readCanonical(tillaegstidField.bind('r1'))).toBe(50);
  });

  it('rydder rejected råtekst, når valget skjuler feltet (ellers usynlig save-blokering §8)', () => {
    let state = apply(start(), insertRow(rentekravRowsRef(), makeRow('r1')));
    state = apply(state, settleField(tillaegstidField.bind('r1'), 'abc')); // format-rejected råtekst
    expect(rejectedAt(state.input, tillaegstidField.bind('r1'))?.raw).toBe('abc');
    // Råtekst blokerer `.eo`-save globalt — FØR valget er den synlig og kan rettes.
    expect(projectEoSave(state.input, catalog).status).toBe('blocked');

    const chosen = apply(state, setImmediateField(enhedField.bind('r1'), 'uger'));

    // Råteksten er ryddet med valget: ellers ville saven være spærret af en fejl i et skjult felt.
    expect(rejectedAt(chosen.input, tillaegstidField.bind('r1'))).toBeUndefined();
    expect(reader(chosen.input).read(tillaegstidField.bind('r1')).status).not.toBe('error');
    expect(projectEoSave(chosen.input, catalog).status).not.toBe('blocked');
  });

  it('undo gendanner den tavst ryddede værdi som ÉT trin — rydningen er fuldt reversibel', () => {
    // Afgørende for at rydningen er acceptabel: den er tavs, men ikke uigenkaldelig. Valget og rydningen er
    // ét history-trin, så én Ctrl+Z bringer BÅDE enheden og den røde værdi tilbage.
    const seeded = seedRowWithBoundsTillaegstid();
    const hidden = apply(seeded, setImmediateField(enhedField.bind('r1'), 'uger'));
    const undone = undoInputHistory(hidden.history, hidden.input);
    if (!undone.changed) throw new Error('Testinvariant: undo-target mangler');
    // Undo gendanner den canonical bounds-værdi (999), ikke rejected råtekst.
    expect(createValidationReader(undone.target.input, catalog).readCanonical(tillaegstidField.bind('r1'))).toBe(999);
    expect(createValidationReader(undone.target.input, catalog).readCanonical(enhedField.bind('r1'))).toBe('dage');
    const redone = redoInputHistory(undone.history, undone.target.input);
    if (!redone.changed) throw new Error('Testinvariant: redo-target mangler');
    expect(createValidationReader(redone.target.input, catalog).readCanonical(tillaegstidField.bind('r1'))).toBeUndefined();
    expect(createValidationReader(redone.target.input, catalog).readCanonical(enhedField.bind('r1'))).toBe('uger');
  });
});

describe('Dynamiske tabeller (§1.11, §3.8, §7.4)', () => {
  it('settleFieldInNewRow opretter række og fejlende felt atomisk; overlever som ét snapshot', () => {
    // 'abc' er format-rejected råtekst (kan ikke parses); det er dén repræsentation, rejectedInputs bærer (§1.6).
    const created = apply(start(), settleFieldInNewRow(rentekravRowsRef(), makeRow('r1'), tillaegstidField.bind('r1'), 'abc'));
    expect(reader(created.input).listEntities(rentekravRowsRef()).map((e) => e.entityId)).toEqual(['r1']);
    expect(rejectedAt(created.input, tillaegstidField.bind('r1'))?.reason).toBe('format');
  });

  it('deleteRow fjerner rækken og dens rejected descendants i samme trin', () => {
    let state = apply(start(), insertRow(rentekravRowsRef(), makeRow('r1')));
    state = apply(state, settleField(tillaegstidField.bind('r1'), 'abc'));
    expect(rejectedAt(state.input, tillaegstidField.bind('r1'))).toBeDefined();

    const deleted = apply(state, deleteRow(rentekravRowsRef(), 'r1'));
    expect(reader(deleted.input).listEntities(rentekravRowsRef())).toHaveLength(0);
    expect(Object.keys(deleted.input.rejectedInputs)).toHaveLength(0);
  });

  it('reorder ændrer kun rækkefølgen og bevarer feltidentitet/rejected input', () => {
    let state = apply(start(), insertRow(rentekravRowsRef(), makeRow('r1')));
    state = apply(state, insertRow(rentekravRowsRef(), makeRow('r2')));
    state = apply(state, settleField(tillaegstidField.bind('r1'), 'abc'));
    state = apply(state, reorderRows(rentekravRowsRef(), ['r2', 'r1']));
    expect(state.input.sections.renteberegning?.rentekravRows.map((row) => row.id)).toEqual(['r2', 'r1']);
    expect(rejectedAt(state.input, tillaegstidField.bind('r1'))?.raw).toBe('abc');
  });
});

describe('Transaktionsinvarianter (§7.4)', () => {
  it('semantisk no-op giver ingen ny revision/history', () => {
    const once = apply(start(), settleField(aargangField.bind(), '2020'));
    const twice = apply(once, settleField(aargangField.bind(), '2020'));
    expect(twice.input).toBe(once.input);
    expect(twice.history).toBe(once.history);
  });

  it('en command mod en slettet/ukendt feltreference afvises før mutation', () => {
    const missingRowRef = tillaegstidField.bind('does-not-exist');
    expect(() => reduceInputCommand(empty(), settleField(missingRowRef, '5'), catalog)).toThrow();
  });

  it('resetSection rydder kun sektionens rejected input; replace og clear validerer hele casen', () => {
    let state = apply(start(), settleField(aargangField.bind(), 'abc'));
    state = apply(state, insertRow(rentekravRowsRef(), makeRow('r1')));
    state = apply(state, settleField(tillaegstidField.bind('r1'), 'abc'));

    state = apply(state, resetSection('satser', { aargang: 2020 }));
    expect(rejectedAt(state.input, aargangField.bind())).toBeUndefined();
    expect(rejectedAt(state.input, tillaegstidField.bind('r1'))).toBeDefined();

    state = apply(state, replaceCase({ sections: empty().sections, rejectedInputs: {} }));
    expect(state.input).toEqual(empty());
    const noOpClear = apply(state, clearCase());
    expect(noOpClear).toBe(state);
  });
});

describe('Reader skjuler aldrig andre rækkers/felters værdier unødigt (§1.10, §7.3)', () => {
  const twoRows = (): State => {
    let state = apply(start(), insertRow(rentekravRowsRef(), makeRow('r1')));
    state = apply(state, insertRow(rentekravRowsRef(), makeRow('r2')));
    state = apply(state, settleField(belobField.bind('r1'), 'abc')); // r1 fejler
    state = apply(state, settleField(belobField.bind('r2'), '500')); // r2 gyldig
    return state;
  };

  it('en fejl i række 1 blokerer ikke projektionen af række 2', () => {
    const state = twoRows();
    const r = reader(state.input);
    const p1 = runProjection(r, 'row-1', (c) => c.require(belobField.bind('r1')));
    const p2 = runProjection(r, 'row-2', (c) => c.require(belobField.bind('r2')));
    expect(p1.status).toBe('blocked');
    expect(p2.status).toBe('ready');
  });

  it('en aggregatprojektion, der inkluderer den fejlende række, blokeres', () => {
    const state = twoRows();
    const r = reader(state.input);
    const aggregate = runProjection(r, 'aggregate', (c) =>
      r.listEntities(rentekravRowsRef()).map((entity) => c.require(belobField.bind(entity.entityId))));
    expect(aggregate.status).toBe('blocked');
  });

  it('blokerer også når kroppen ignorerer unavailable-resultatet og samler alle blockers', () => {
    const blocked = runProjection(reader(empty()), 'aggregate', (c) => {
      c.require(aargangField.bind());
      c.require(beregningsdatoField.bind());
      return 'må ikke blive ready';
    });
    expect(blocked.status).toBe('blocked');
    expect(blocked.status === 'blocked' ? blocked.issues : []).toHaveLength(2);
  });
});

describe('Obligatorisk statekæde: gyldig A → ugyldig X → undo → redo (§7.2)', () => {
  it('undo gendanner A; redo gendanner fejltilstanden uden A', () => {
    let state = apply(start(), settleField(aargangField.bind(), '2020'));
    state = apply(state, settleField(aargangField.bind(), 'abc'));

    // Nuværende: rejected 'abc', canonical tom.
    expect(rejectedAt(state.input, aargangField.bind())?.raw).toBe('abc');

    const undone = undoInputHistory(state.history, state.input);
    expect(undone.changed).toBe(true);
    if (!undone.changed) throw new Error('Testinvariant: undo-target mangler');
    expect(createValidationReader(undone.target.input, catalog).readCanonical(aargangField.bind())).toBe(2020);
    expect(rejectedAt(undone.target.input, aargangField.bind())).toBeUndefined();

    const redone = redoInputHistory(undone.history, undone.target.input);
    expect(redone.changed).toBe(true);
    if (!redone.changed) throw new Error('Testinvariant: redo-target mangler');
    expect(createValidationReader(redone.target.input, catalog).readCanonical(aargangField.bind())).toBeUndefined();
    expect(rejectedAt(redone.target.input, aargangField.bind())?.raw).toBe('abc');
  });

  it('ugyldig X → ugyldig Y og ugyldig → gyldig erstatter tilstanden atomisk', () => {
    let state = apply(start(), settleField(aargangField.bind(), 'abc'));
    state = apply(state, settleField(aargangField.bind(), 'def'));
    expect(rejectedAt(state.input, aargangField.bind())?.raw).toBe('def');
    state = apply(state, settleField(aargangField.bind(), '2020'));
    expect(rejectedAt(state.input, aargangField.bind())).toBeUndefined();
    expect(createValidationReader(state.input, catalog).readCanonical(aargangField.bind())).toBe(2020);
  });

  it('række-fejl → slet → undo → redo bevarer hele snapshotkæden', () => {
    let state = apply(start(), insertRow(rentekravRowsRef(), makeRow('r1')));
    state = apply(state, settleField(tillaegstidField.bind('r1'), 'abc'));
    state = apply(state, deleteRow(rentekravRowsRef(), 'r1'));
    const undone = undoInputHistory(state.history, state.input);
    if (!undone.changed) throw new Error('Testinvariant: undo-target mangler');
    expect(rejectedAt(undone.target.input, tillaegstidField.bind('r1'))).toBeDefined();
    const redone = redoInputHistory(undone.history, undone.target.input);
    if (!redone.changed) throw new Error('Testinvariant: redo-target mangler');
    expect(redone.target.input.sections.renteberegning?.rentekravRows).toHaveLength(0);
    expect(redone.target.input.rejectedInputs).toEqual({});
  });
});

describe('Kildesnapshot og history-grænser (§3.4, §3.7)', () => {
  // Denne test dækker kun input-halvdelen: kernen
  // læser ikke længere settings, så der er intet settingssnapshot at fryse her. Bindingen mellem
  // input, issues og token er derimod fortsat en levende invariant og pinnes videre.
  // (Frysningen af det brede settingsobjekt var mekanismens egen test, ikke en produktinvariant.)
  it('binder input og issues til samme token', () => {
    const evaluation = createInputEvaluation({ input: empty(), catalog, sourceToken: token });
    expect(evaluation.issues.sourceToken).toBe(token);
    expect(evaluation.reader.sourceToken).toBe(token);
  });

  it('genprøver ved input- eller settingsdrift og stopper fail-closed ved vedvarende drift', () => {
    let revision = 0;
    let tokenReads = 0;
    const captured = captureStableSource(
      () => {
        tokenReads += 1;
        if (tokenReads === 2) revision = 1;
        return createEvaluationSourceToken(createInputRevision(revision), createSettingsRevision(revision));
      },
      () => ({ revision })
    );
    expect(captured.token.inputRevision).toBe(1);
    expect(() => captureStableSource(
      () => createEvaluationSourceToken(createInputRevision(revision += 1), createSettingsRevision(revision)),
      () => null
    )).toThrow(/stabilt kildesnapshot/);
  });

  it('history beholder højst 50 før-snapshots', () => {
    let history = createInputHistory();
    let current = empty();
    for (let value = 1900; value < 1900 + MAX_INPUT_HISTORY_STEPS + 5; value += 1) {
      const result = reduceInputCommand(current, settleField(aargangField.bind(), String(value)), catalog);
      if (!result.changed) throw new Error('Testinvariant: forventede reel ændring');
      history = pushInputHistory(history, current);
      current = result.input;
    }
    expect(history.past).toHaveLength(MAX_INPUT_HISTORY_STEPS);
    expect(createValidationReader(history.past[0]!.input, catalog).readCanonical(aargangField.bind())).toBe(1904);
  });
});

describe('Katalog valideres én gang ved konstruktion (§3.2)', () => {
  it('isolerer kataloget fra efterfølgende mutation af callerens arrays', () => {
    const fields = [...catalogFields(aargangField)];
    const isolatedCatalog = createInputCatalog({ fields, collections: [] });
    fields.length = 0;
    expect(isolatedCatalog.isKnownField(aargangField.bind())).toBe(true);
    expect(isolatedCatalog.listFieldInstances(empty().sections)).toHaveLength(1);
  });

  it('afviser dubleret felt-id', () => {
    const dup = defineField({
      id: 'satser.aargang',
      template: { section: 'satser', path: [], field: 'aargangDuplikat' },
      codec: createIntegerFieldCodec({ allowNegative: false }),
      emptyValue: undefined,
      isEmpty: (value) => value === undefined,
      label: 'Dup',
      controlKind: 'text',
      readCanonical: () => undefined,
      writeCanonical: (sections) => sections,
    });
    expect(() => createInputCatalog({ fields: catalogFields(aargangField, dup), collections: [] })).toThrow(/dubleret felt-id/);
  });

  it('afviser et entity-felt uden registreret parentsamling', () => {
    expect(() => createInputCatalog({ fields: catalogFields(belobField), collections: [] })).toThrow(/parentsamling/);
  });
});

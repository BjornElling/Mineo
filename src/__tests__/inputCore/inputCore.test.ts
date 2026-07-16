import {
  reduceInputCommand,
  settleField,
  setImmediateField,
  clearField,
  applyControllingChoice,
  insertRow,
  deleteRow,
  settleFieldInNewRow,
  createValidationReader,
  deriveFieldIssueSnapshot,
  createInputReader,
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
  runProjection,
  createInputHistory,
  pushInputHistory,
  undoInputHistory,
  redoInputHistory,
  blocksEoSave,
  serializeFieldAddress,
  createInputCatalog,
  defineField,
  createIntegerFieldCodec,
  type SettledInput,
  type InputMutationCommand,
  type InputHistory,
  type FieldRef,
} from '../../inputCore';
import {
  createTestCatalog,
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
  return { input, history: createInputHistory(input) };
};
const apply = <TField, TEntity>(state: State, command: InputMutationCommand<TField, TEntity>): State => {
  const result = reduceInputCommand(state.input, command, catalog);
  if (!result.changed) return state;
  return { input: result.input, history: pushInputHistory(state.history, result.input) };
};

const reader = (input: SettledInput) => {
  const validation = createValidationReader(input, catalog);
  const issues = deriveFieldIssueSnapshot(validation, catalog);
  return createInputReader({ input, catalog, issues, sourceToken: token });
};

const rejectedAt = <T>(input: SettledInput, field: FieldRef<T>) =>
  input.rejectedInputs[serializeFieldAddress(field.address)];

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

  it('ugyldigt settle af tom tekst er umuligt — codec resolver tom som canonical tomværdi', () => {
    const cleared = apply(apply(start(), settleField(aargangField.bind(), '2020')), settleField(aargangField.bind(), '   '));
    expect(rejectedAt(cleared.input, aargangField.bind())).toBeUndefined();
    expect(createValidationReader(cleared.input, catalog).readCanonical(aargangField.bind())).toBeUndefined();
  });
});

describe('Ens konsekvens for format og range (§1.6)', () => {
  it('format og range giver begge en rød feltfejl, der skjuler værdien og blokerer .eo', () => {
    const formatState = apply(start(), settleField(aargangField.bind(), 'abc'));
    const rangeState = apply(start(), settleField(aargangField.bind(), '1800')); // under min 1900

    for (const [state, reason] of [[formatState, 'format'], [rangeState, 'range']] as const) {
      expect(rejectedAt(state.input, aargangField.bind())?.reason).toBe(reason);
      const read = reader(state.input).read(aargangField.bind());
      expect(read.status).toBe('error');
      const snapshot = deriveFieldIssueSnapshot(createValidationReader(state.input, catalog), catalog);
      expect(snapshot.all.every(blocksEoSave)).toBe(true);
    }
  });

  it('bounds på en canonical værdi bevarer værdien men skjuler den bag et afledt issue (§1.6 anden repr.)', () => {
    const state = apply(start(), settleField(beregningsdatoField.bind(), '01-01-1990'));
    // Canonical værdi ER bevaret (i modsætning til format/range).
    expect(createValidationReader(state.input, catalog).readCanonical(beregningsdatoField.bind())).toBeDefined();
    expect(rejectedAt(state.input, beregningsdatoField.bind())).toBeUndefined();
    // Men den offentlige reader skjuler den bag et bounds-issue.
    const read = reader(state.input).read(beregningsdatoField.bind());
    expect(read.status).toBe('error');
    expect(read.status === 'error' && read.issue.reason).toBe('bounds');
  });
});

describe('Tomhed og missing (§1.7)', () => {
  it('et tomt felt giver ingen rød feltfejl og blokerer ikke .eo', () => {
    const snapshot = deriveFieldIssueSnapshot(createValidationReader(empty(), catalog), catalog);
    expect(snapshot.all).toHaveLength(0);
    expect(reader(empty()).read(aargangField.bind()).status).toBe('usable');
  });

  it('en consumer, der kræver et tomt felt, får en missing-consumerfejl (ingen rød markering)', () => {
    const projection = runProjection(reader(empty()), 'test-consumer', (c) => c.require(aargangField.bind()));
    expect(projection.status).toBe('blocked');
    expect(projection.status === 'blocked' && projection.issues[0]?.kind).toBe('consumer');
    expect(projection.status === 'blocked' && projection.issues.some(blocksEoSave)).toBe(false);
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
});

describe('Styrende valg rydder nu-irrelevante feltfejl, bevarer gyldigt (§1.9, §3.6)', () => {
  const seedRowWithRejectedTillaegstid = (): State => {
    let state = apply(start(), insertRow(rentekravRowsRef(), makeRow('r1')));
    state = apply(state, settleField(belobField.bind('r1'), '500')); // gyldig, skal bevares
    state = apply(state, settleField(tillaegstidField.bind('r1'), '999')); // range-fejl (max 100)
    return state;
  };

  it('rydder et felt, der bliver irrelevant OG havde en aktiv rød fejl; bevarer det gyldige nabofelt', () => {
    const seeded = seedRowWithRejectedTillaegstid();
    expect(rejectedAt(seeded.input, tillaegstidField.bind('r1'))).toBeDefined();

    // aargang=2000 gør tillaegstid irrelevant (relevance: aargang !== 2000).
    const chosen = apply(seeded, applyControllingChoice(aargangField.bind(), 2000));

    expect(rejectedAt(chosen.input, tillaegstidField.bind('r1'))).toBeUndefined(); // ryddet
    const validation = createValidationReader(chosen.input, catalog);
    expect(validation.readCanonical(belobField.bind('r1'))).toBeDefined(); // bevaret
    expect(validation.readCanonical(aargangField.bind())).toBe(2000);
  });

  it('bevarer en GYLDIG værdi, der bliver irrelevant (§1.9)', () => {
    let state = apply(start(), insertRow(rentekravRowsRef(), makeRow('r1')));
    state = apply(state, settleField(tillaegstidField.bind('r1'), '50')); // gyldig
    const chosen = apply(state, applyControllingChoice(aargangField.bind(), 2000));
    expect(createValidationReader(chosen.input, catalog).readCanonical(tillaegstidField.bind('r1'))).toBe(50);
  });
});

describe('Dynamiske tabeller (§1.11, §3.8, §7.4)', () => {
  it('settleFieldInNewRow opretter række og fejlende felt atomisk; overlever som ét snapshot', () => {
    const created = apply(start(), settleFieldInNewRow(rentekravRowsRef(), makeRow('r1'), tillaegstidField.bind('r1'), '999'));
    expect(reader(created.input).listEntities(rentekravRowsRef()).map((e) => e.entityId)).toEqual(['r1']);
    expect(rejectedAt(created.input, tillaegstidField.bind('r1'))?.reason).toBe('range');
  });

  it('deleteRow fjerner rækken og dens rejected descendants i samme trin', () => {
    let state = apply(start(), insertRow(rentekravRowsRef(), makeRow('r1')));
    state = apply(state, settleField(tillaegstidField.bind('r1'), '999'));
    expect(rejectedAt(state.input, tillaegstidField.bind('r1'))).toBeDefined();

    const deleted = apply(state, deleteRow(rentekravRowsRef(), 'r1'));
    expect(reader(deleted.input).listEntities(rentekravRowsRef())).toHaveLength(0);
    expect(Object.keys(deleted.input.rejectedInputs)).toHaveLength(0);
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
});

describe('Obligatorisk statekæde: gyldig A → ugyldig X → undo → redo (§7.2)', () => {
  it('undo gendanner A; redo gendanner fejltilstanden uden A', () => {
    let state = apply(start(), settleField(aargangField.bind(), '2020'));
    state = apply(state, settleField(aargangField.bind(), 'abc'));

    // Nuværende: rejected 'abc', canonical tom.
    expect(rejectedAt(state.input, aargangField.bind())?.raw).toBe('abc');

    const undone = undoInputHistory(state.history);
    expect(createValidationReader(undone.present, catalog).readCanonical(aargangField.bind())).toBe(2020);
    expect(rejectedAt(undone.present, aargangField.bind())).toBeUndefined();

    const redone = redoInputHistory(undone);
    expect(createValidationReader(redone.present, catalog).readCanonical(aargangField.bind())).toBeUndefined();
    expect(rejectedAt(redone.present, aargangField.bind())?.raw).toBe('abc');
  });
});

describe('Katalog valideres én gang ved konstruktion (§3.2)', () => {
  it('afviser dubleret felt-id', () => {
    const dup = defineField({
      id: 'satser.aargang',
      template: { section: 'satser', path: [], field: 'aargangDuplikat' },
      codec: createIntegerFieldCodec({ allowNegative: false }),
      emptyValue: undefined,
      label: 'Dup',
      controlKind: 'text',
      readCanonical: () => undefined,
      writeCanonical: (sections) => sections,
    });
    expect(() => createInputCatalog({ fields: [aargangField, dup], collections: [] })).toThrow(/dubleret felt-id/);
  });

  it('afviser et entity-felt uden registreret parentsamling', () => {
    expect(() => createInputCatalog({ fields: [belobField], collections: [] })).toThrow(/parentsamling/);
  });
});

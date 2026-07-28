import { deepEqual } from '../utils/deepEqual';
import {
  createEntityPath,
  deserializeFieldAddress,
  isFieldAddressBelowEntity,
  serializeFieldAddress,
  type CollectionRef,
  type SectionKey,
} from './fieldAddress';
import type { FieldRef } from './fieldDescriptor';
import type { InputCatalog } from './fieldCatalog';
import {
  createEmptyPersistedInputSections,
  type PersistedInputSections,
  type RejectedInput,
  type RejectedInputs,
  type SettledInput,
  type SettledInputCandidate,
} from './settledInput';
import { createValidationReader, deriveFieldIssueSet } from './inputReader';
import { activeFieldIssue } from './inputIssue';

// Greenfield-kerne (§3.6): alle autoritative ændringer bygges af ÉN ren, exhaustiv reducer. Storage, revision
// og history ejes af runtime-runneren (Fase 2). Reduceren håndhæver XOR-invarianten (§1.5): et ugyldigt settle
// rydder feltets canonical slot til tomværdien OG skriver den rå fejlende tekst atomisk.

export type SettleFieldCommand<T> = Readonly<{ kind: 'settleField'; field: FieldRef<T>; raw: string }>;
export type SetImmediateFieldCommand<T> = Readonly<{ kind: 'setImmediateField'; field: FieldRef<T>; value: T }>;
export type ClearFieldCommand<T> = Readonly<{ kind: 'clearField'; field: FieldRef<T> }>;

export type InsertRowCommand<TEntity> = Readonly<{
  kind: 'insertRow';
  collection: CollectionRef;
  entity: TEntity;
  index?: number;
}>;
export type DeleteRowCommand = Readonly<{ kind: 'deleteRow'; collection: CollectionRef; entityId: string }>;
export type ReorderRowsCommand = Readonly<{
  kind: 'reorderRows';
  collection: CollectionRef;
  orderedEntityIds: readonly string[];
}>;
export type SettleFieldInNewRowCommand<TEntity, TField> = Readonly<{
  kind: 'settleFieldInNewRow';
  collection: CollectionRef;
  entity: TEntity;
  index?: number;
  field: FieldRef<TField>;
  raw: string;
}>;

export type InputTransactionStep = Readonly<{
  reduce: (input: SettledInput, catalog: InputCatalog) => SettledInput;
  /**
   * Er trinnet en STRUKTUREL rækkeændring (§3.7, WI-004 runde 4, fund S4)?
   *
   * Trinnet pakker sin command ind i en closure, så dispatch-porten ellers ikke kan se, at transaktionen
   * indeholder fx en `deleteRow`. Uden klassifikationen kunne en strukturel transaktion sendes helt uden
   * origin, og undo/redo kunne dermed gendanne en række, brugeren ikke kan navigere til.
   */
  structural: boolean;
}>;
/**
 * En transaktion, hvis trin ALLE er feltændringer. Type-synligt adskilt fra den strukturelle variant, så
 * dispatch-porten kan kræve en destination for den ene og ikke for den anden — uden at skulle se ind i
 * trinnenes closures.
 */
export type FieldTransactionCommand = Readonly<{
  kind: 'transaction';
  structural: false;
  steps: readonly InputTransactionStep[];
}>;

/** En transaktion med mindst ét strukturelt rækketrin. Kræver `CollectionHistoryOrigin` ved dispatch. */
export type StructuralTransactionCommand = Readonly<{
  kind: 'structuralTransaction';
  structural: true;
  steps: readonly InputTransactionStep[];
}>;

export type InputTransactionCommand = FieldTransactionCommand | StructuralTransactionCommand;

/**
 * De commandarter, der ændrer en collections RÆKKESTRUKTUR og derfor kræver en navigerbar destination.
 *
 * Sættet er udledt af de faktiske commandtyper, så en ny strukturel commandart ikke kan tilføjes uden at
 * blive optaget her: `satisfies` kræver, at hver eneste struktur-command-`kind` er repræsenteret, og
 * `StructuralCommandKind` i `dispatchInput.ts` afledes af denne konstant.
 */
const STRUCTURAL_KIND_SET = {
  insertRow: true,
  deleteRow: true,
  reorderRows: true,
  settleFieldInNewRow: true,
  structuralTransaction: true,
} as const satisfies Record<
  InsertRowCommand<unknown>['kind']
  | DeleteRowCommand['kind']
  | ReorderRowsCommand['kind']
  | SettleFieldInNewRowCommand<unknown, unknown>['kind']
  | StructuralTransactionCommand['kind'],
  true
>;

/** Diskriminatoren for en strukturel rækkecommand. Den ENE sandhed; dispatch-porten typer sig efter den. */
export type StructuralCommandKind = keyof typeof STRUCTURAL_KIND_SET;

export const STRUCTURAL_COMMAND_KINDS: readonly string[] = Object.freeze(Object.keys(STRUCTURAL_KIND_SET));

/**
 * Er denne command en strukturel rækkeændring? Læser KUN diskriminatoren, så en løs parametertype undgår
 * den contravariante generiske variansfælde (samme mønster som `isAuthoritativeReplacement`).
 */
export const isStructuralInputCommand = (command: Readonly<{ kind: string }>): boolean =>
  STRUCTURAL_COMMAND_KINDS.includes(command.kind);

export type ResetSectionCommand = {
  [K in SectionKey]: Readonly<{ kind: 'resetSection'; section: K; value: PersistedInputSections[K] }>;
}[SectionKey];
export type ReplaceCaseCommand = Readonly<{ kind: 'replaceCase'; input: SettledInputCandidate }>;
export type ClearCaseCommand = Readonly<{ kind: 'clearCase' }>;

export type InputMutationCommand<TField = unknown, TEntity = unknown> =
  | SettleFieldCommand<TField>
  | SetImmediateFieldCommand<TField>
  | ClearFieldCommand<TField>
  | InsertRowCommand<TEntity>
  | DeleteRowCommand
  | ReorderRowsCommand
  | SettleFieldInNewRowCommand<TEntity, TField>
  | InputTransactionCommand
  | ResetSectionCommand
  | ReplaceCaseCommand
  | ClearCaseCommand;

/** Commands, som form-/grid-surfaces må udstede; hel-sagsmutationer er kun systeminfrastruktur. */
export type InputSurfaceCommand<TField = unknown, TEntity = unknown> = Exclude<
  InputMutationCommand<TField, TEntity>,
  ResetSectionCommand | ReplaceCaseCommand | ClearCaseCommand
>;

// ── Command-konstruktører ────────────────────────────────────────────────────────────────────────
export const settleField = <T>(field: FieldRef<T>, raw: string): SettleFieldCommand<T> =>
  Object.freeze({ kind: 'settleField', field, raw });
export const setImmediateField = <T>(field: FieldRef<T>, value: T): SetImmediateFieldCommand<T> =>
  Object.freeze({ kind: 'setImmediateField', field, value });
export const clearField = <T>(field: FieldRef<T>): ClearFieldCommand<T> =>
  Object.freeze({ kind: 'clearField', field });
export const insertRow = <TEntity>(collection: CollectionRef, entity: TEntity, index?: number): InsertRowCommand<TEntity> =>
  Object.freeze({ kind: 'insertRow', collection, entity, ...(index === undefined ? {} : { index }) });
export const deleteRow = (collection: CollectionRef, entityId: string): DeleteRowCommand =>
  Object.freeze({ kind: 'deleteRow', collection, entityId });
export const reorderRows = (collection: CollectionRef, orderedEntityIds: readonly string[]): ReorderRowsCommand =>
  Object.freeze({ kind: 'reorderRows', collection, orderedEntityIds: Object.freeze([...orderedEntityIds]) });
export const settleFieldInNewRow = <TEntity, TField>(
  collection: CollectionRef,
  entity: TEntity,
  field: FieldRef<TField>,
  raw: string,
  index?: number
): SettleFieldInNewRowCommand<TEntity, TField> =>
  Object.freeze({ kind: 'settleFieldInNewRow', collection, entity, field, raw, ...(index === undefined ? {} : { index }) });
export const inputTransactionStep = <TField, TEntity>(
  command: InputSurfaceCommand<TField, TEntity>
): InputTransactionStep => Object.freeze({
  reduce: (input, catalog) => reduceInputCommand(input, command, catalog).input,
  // Klassifikationen udledes HER, hvor commanden endnu er synlig — derefter er den lukket inde i `reduce`.
  structural: isStructuralInputCommand(command),
});
/**
 * Bygger en transaktion af RENE FELTTRIN. Kaster, hvis et trin er strukturelt (§3.7, WI-004 runde 4, S4).
 *
 * Adskillelsen i to konstruktører er bevidst: dispatch-porten skal kunne kræve en navigerbar destination for
 * en transaktion med rækkeændringer, og TYPEN skal kunne se forskellen. Ville `inputTransaction` derimod
 * returnere unionen af de to arter, ville en betinget origin-tuple opløses til unionen af begge arme, og
 * kravet ville forsvinde — præcis det hul fund S4 beskrev i overload-varianten.
 */
export const inputTransaction = (
  steps: readonly InputTransactionStep[]
): FieldTransactionCommand => {
  if (steps.length === 0) throw new Error('InputReducer: en inputtransaktion skal indeholde mindst ét trin');
  if (steps.some((step) => step.structural)) {
    throw new Error(
      'InputReducer: en transaktion med rækkeændringer skal bygges med `structuralInputTransaction`, '
      + 'så dispatch-porten kan kræve en navigerbar destination til undo/redo (§3.7).'
    );
  }
  return Object.freeze({ kind: 'transaction', structural: false, steps: Object.freeze([...steps]) });
};

/**
 * Bygger en transaktion, der indeholder mindst én RÆKKEÆNDRING. Dispatch kræver `CollectionHistoryOrigin`.
 *
 * Kaster, hvis intet trin er strukturelt: så skulle `inputTransaction` have været brugt, og en overflødig
 * origin ville foregøgle en navigation, der ikke svarer til nogen rækkehandling.
 */
export const structuralInputTransaction = (
  steps: readonly InputTransactionStep[]
): StructuralTransactionCommand => {
  if (steps.length === 0) throw new Error('InputReducer: en inputtransaktion skal indeholde mindst ét trin');
  if (!steps.some((step) => step.structural)) {
    throw new Error(
      'InputReducer: `structuralInputTransaction` kræver mindst ét rækketrin; brug `inputTransaction` til '
      + 'en ren felttransaktion.'
    );
  }
  return Object.freeze({ kind: 'structuralTransaction', structural: true, steps: Object.freeze([...steps]) });
};
export const resetSection = <K extends SectionKey>(
  section: K,
  value: PersistedInputSections[K]
): Extract<ResetSectionCommand, { section: K }> =>
  Object.freeze({ kind: 'resetSection', section, value }) as Extract<ResetSectionCommand, { section: K }>;
export const replaceCase = (input: SettledInputCandidate): ReplaceCaseCommand =>
  Object.freeze({ kind: 'replaceCase', input });
export const clearCase = (): ClearCaseCommand => Object.freeze({ kind: 'clearCase' });

// ── Kandidatbygning ────────────────────────────────────────────────────────────────────────────────

type InputParts = Readonly<{ sections: PersistedInputSections; rejectedInputs: RejectedInputs }>;

const assertWritable = <T>(parts: InputParts, field: FieldRef<T>, catalog: InputCatalog): void => {
  if (!catalog.isKnownField(field) || !catalog.containsAddressEntities(parts.sections, field.address)) {
    throw new Error('InputReducer: ukendt, slettet eller forkert bundet feltreference');
  }
};

/** Skriver den canonical værdi og fjerner et eventuelt rejected råinput (§1.5: gyldigt/tomt settle). */
const withCanonicalValue = <T>(parts: InputParts, field: FieldRef<T>, value: T): InputParts => {
  const address = serializeFieldAddress(field.address);
  const { [address]: _removed, ...rejectedInputs } = parts.rejectedInputs;
  return {
    sections: field.descriptor.writeCanonical(structuredClone(parts.sections), field.address, value),
    rejectedInputs,
  };
};

/** Rydder canonical til tomværdien OG skriver rå fejlende tekst atomisk (§1.5: ugyldigt settle). */
const withRejectedInput = <T>(parts: InputParts, field: FieldRef<T>, rejected: RejectedInput): InputParts => {
  const address = serializeFieldAddress(field.address);
  return {
    sections: field.descriptor.writeCanonical(
      structuredClone(parts.sections),
      field.address,
      field.descriptor.emptyValue
    ),
    rejectedInputs: { ...parts.rejectedInputs, [address]: rejected },
  };
};

const reduceSettle = <T>(parts: InputParts, field: FieldRef<T>, raw: string, catalog: InputCatalog): InputParts => {
  assertWritable(parts, field, catalog);
  const resolution = field.descriptor.codec.parseForSettle(raw);
  if (resolution.status === 'valid') return withCanonicalValue(parts, field, resolution.value);
  if (raw.trim() === '') throw new Error('InputReducer: codec afviste tom tekst, som ikke kan være rejected input');
  return withRejectedInput(parts, field, {
    raw,
    reason: resolution.reason,
    ...(resolution.detail === undefined ? {} : { detail: resolution.detail }),
  });
};

const removeRejectedBelowEntity = (
  rejectedInputs: RejectedInputs,
  collection: CollectionRef,
  entityId: string
): RejectedInputs => {
  const entityPath = createEntityPath([
    ...collection.path,
    { kind: 'entity', collection: collection.collection, entityId },
  ]);
  return Object.fromEntries(Object.entries(rejectedInputs).filter(([serialized]) => {
    const address = deserializeFieldAddress(serialized);
    if (address === null) throw new Error('InputReducer: current-state indeholder en ugyldig feltadresse');
    return !isFieldAddressBelowEntity(address, collection.section, entityPath);
  }));
};

/** §3.6 fast før/efter-procedure for et styrende valg: commit + atomisk oprydning af nu-irrelevante feltfejl. */
const reduceImmediateChoice = <T>(
  input: SettledInput,
  field: FieldRef<T>,
  value: T,
  catalog: InputCatalog
): InputParts => {
  // 1. Fasthold før-snapshottets aktive feltissues og inputdrevne relevans.
  const beforeReader = createValidationReader(input, catalog);
  const beforeIssues = deriveFieldIssueSet(beforeReader, catalog);
  const beforeFields = catalog.listFieldInstances(input.sections);
  const beforeRelevant = new Map(beforeFields.map((f) => [serializeFieldAddress(f.address), beforeReader.isRelevant(f)]));

  // 2. Anvend valget på kandidaten.
  assertWritable(input, field, catalog);
  if (field.descriptor.controlKind === 'text') {
    throw new Error('InputReducer: setImmediateField er kun tilladt for choice/toggle');
  }
  const reparsed = field.descriptor.codec.parseForSettle(field.descriptor.codec.formatForEdit(value));
  if (reparsed.status !== 'valid' || !deepEqual(reparsed.value, value)) {
    throw new Error('InputReducer: immediate-værdien accepteres ikke af feltets codec');
  }
  let candidate = withCanonicalValue(input, field, value);

  // 3-4. Beregn efter-relevans; find felter med overgangen relevant → irrelevant.
  const afterReader = createValidationReader(
    catalog.validateSettledInputBeforeRelevanceCleanup(candidate),
    catalog
  );

  for (const beforeField of beforeFields) {
    const key = serializeFieldAddress(beforeField.address);
    const wasRelevant = beforeRelevant.get(key) === true;
    if (!wasRelevant) continue;
    // Feltet kan være slettet i kandidaten (bør ikke ske ved et rent valg), så guard eksistens.
    if (!catalog.containsAddressEntities(candidate.sections, beforeField.address)) continue;
    const nowIrrelevant = !afterReader.isRelevant(beforeField);
    if (!nowIrrelevant) continue;
    // 5. Ryd feltet HVIS OG KUN HVIS det havde en aktiv rød feltfejl i før-snapshottet.
    if (activeFieldIssue(beforeIssues, key) === undefined) continue;
    candidate = withCanonicalValue(candidate, beforeField, beforeField.descriptor.emptyValue);
  }

  // 6. Øvrige værdier bevares; validering sker i reduceInputCommand.
  return candidate;
};

const buildCandidate = <TField, TEntity>(
  input: SettledInput,
  command: InputMutationCommand<TField, TEntity>,
  catalog: InputCatalog
): SettledInputCandidate => {
  switch (command.kind) {
    case 'settleField':
      return reduceSettle(input, command.field, command.raw, catalog);
    case 'setImmediateField':
      return reduceImmediateChoice(input, command.field, command.value, catalog);
    case 'clearField':
      assertWritable(input, command.field, catalog);
      return withCanonicalValue(input, command.field, command.field.descriptor.emptyValue);
    case 'insertRow':
      return {
        sections: catalog.insertEntity(input.sections, command.collection, command.entity, command.index),
        rejectedInputs: input.rejectedInputs,
      };
    case 'deleteRow':
      return {
        sections: catalog.deleteEntity(input.sections, command.collection, command.entityId),
        rejectedInputs: removeRejectedBelowEntity(input.rejectedInputs, command.collection, command.entityId),
      };
    case 'reorderRows':
      return {
        sections: catalog.reorderEntities(input.sections, command.collection, command.orderedEntityIds),
        rejectedInputs: input.rejectedInputs,
      };
    case 'settleFieldInNewRow': {
      const entityId = catalog.getEntityId(command.collection, command.entity);
      const entityPath = createEntityPath([
        ...command.collection.path,
        { kind: 'entity', collection: command.collection.collection, entityId },
      ]);
      if (!isFieldAddressBelowEntity(command.field.address, command.collection.section, entityPath)) {
        throw new Error('InputReducer: feltet tilhører ikke den nye række');
      }
      const inserted: InputParts = {
        sections: catalog.insertEntity(input.sections, command.collection, command.entity, command.index),
        rejectedInputs: input.rejectedInputs,
      };
      return reduceSettle(inserted, command.field, command.raw, catalog);
    }
    case 'transaction':
    case 'structuralTransaction': {
      // Flere felt-/rækkeændringer fra én eksplicit brugerhandling skal være ét observerbart revision-/undo-trin.
      // Hvert mellemtrin valideres, men ingen mellemtilstand forlader den rene reducer.
      // De to arter reduceres IDENTISK; adskillelsen findes kun, så dispatch-porten kan kræve en navigerbar
      // destination for den strukturelle variant (§3.7).
      let candidate = input;
      for (const step of command.steps) {
        candidate = step.reduce(candidate, catalog);
      }
      return candidate;
    }
    case 'resetSection': {
      const rejectedInputs = Object.fromEntries(Object.entries(input.rejectedInputs).filter(([serialized]) => {
        const address = deserializeFieldAddress(serialized);
        if (address === null) throw new Error('InputReducer: current-state indeholder en ugyldig feltadresse');
        return address.section !== command.section;
      }));
      return { sections: { ...input.sections, [command.section]: command.value }, rejectedInputs };
    }
    case 'replaceCase':
      return command.input;
    case 'clearCase':
      return { sections: createEmptyPersistedInputSections(), rejectedInputs: {} };
  }
};

export type InputReducerResult = Readonly<{ changed: boolean; input: SettledInput }>;

/** Ren, exhaustiv, validerende reducer. Afviser semantisk no-op uden en ny revision (§3.6 pkt. 4). */
export const reduceInputCommand = <TField, TEntity>(
  input: SettledInput,
  command: InputMutationCommand<TField, TEntity>,
  catalog: InputCatalog
): InputReducerResult => {
  // Trin 1: byg og validér brugerens egen ændring. Reglerne for afledte felter skal se en VALIDERET
  // envelope — ellers ville de læse utypede rå værdier og kunne udlede en konsekvens af noget, kataloget
  // ville have afvist.
  const committed = catalog.validateSettledInput(buildCandidate(input, command, catalog));

  // Trin 2: materialisér de afledte felter i SAMME kandidat og validér resultatet igen. Årsag og konsekvens
  // hører dermed til samme revision og samme history-trin, og ingen afledt værdi kan blive en selvstændig
  // autoritativ handling, brugeren skal fortryde for sig (§3.6, GM-F02). Den anden validering er ikke
  // dobbeltarbejde: den er grænsen, der forhindrer en afledt regel i at smugle en ugyldig envelope ind.
  const derived = catalog.materializeDerivedWrites(committed.sections);
  const candidate: SettledInput = derived === committed.sections
    ? committed
    : catalog.validateSettledInput({ sections: derived, rejectedInputs: committed.rejectedInputs });

  if (deepEqual(input, candidate)) return Object.freeze({ changed: false, input });
  return Object.freeze({ changed: true, input: candidate });
};

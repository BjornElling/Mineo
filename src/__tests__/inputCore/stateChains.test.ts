/**
 * §7.2's OTTE obligatoriske statekæder som én datadrevet matrix (R8-F03, etape 10).
 *
 * **Hvad fundet var.** Kun to af de otte kæder havde et egentligt undo/redo-forløb. `ugyldig X → ugyldig Y`
 * og `ugyldig → gyldig` var samlet i én test UDEN undo/redo, og kæderne med tom værdi, bounds-fejl, skjult
 * gyldig værdi og skjult fejl fandtes slet ikke som komplette forløb. Dertil hævdede de eksisterende tests
 * primært canonical/rejected — ikke §7.2's krav om, at *hvert trin* hævder alle ni aspekter.
 *
 * **Hvorfor en matrix og ikke otte håndskrevne tests.** Fejlen, kæderne findes for at fange, opstår i
 * SAMSPILLET mellem lagene: en undo kan gendanne canonical korrekt og samtidig efterlade et stale issue,
 * en forældet consumerstatus eller en gate, der stadig blokerer. Otte uafhængige tests ville hver hævde
 * det, deres forfatter huskede at hævde. Matricen tager derimod ét SAMLET snapshot af alle ni aspekter
 * efter hvert trin og sammenligner med den forventede tilstand — så et aspekt, ingen tænkte på, ikke kan
 * falde ud. Tilføjes et tiende aspekt, kommer det med i alle otte kæder på én gang.
 *
 * **De ni aspekter** (§7.2, ordret): current canonical slot, rejected råtekst, visning, feltissue,
 * consumerstatus, `.eo`-gate, dokumentgate, revision og history.
 *
 * `visning` måles som `formatSettledFieldText` — feltets egen visningsudledning, altså det brugeren SER —
 * og ikke som en re-formatering af canonical. De to kan divergere netop ved rejected råtekst, hvor visningen
 * er den rå tekst ordret, og det er den divergens, aspektet findes for at pinne.
 *
 * **Kæderne kører mod runtime-reduceren og den ægte history**, ikke mod en forenklet model: `undo`/`redo`
 * går gennem `undoInputHistory`/`redoInputHistory` og valideres af kataloget, som produktionen gør.
 */
import {
  reduceInputCommand,
  settleField,
  setImmediateField,
  clearField,
  insertRow,
  deleteRow,
  createInputEvaluation,
  createEvaluationSourceToken,
  createInputRevision,
  createSettingsRevision,
  createInputHistory,
  pushInputHistory,
  undoInputHistory,
  redoInputHistory,
  serializeFieldAddress,
  runProjection,
  type SettledInput,
  type InputMutationCommand,
  type InputHistory,
  type FieldRef,
} from '../../inputCore';
import { deriveSettledFieldView, formatSettledFieldText } from '../../inputCore/editor/fieldEditorEngine';
import { createValidationReader } from '../../inputCore/inputReader';
import { projectEoSave } from '../../persistence/eoSaveProjection';
import {
  createTestCatalog,
  aargangField,
  beregningsdatoField,
  tillaegstidField,
  enhedField,
  makeRow,
  rentekravRowsRef,
} from './testCatalog';

const catalog = createTestCatalog();

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Runtime-harness: samme reducer, samme history-model, samme validering som produktionen.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

type State = Readonly<{ input: SettledInput; history: InputHistory; revision: number }>;

const empty = (): SettledInput => catalog.validateSettledInput({
  sections: {
    stamdata: null, satser: null, aarsloen: null, faellesAarsloen: null, renteberegning: null,
    varigemen: null, forsoergertab: null, erstatningsopgoerelse: null, erhvervsevnetab: null,
  },
  rejectedInputs: {},
});

const start = (): State => ({ input: empty(), history: createInputHistory(), revision: 1 });

/** En reel mutation: ny revision + ét history-trin. En no-op ændrer ingen af de tre. */
const apply = <TField, TEntity>(state: State, command: InputMutationCommand<TField, TEntity>): State => {
  const result = reduceInputCommand(state.input, command, catalog);
  if (!result.changed) return state;
  return {
    input: result.input,
    history: pushInputHistory(state.history, state.input),
    revision: state.revision + 1,
  };
};

/** Undo/redo skaber en NY revision (§10-kriterium 21) og flytter et frame mellem past og future. */
const undo = (state: State): State => {
  const transition = undoInputHistory(state.history, state.input);
  if (!transition.changed) return state;
  return {
    input: catalog.validateSettledInput(transition.target.input),
    history: transition.history,
    revision: state.revision + 1,
  };
};

const redo = (state: State): State => {
  const transition = redoInputHistory(state.history, state.input);
  if (!transition.changed) return state;
  return {
    input: catalog.validateSettledInput(transition.target.input),
    history: transition.history,
    revision: state.revision + 1,
  };
};

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Ni-aspekt-snapshottet
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Alle ni §7.2-aspekter for ÉT felt i ÉN tilstand.
 *
 * `revision`/`historyDepth` er relative tal, fordi de er MONOTONI-påstande, ikke absolutte værdier: en
 * kæde skal kunne indsættes med et andet antal opsætningstrin foran uden at hvert forventet tal skal
 * skrives om. Det absolutte krav — at hver reel handling giver præcis én ny revision — hævdes af
 * `commandInvariants.test.ts` pr. command-kind.
 */
type Aspects = Readonly<{
  /** `'slettet-adresse'`, når feltets række ikke findes — se `snapshot` nedenfor. */
  canonical: unknown;
  rejectedRaw: string | undefined;
  display: string;
  fieldIssue: string | undefined;
  consumerStatus: 'ready' | 'blocked';
  eoSaveGate: 'ready' | 'blocked';
  documentGate: 'ready' | 'blocked';
  revision: number;
  history: Readonly<{ past: number; future: number }>;
}>;

/**
 * Værdien for de fire adresse-bundne aspekter, når feltets ejer-række ER SLETTET.
 *
 * Det er ikke en bekvemmelighed men en INVARIANT: readeren KASTER bevidst på en ref til en slettet
 * række (`ValidationReader: ukendt, slettet eller forkert bundet feltreference`), fordi en tavs
 * `undefined` ville gøre en ref til en forsvundet adresse til et lovligt read og dermed lade en
 * consumer regne videre på et felt, der ikke findes. Kæden "række med fejl → slet række" hævder derfor,
 * at adressen er UTILGÆNGELIG efter delete og TILGÆNGELIG igen efter undo — en stærkere påstand end
 * "canonical er tom".
 */
const DELETED_ADDRESS = 'slettet-adresse' as const;

const CONSUMER_ID = 'statekaede-consumer';

/**
 * En type-udslettet feltreference, som matricen kan holde heterogent.
 *
 * `FieldRef<T>` er INVARIANT i `T` — dens codec både konsumerer OG producerer `T` — så hverken
 * `FieldRef<unknown>` eller `FieldRef<never>` er en fælles form for `FieldRef<number | undefined>` og
 * `FieldRef<ISODateString | undefined>`. Begge forsøg er compilerfejl (TS2352/TS2345, verificeret ved
 * probe), og typen har ret: en `unknown`-værdi må ikke kunne gives til et codec, der kræver et årstal.
 *
 * Matricen har intet brug for værditypen — den LÆSER gennem readeren og sammenligner udfaldet som data.
 * Udslettelsen sker derfor ét sted og eksplicit, gennem `unknown`, frem for spredt ud i `as never`-cast
 * pr. kæde. `Aspects.canonical` er `unknown` af samme grund.
 */
type ErasedFieldRef = FieldRef<unknown>;

/** Den ene udslettelse. `unknown` som mellemled er nødvendig pga. invariansen ovenfor. */
const erase = <T>(field: FieldRef<T>): ErasedFieldRef => field as unknown as ErasedFieldRef;

/**
 * Snapshotter alle ni aspekter for `field`.
 *
 * `dependsOn` er de felter, den simulerede consumer/dokumentgate LÆSER. Consumerstatus og dokumentgate er
 * dependency-specifikke (§1.10): en gate, der læste alt, ville overblokere og gøre kæderne blinde over for
 * netop den fejl. Consumeren læser derfor præcis kædens felt, mens dokumentgaten læser samme felt gennem
 * sin egen projektion — to uafhængige consumers over samme read, som produktionen har.
 */
const snapshot = <T>(
  state: State,
  field: FieldRef<T>,
  dependsOn: readonly ErasedFieldRef[] = [erase(field)]
): Aspects => {
  const token = createEvaluationSourceToken(
    createInputRevision(state.revision),
    createSettingsRevision(1)
  );
  const evaluation = createInputEvaluation({ input: state.input, catalog, sourceToken: token });
  const address = serializeFieldAddress(field.address);

  /** Kører en consumer over `dependsOn`; en slettet adresse er `blocked`, ikke en kastet test. */
  const runConsumer = (consumerId: string): 'ready' | 'blocked' => {
    try {
      const result = runProjection(evaluation.reader, consumerId, (collector) => {
        for (const dependency of dependsOn) {
          const read = collector.require(dependency);
          if (read.status !== 'usable') return undefined;
        }
        return 'ok' as const;
      });
      return result.status === 'ready' ? 'ready' : 'blocked';
    } catch {
      return 'blocked';
    }
  };

  const addressLives = catalog.containsAddressEntities(state.input.sections, field.address);

  return {
    canonical: addressLives
      ? createValidationReader(state.input, catalog).readCanonical(field)
      : DELETED_ADDRESS,
    rejectedRaw: state.input.rejectedInputs[address]?.raw,
    display: addressLives
      ? formatSettledFieldText(field, deriveSettledFieldView(state.input, field))
      : DELETED_ADDRESS,
    fieldIssue: evaluation.issues.get(address)?.reason,
    consumerStatus: runConsumer(CONSUMER_ID),
    eoSaveGate: projectEoSave(state.input, catalog).status === 'ready' ? 'ready' : 'blocked',
    // Dokumentgaten er en ANDEN consumer over samme reads — netop for at kunne se, hvis de divergerer.
    documentGate: runConsumer('statekaede-dokument'),
    revision: state.revision,
    history: { past: state.history.past.length, future: state.history.future.length },
  };
};

/**
 * Én kæde: en startopsætning, en række navngivne trin og den forventede ni-aspekt-tilstand efter hvert.
 *
 * `expected` er den FULDE tilstand, ikke en delmængde: en delvis forventning ville lade et uhævdet aspekt
 * drifte uset, og det er præcis hullet, fundet beskrev.
 */
type Step = Readonly<{ label: string; run: (state: State) => State; expected: Aspects }>;

/**
 * Kæden er typet på , ikke generisk pr. kæde: matricen LÆSER kun feltet gennem
 * readeren og sammenligner udfaldet som data. En generisk parameter ville have tvunget hver kæde til at
 * bære sin egen værditype uden at gøre en enkelt assertion stærkere — de ni aspekter er alle
 * type-udslettede i sammenligningen.
 */
type Chain = Readonly<{
  /** Kædens navn ORDRET fra §7.2, så matricen ikke kan drifte fra sin kilde. */
  name: string;
  field: () => ErasedFieldRef;
  dependsOn?: () => readonly ErasedFieldRef[];
  setup: () => State;
  steps: readonly Step[];
}>;

/** Kortform, så hver forventning kan læses som en linje frem for et objekt over ni linjer. */
const aspects = (
  canonical: unknown,
  rejectedRaw: string | undefined,
  display: string,
  fieldIssue: string | undefined,
  gates: 'alle-ready' | 'consumer-blokeret' | 'save-blokeret',
  revision: number,
  past: number,
  future: number
): Aspects => ({
  canonical,
  rejectedRaw,
  display,
  fieldIssue,
  consumerStatus: gates === 'alle-ready' ? 'ready' : 'blocked',
  documentGate: gates === 'alle-ready' ? 'ready' : 'blocked',
  // Kun REJECTED råtekst blokerer `.eo` (§1.6): en canonical bounds-fejl kan gemmes.
  eoSaveGate: gates === 'save-blokeret' ? 'blocked' : 'ready',
  revision,
  history: { past, future },
});

const ROW = 'chain_row';

/** Baseline med én committet række, så rækkefelternes kæder har en adresse at skrive på. */
const withRow = (): State => {
  const seeded = reduceInputCommand(
    empty(),
    insertRow(rentekravRowsRef(), makeRow(ROW)),
    catalog
  );
  if (!seeded.changed) throw new Error('Testinvariant: baseline-rækken blev ikke indsat');
  return { input: seeded.input, history: createInputHistory(), revision: 2 };
};

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// De otte kæder
// ─────────────────────────────────────────────────────────────────────────────────────────────────

const CHAINS: readonly Chain[] = [
  {
    name: 'gyldig A → ugyldig X → undo → redo',
    field: () => erase(aargangField.bind()),
    setup: () => apply(start(), settleField(aargangField.bind(), '2020')),
    steps: [
      {
        label: 'ugyldig X',
        run: (state) => apply(state, settleField(aargangField.bind(), 'abc')),
        // A er VÆK fra current state (§10-kriterium 2), råteksten er der, og `.eo` blokerer på rejected.
        expected: aspects(undefined, 'abc', 'abc', 'format', 'save-blokeret', 3, 2, 0),
      },
      {
        label: 'undo',
        run: undo,
        expected: aspects(2020, undefined, '2020', undefined, 'alle-ready', 4, 1, 1),
      },
      {
        label: 'redo',
        run: redo,
        expected: aspects(undefined, 'abc', 'abc', 'format', 'save-blokeret', 5, 2, 0),
      },
    ],
  },
  {
    name: 'ugyldig X → ugyldig Y → undo → redo',
    field: () => erase(aargangField.bind()),
    setup: () => apply(start(), settleField(aargangField.bind(), 'abc')),
    steps: [
      {
        label: 'ugyldig Y',
        run: (state) => apply(state, settleField(aargangField.bind(), 'def')),
        expected: aspects(undefined, 'def', 'def', 'format', 'save-blokeret', 3, 2, 0),
      },
      {
        // Undo mellem TO fejltilstande: den tidligere råtekst skal komme ordret tilbage. Uden
        // display-aspektet kunne visningen have vist en tomværdi og stadig bestå.
        label: 'undo',
        run: undo,
        expected: aspects(undefined, 'abc', 'abc', 'format', 'save-blokeret', 4, 1, 1),
      },
      {
        label: 'redo',
        run: redo,
        expected: aspects(undefined, 'def', 'def', 'format', 'save-blokeret', 5, 2, 0),
      },
    ],
  },
  {
    name: 'ugyldig X → gyldig B → undo → redo',
    field: () => erase(aargangField.bind()),
    setup: () => apply(start(), settleField(aargangField.bind(), 'abc')),
    steps: [
      {
        label: 'gyldig B',
        run: (state) => apply(state, settleField(aargangField.bind(), '2024')),
        expected: aspects(2024, undefined, '2024', undefined, 'alle-ready', 3, 2, 0),
      },
      {
        // Tilbage til fejltilstanden: canonical skal RYDDES igen, ikke blot skjules.
        label: 'undo',
        run: undo,
        expected: aspects(undefined, 'abc', 'abc', 'format', 'save-blokeret', 4, 1, 1),
      },
      {
        label: 'redo',
        run: redo,
        expected: aspects(2024, undefined, '2024', undefined, 'alle-ready', 5, 2, 0),
      },
    ],
  },
  {
    name: 'gyldig A → tom → undo → redo',
    field: () => erase(aargangField.bind()),
    setup: () => apply(start(), settleField(aargangField.bind(), '2020')),
    steps: [
      {
        // Tomhed giver INGEN rød feltfejl og blokerer IKKE `.eo` (§10-kriterium 11) — men en consumer,
        // der KRÆVER feltet, får en missing-consumerfejl (§10-kriterium 12). De to ben er forskellige,
        // og netop den sondring er det, aspekterne skiller.
        label: 'tom',
        run: (state) => apply(state, clearField(aargangField.bind())),
        expected: aspects(undefined, undefined, '', undefined, 'consumer-blokeret', 3, 2, 0),
      },
      {
        label: 'undo',
        run: undo,
        expected: aspects(2020, undefined, '2020', undefined, 'alle-ready', 4, 1, 1),
      },
      {
        label: 'redo',
        run: redo,
        expected: aspects(undefined, undefined, '', undefined, 'consumer-blokeret', 5, 2, 0),
      },
    ],
  },
  {
    name: 'gyldig A → bounds-fejl B → undo → redo',
    field: () => erase(beregningsdatoField.bind()),
    setup: () => apply(start(), settleField(beregningsdatoField.bind(), '01-01-2020')),
    steps: [
      {
        // Bounds er §1.6's ANDEN repræsentation: værdien BLIVER canonical, issuet er rødt, consumeren
        // blokeres — men `.eo` kan gemmes (§10-kriterium 10). Visningen viser den canonical værdi, ikke
        // en råtekst, fordi codec'et accepterede den.
        label: 'bounds-fejl B',
        run: (state) => apply(state, settleField(beregningsdatoField.bind(), '01-01-1999')),
        expected: aspects('1999-01-01', undefined, '01-01-1999', 'bounds', 'consumer-blokeret', 3, 2, 0),
      },
      {
        label: 'undo',
        run: undo,
        expected: aspects('2020-01-01', undefined, '01-01-2020', undefined, 'alle-ready', 4, 1, 1),
      },
      {
        label: 'redo',
        run: redo,
        expected: aspects('1999-01-01', undefined, '01-01-1999', 'bounds', 'consumer-blokeret', 5, 2, 0),
      },
    ],
  },
  {
    name: 'skjult gyldig A → vis igen',
    field: () => erase(tillaegstidField.bind(ROW)),
    dependsOn: () => [erase(tillaegstidField.bind(ROW))],
    setup: () => apply(withRow(), settleField(tillaegstidField.bind(ROW), '12')),
    steps: [
      {
        /**
         * `enhed = 'uger'` gør tillaegstid irrelevant. Værdien BEVARES (§5-kriterium 14):
         * canonical, visning og fravær af issue står UÆNDRET på tværs af skjulningen.
         *
         * **Consumerstatus er bevidst `ready` her, ikke `blocked`.** Readeren gater ikke på relevans —
         * en irrelevant men gyldig værdi er læsbar, og det er den enkelte consumers ansvar at afgøre,
         * om den er relevant for netop dens beregning ([[project_field_visibility_single_source]]). En
         * kerne, der skjulte værdien for ALLE consumers, ville gøre det umuligt for en consumer med en
         * anden relevansregel end feltets visningsregel at læse den — og ville dermed være §1.10's
         * overblokering i kernen.
         *
         * Relevansen har ÉN konsekvens for en GYLDIG værdi, og det er ingen: den består urørt. Bar feltet
         * derimod en aktiv RØD fejl, ryddes det tavst med valget (§7.5 pkt. 2) — se næste kæde. Grunden er
         * ikke, at reglen ophører, men at en rød fejl brugeren ikke kan SE, ikke kan rettes; efterlod vi
         * den, kunne den blokere `.eo`-save eller en beregning fra et usynligt felt. Derfor bærer et
         * irrelevant felt aldrig et aktivt issue: det skjulte er tavst, FORDI det er ryddet.
         */
        label: 'skjul (enhed → uger) bevarer den gyldige værdi uændret',
        run: (state) => apply(state, setImmediateField(enhedField.bind(ROW), 'uger')),
        expected: aspects(12, undefined, '12', undefined, 'alle-ready', 4, 2, 0),
      },
      {
        label: 'vis igen (enhed → dage)',
        run: (state) => apply(state, setImmediateField(enhedField.bind(ROW), 'dage')),
        // Værdien er der stadig — den blev bevaret, ikke genskabt.
        expected: aspects(12, undefined, '12', undefined, 'alle-ready', 5, 3, 0),
      },
      {
        label: 'undo (tilbage til skjult)',
        run: undo,
        expected: aspects(12, undefined, '12', undefined, 'alle-ready', 6, 2, 1),
      },
    ],
  },
  {
    name: 'skjult fejl X → undo → redo',
    field: () => erase(tillaegstidField.bind(ROW)),
    dependsOn: () => [erase(tillaegstidField.bind(ROW))],
    setup: () => apply(withRow(), settleField(tillaegstidField.bind(ROW), '999')),
    steps: [
      {
        // Udgangspunkt: en aktiv rød BOUNDS-fejl på et synligt felt.
        label: 'baseline: aktiv bounds-fejl',
        run: (state) => state,
        expected: aspects(999, undefined, '999', 'bounds', 'consumer-blokeret', 3, 1, 0),
      },
      {
        /*
         * Skjules feltet, RYDDES den fejlende værdi atomisk med det styrende valg (§5-kriterium 14, §7.5
         * pkt. 2) — modsat den GYLDIGE værdi i kæden ovenfor, som bevares. Forskellen er hele reglen: en
         * rød fejl, brugeren ikke kan SE, kan ikke rettes og må derfor ikke blive stående og blokere.
         *
         * Feltissuet forsvinder med værdien. Consumeren er derimod fortsat blokeret — men nu af `missing`
         * (den KRÆVER feltet), ikke af en usynlig rød fejl. Det er den rigtige blokering: den peger på et
         * manglende krav, som brugeren kan opfylde, i stedet for på en fejl i et felt, der ikke kan ses.
         */
        label: 'skjul (enhed → uger) rydder den fejlende værdi',
        run: (state) => apply(state, setImmediateField(enhedField.bind(ROW), 'uger')),
        expected: aspects(undefined, undefined, '', undefined, 'consumer-blokeret', 4, 2, 0),
      },
      {
        label: 'undo gendanner BÅDE valget og den fejlende værdi',
        run: undo,
        expected: aspects(999, undefined, '999', 'bounds', 'consumer-blokeret', 5, 1, 1),
      },
      {
        label: 'redo rydder den igen',
        run: redo,
        expected: aspects(undefined, undefined, '', undefined, 'consumer-blokeret', 6, 2, 0),
      },
    ],
  },
  {
    name: 'række med fejl → slet række → undo → redo',
    field: () => erase(tillaegstidField.bind(ROW)),
    dependsOn: () => [erase(tillaegstidField.bind(ROW))],
    setup: () => apply(withRow(), settleField(tillaegstidField.bind(ROW), 'abc')),
    steps: [
      {
        label: 'baseline: rækken bærer rejected råtekst',
        run: (state) => state,
        expected: aspects(undefined, 'abc', 'abc', 'format', 'save-blokeret', 3, 1, 0),
      },
      {
        // Row-delete fjerner rækkens rejected descendants ATOMISK (§10-kriterium 19): `.eo` kan gemmes
        // igen, fordi den rå tekst gik med rækken. Adressen findes ikke længere — se `DELETED_ADDRESS`.
        label: 'slet række',
        run: (state) => {
          // `reduceInputCommand` er den rene reducer og tager ingen origin; origin er dispatch-portens
          // krav (§3.7) og måles i `commandInvariants.test.ts`. Kæderne måler tilstandsovergangen.
          const result = reduceInputCommand(
            state.input,
            deleteRow(rentekravRowsRef(), ROW),
            catalog
          );
          if (!result.changed) throw new Error('Testinvariant: rækken blev ikke slettet');
          return {
            input: result.input,
            history: pushInputHistory(state.history, state.input),
            revision: state.revision + 1,
          };
        },
        expected: aspects(
          DELETED_ADDRESS, undefined, DELETED_ADDRESS, undefined, 'consumer-blokeret', 4, 2, 0
        ),
      },
      {
        label: 'undo gendanner rækken OG dens rejected råtekst',
        run: undo,
        expected: aspects(undefined, 'abc', 'abc', 'format', 'save-blokeret', 5, 1, 1),
      },
      {
        label: 'redo fjerner den igen',
        run: redo,
        expected: aspects(
          DELETED_ADDRESS, undefined, DELETED_ADDRESS, undefined, 'consumer-blokeret', 6, 2, 0
        ),
      },
    ],
  },
];

/**
 * §7.2's kædeliste, ORDRET fra designet. Uden denne binding kunne en kæde blive omdøbt eller falde ud af
 * matricen uden at nogen kontrol blev rød — samme fejlklasse som acceptregistrets §10-binding.
 */
const NORMATIVE_CHAIN_NAMES: readonly string[] = [
  'gyldig A → ugyldig X → undo → redo',
  'ugyldig X → ugyldig Y → undo → redo',
  'ugyldig X → gyldig B → undo → redo',
  'gyldig A → tom → undo → redo',
  'gyldig A → bounds-fejl B → undo → redo',
  'skjult gyldig A → vis igen',
  'skjult fejl X → undo → redo',
  'række med fejl → slet række → undo → redo',
];

describe('Obligatoriske statekæder (§7.2) — alle otte, alle ni aspekter pr. trin', () => {
  it('matricen dækker præcis designets otte kæder', () => {
    expect(CHAINS.map((chain) => chain.name)).toEqual(NORMATIVE_CHAIN_NAMES);
  });

  for (const chain of CHAINS) {
    /**
     * **Hvorfor kædenavnet står i en `describe` og ikke i leaf-testens navn.**
     *
     * §10-acceptregistret citerer udelukkende LEAF-tests som evidens (R8-F01), og et dynamisk leaf-navn
     * (`it(chain.name + …)`) kan pr. konstruktion ikke citeres: registrets AST-parser ser kun statiske
     * navnedele, og en interpolation er en per-case-værdi, ingen registerpost kan kende. Kædenavnene er
     * derfor bundet et STÆRKERE sted end et testnavn — i `NORMATIVE_CHAIN_NAMES`, som
     * completeness-testen nedenfor sammenligner ordret med designets §7.2-liste. Forsvinder en kæde,
     * bliver den test rød med kædens navn; et testnavn ville blot være forsvundet.
     *
     * Registret citerer den ene faste leaf-test, som bærer ALLE otte kæders assertioner.
     */
    describe(chain.name, () => {
      it('hvert trin i kæden har den forventede tilstand i alle ni aspekter', () => {
        let state = chain.setup();
        const field = chain.field();
        const dependsOn = chain.dependsOn?.();
        for (const step of chain.steps) {
          state = step.run(state);
          expect(
            snapshot(state, field, dependsOn),
            `${chain.name} → efter "${step.label}"`
          ).toEqual(step.expected);
        }
      });
    });
  }

  /**
   * Snapshottet skal kunne FEJLE på hvert enkelt aspekt. Et snapshot, hvis felter alle var konstante
   * eller udledt af hinanden, ville bestå enhver kæde og måle intet — så matricen ville se ud som ni
   * aspekter og reelt være ét.
   *
   * Kontrollen er derfor: der findes for HVERT aspekt to tilstande i matricens egne kæder, hvor netop
   * det aspekt er forskelligt. Er et aspekt konstant på tværs af alle otte kæders alle trin, er det
   * ikke evidens for noget.
   */
  it('hvert af de ni aspekter varierer et sted i matricen — ingen er en konstant', () => {
    const allExpected = CHAINS.flatMap((chain) => chain.steps.map((step) => step.expected));
    const aspectKeys = [
      'canonical', 'rejectedRaw', 'display', 'fieldIssue',
      'consumerStatus', 'eoSaveGate', 'documentGate', 'revision', 'history',
    ] as const;
    for (const key of aspectKeys) {
      const distinct = new Set(allExpected.map((entry) => JSON.stringify(entry[key])));
      expect(
        distinct.size,
        `aspektet "${key}" har samme værdi i ALLE trin i alle otte kæder og kan derfor ikke fejle`
      ).toBeGreaterThan(1);
    }
  });
});

// @vitest-environment jsdom
/**
 * §7.1's FÆLLES feltkontrakt — ÉN invariantliste kørt mod BEGGE adaptere for hver codecfamilie
 * Kørt mod BEGGE adaptere.
 *
 * **Hvad fundet var.** Form-suiterne (`useFieldEditor`, `useFormFieldSurface`) brugte kun `aargangField`
 * med integer-codec, og grid-suiten brugte primært `belobField` med amount-codec. Der fandtes INGEN
 * fælles suite kørt mod begge adaptere pr. familie, som §7.1 kræver. Separate codec-unit-tests
 * (`fieldCodecs.test.ts`) og separate surface-tests beviser hver sin halvdel — men ikke
 * KOMPOSITIONEN, og det er dér, en regression i fx dato-, procent- eller choice-felters åbning,
 * paste, settle eller Escape kan ramme én surface uden at nogen fælles kontrakt bliver rød.
 *
 * **Hvorfor familierne er OPREGNELIGE nu.** `FieldCodec.family` blev tilføjet som et PÅKRÆVET felt
 * (`fieldCodec.ts`), fordi kravet "for hver codecfamilie" ikke kan håndhæves mod en hånd-vedligeholdt
 * liste i en testfil — netop den slags liste var det, der stille faldt bagud. Nu opregnes de LEVENDE
 * familier fra produktionskataloget, og en familie uden en case her er en rød test med sit navn.
 *
 * **Hvad suiten deler, og hvad den ikke deler.** Begge adaptere returnerer den SAMME type
 * (`FieldEditorController<T>`), fordi §10-kriterium 6 kræver, at de kun ejer interaktion, rendering og
 * navigation. Invariantlisten er derfor ordret den samme funktion for begge — ikke to lister, der
 * tilfældigvis hævder det samme. Det, der sagligt adskiller dem (tast-initieret åbning, paste,
 * Backspace/Delete på et lukket felt) hører til `useFormFieldSurface`s DOM-mekanik og måles fortsat i
 * dens egen suite; her måles den kontrakt, de to DELER.
 */
import { __createSlimInputTestStore } from '../../../inputCore/runtime/slimInputStore';
import * as React from 'react';
import { renderHook, act } from '@testing-library/react';
import { dispatchInput, ActiveEditorRegistry, type SlimInputStore } from '../../../inputCore/runtime';
import {
  createInputRuntimeBinding,
  InputRuntimeProvider,
  useFieldEditor,
  useCellEditor,
  type InputRuntimeBinding,
  type FieldEditorController,
} from '../../../inputCore/react';
import { createInputEvaluation, createValidationReader } from '../../../inputCore/inputReader';
import {
  insertRow,
  settleField,
  serializeFieldAddress,
  toAnyFieldRef,
  buildFieldIssueSet,
  bindFieldIssueSnapshot,
  createEvaluationSourceToken,
  type InputCatalog,
  type FieldRef,
  type FieldIssue,
  type FieldIssueSnapshot,
} from '../../../inputCore';
import type { FieldCodecFamily } from '../../../inputCore/fieldCodec';
import { productionInputFields } from '../../../inputCore/catalog/productionCatalog';
import {
  createTestCatalog,
  aargangField,
  beregningsdatoField,
  kommentarerField,
  belobField,
  tillaegstidField,
  enhedField,
  renterFraField,
  feriePctField,
  omregningField,
  skadestypeField,
  makeRow,
  rentekravRowsRef,
  testRowOrigin,
  testLocation,
} from '../testCatalog';
import { skadestypeEnum } from '../../../schemas/formSchemas/enumSchemas';

/** Valgmængden fra produktionens enum, så casen ikke citerer en literal, der kan drifte. */
const SKADESTYPE_OPTIONS = skadestypeEnum.options;

let catalog: InputCatalog;
let store: SlimInputStore;
let registry: ActiveEditorRegistry;
let issues: FieldIssue[];

beforeEach(() => {
  sessionStorage.clear();
  catalog = createTestCatalog();
  store = __createSlimInputTestStore();
  registry = new ActiveEditorRegistry();
  issues = [];
});

afterEach(() => sessionStorage.clear());

const ROW = 'contract_row';

const buildIssues = (): FieldIssueSnapshot => {
  const state = store.getState();
  return bindFieldIssueSnapshot(
    buildFieldIssueSet(issues),
    createEvaluationSourceToken(state.revision, state.settingsRevision)
  );
};

const makeBinding = (): InputRuntimeBinding =>
  createInputRuntimeBinding(store, catalog, registry, () => {
    const state = store.getState();
    return createInputEvaluation({
      input: state.input,
      catalog,
      sourceToken: createEvaluationSourceToken(state.revision, state.settingsRevision),
    });
  }, buildIssues);

const wrapper = (binding: InputRuntimeBinding) => {
  const Wrapper = ({ children }: { children: React.ReactNode }) =>
    <InputRuntimeProvider binding={binding}>{children}</InputRuntimeProvider>;
  Wrapper.displayName = 'SharedFieldContractWrapper';
  return Wrapper;
};

const canonical = <T,>(field: FieldRef<T>): T =>
  createValidationReader(store.getState().input, catalog).readCanonical(field);

const rejectedRaw = <T,>(field: FieldRef<T>): string | undefined =>
  store.getState().input.rejectedInputs[serializeFieldAddress(field.address)]?.raw;

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// De to adaptere bag ÉN indgang
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * En surface er en funktion, der giver en `FieldEditorController<T>` for et felt. Formen er den samme
 * for de to adaptere — det er hele §10-kriterium 6 — så invariantlisten nedenfor kender ikke forskellen.
 */
type SurfaceKind = 'form' | 'grid';

type RenderedSurface<T> = Readonly<{
  controller: () => FieldEditorController<T>;
  act: (fn: () => void) => void;
}>;

const renderFormSurface = <T,>(field: FieldRef<T>): RenderedSurface<T> => {
  const binding = makeBinding();
  const { result } = renderHook(
    () => useFieldEditor(field, testLocation(`form:${field.descriptor.id}`)),
    { wrapper: wrapper(binding) }
  );
  return { controller: () => result.current, act: (fn) => act(fn) };
};

const renderGridSurface = <T,>(field: FieldRef<T>): RenderedSurface<T> => {
  const binding = makeBinding();
  const { result } = renderHook(
    () => useCellEditor({
      kind: 'existing',
      field,
      location: testLocation(`cell:${field.descriptor.id}`),
    }),
    { wrapper: wrapper(binding) }
  );
  return { controller: () => result.current, act: (fn) => act(fn) };
};

const renderSurface = <T,>(kind: SurfaceKind, field: FieldRef<T>): RenderedSurface<T> =>
  kind === 'form' ? renderFormSurface(field) : renderGridSurface(field);

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Familiernes cases
// ─────────────────────────────────────────────────────────────────────────────────────────────────

type FamilyCase<T> = Readonly<{
  family: FieldCodecFamily;
  /** Formularfeltet (uden entity-led) og rækkecellen (med) — samme familie, to adressearter. */
  formField: () => FieldRef<T>;
  cellField: () => FieldRef<T>;
  /** En råtekst, der committer canonical, plus den værdi codec'et skal give. */
  valid: Readonly<{ raw: string; canonical: T }>;
  /** En anden gyldig råtekst, så "ændring" kan skelnes fra "samme værdi igen". */
  otherValid: Readonly<{ raw: string; canonical: T }>;
  /** En råtekst codec'et AFVISER, eller `null` for familier der ikke kan afvise (tekst/choice-default). */
  invalidRaw: string | null;
  /** Feltets canonical tomværdi efter et tomt settle. */
  emptyCanonical: T;
  /** Kan familien overhovedet ÅBNES af en tast? (choice/toggle kan ikke, §1.3.) */
  keyboardOpenable: boolean;
}>;

/**
 * Kataloget over familier, den fælles kontrakt kører. Testkataloget bærer bevidst ÉT felt pr. familie
 * i hver adressart — flere ville måle samme codec to gange.
 */
const FAMILY_CASES = [
  {
    family: 'integer',
    formField: () => aargangField.bind(),
    cellField: () => tillaegstidField.bind(ROW),
    valid: { raw: '2020', canonical: 2020 },
    otherValid: { raw: '2024', canonical: 2024 },
    invalidRaw: 'abc',
    emptyCanonical: undefined,
    keyboardOpenable: true,
  } as FamilyCase<number | undefined>,
  {
    family: 'date',
    formField: () => beregningsdatoField.bind(),
    cellField: () => renterFraField.bind(ROW),
    valid: { raw: '01-01-2020', canonical: '2020-01-01' as never },
    otherValid: { raw: '02-02-2021', canonical: '2021-02-02' as never },
    invalidRaw: 'ikke-en-dato',
    emptyCanonical: undefined,
    keyboardOpenable: true,
  } as FamilyCase<string | undefined>,
  {
    family: 'optionalText',
    formField: () => kommentarerField.bind(),
    // Optional tekst har intet rækkefelt i testkataloget; produktionen har begge (se
    // dækningskontrollen nedenfor), og kontrakten kører derfor form-benet mod formularfeltet og
    // grid-benet mod SAMME descriptor gennem celleadapteren. Det er stadig en ægte parity-måling: de
    // to adaptere driver samme codec ad hver sin vej.
    cellField: () => kommentarerField.bind(),
    valid: { raw: 'en note', canonical: 'en note' },
    otherValid: { raw: 'en anden note', canonical: 'en anden note' },
    // Fritekst kan ALDRIG afvises (§3.3) — og det er selv en invariant, ikke et hul.
    invalidRaw: null,
    emptyCanonical: undefined,
    keyboardOpenable: true,
  } as FamilyCase<string | undefined>,
  {
    family: 'amount',
    formField: () => belobField.bind(ROW),
    cellField: () => belobField.bind(ROW),
    valid: { raw: '1000', canonical: { kind: 'number', value: 1000 } as never },
    otherValid: { raw: '2500', canonical: { kind: 'number', value: 2500 } as never },
    invalidRaw: 'abc',
    emptyCanonical: undefined,
    keyboardOpenable: true,
  } as FamilyCase<unknown>,
  {
    family: 'requiredChoice',
    formField: () => enhedField.bind(ROW),
    cellField: () => enhedField.bind(ROW),
    valid: { raw: 'uger', canonical: 'uger' as never },
    otherValid: { raw: 'maaneder', canonical: 'maaneder' as never },
    invalidRaw: 'ukendt-enhed',
    // Required choice's tomværdi er en GYLDIG default ('dage'), ikke `undefined` — den sondring er
    // netop familiens egen adfærd, og en fælles kontrakt uden den ville have målt integer-formen igen.
    emptyCanonical: 'dage' as never,
    keyboardOpenable: false,
  } as FamilyCase<string>,
  {
    family: 'percent',
    formField: () => feriePctField.bind(),
    cellField: () => feriePctField.bind(),
    valid: { raw: '12,5', canonical: 12.5 },
    otherValid: { raw: '15', canonical: 15 },
    invalidRaw: 'abc',
    emptyCanonical: undefined,
    keyboardOpenable: true,
  } as FamilyCase<number | undefined>,
  {
    family: 'boolean',
    formField: () => omregningField.bind(),
    cellField: () => omregningField.bind(),
    valid: { raw: 'true', canonical: true },
    // Booleans har kun to værdier; "en anden gyldig" er derfor `false`, som også er tomværdien.
    // Kontraktens tomheds-ben og dens ændrings-ben peger da på samme canonical — det er familiens
    // egen natur, ikke en svaghed i suiten.
    otherValid: { raw: 'false', canonical: false },
    invalidRaw: null,
    emptyCanonical: false,
    keyboardOpenable: false,
  } as FamilyCase<boolean>,
  {
    family: 'selection',
    formField: () => skadestypeField.bind(),
    cellField: () => skadestypeField.bind(),
    valid: { raw: SKADESTYPE_OPTIONS[0], canonical: SKADESTYPE_OPTIONS[0] as never },
    otherValid: { raw: SKADESTYPE_OPTIONS[1], canonical: SKADESTYPE_OPTIONS[1] as never },
    invalidRaw: 'ukendt-skadestype',
    emptyCanonical: undefined,
    keyboardOpenable: false,
  } as FamilyCase<string | undefined>,
  /**
   * Listen bærer BEVIDST ikke et `satisfies readonly FamilyCase<never>[]`. `FieldRef<T>` er invariant i
   * `T` (codec'et både konsumerer og producerer `T`), så der findes ingen fælles `FamilyCase<X>`, en
   * heterogen liste kan opfylde — hverken `never` eller `unknown`. Hvert element er derfor annoteret
   * individuelt med sin egen `FamilyCase<T>`, hvilket giver den samme feltvise kontrol; det, `satisfies`
   * ellers ville have tilføjet, er en homogenitet, familierne pr. definition ikke har.
   *
   * Dækningen håndhæves i stedet MASKINELT nedenfor mod produktionskataloget — en stærkere kontrol end
   * en typeannotation, fordi den måler, om familien FINDES, ikke blot om casen er velformet.
   */
] as const;

/**
 * Kontraktkørslen læser casen TYPE-UDSLETTET. Det er ikke en opgivelse af typesikkerheden, men en
 * konsekvens af, at `FieldRef<T>` er invariant: en fælles løkke over familier med forskellige `T` KAN
 * ikke være generisk. Hver case er typechecket individuelt ovenfor mod sin egen `FamilyCase<T>`; her
 * bruges kun de dele, invariantlisten faktisk rører — og de er alle data (råtekst, canonical, flag).
 */
type ErasedFamilyCase = Readonly<{
  family: FieldCodecFamily;
  formField: () => FieldRef<never>;
  cellField: () => FieldRef<never>;
  valid: Readonly<{ raw: string; canonical: unknown }>;
  otherValid: Readonly<{ raw: string; canonical: unknown }>;
  invalidRaw: string | null;
  emptyCanonical: unknown;
  keyboardOpenable: boolean;
}>;

const CONTRACT_CASES: readonly ErasedFamilyCase[] =
  FAMILY_CASES as readonly unknown[] as readonly ErasedFamilyCase[];

const seedRow = (): void => {
  dispatchInput(store, catalog, insertRow(rentekravRowsRef(), makeRow(ROW)), { origin: testRowOrigin() });
};

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// ÉN invariantliste, to adaptere
// ─────────────────────────────────────────────────────────────────────────────────────────────────

describe('§7.1 fælles feltkontrakt — samme suite mod form OG grid pr. codecfamilie', () => {
  for (const testCase of CONTRACT_CASES) {
    describe(`familie: ${testCase.family}`, () => {
      for (const surface of ['form', 'grid'] as const) {
        describe(`surface: ${surface}`, () => {
          const fieldFor = () => surface === 'form' ? testCase.formField() : testCase.cellField();

          it('lukket felt viser canonical fra revisionen uden lokal kopi', () => {
            seedRow();
            const field = fieldFor();
            dispatchInput(store, catalog, settleField(field, testCase.valid.raw));
            const rendered = renderSurface(surface, field);
            expect(rendered.controller().isOpen).toBe(false);
            // Visningen kommer fra den AFSLUTTEDE revision — ikke fra en lokal kopi, adapteren holder.
            expect(rendered.controller().displayText)
              .toBe(field.descriptor.codec.format(canonical(field)));
          });

          it('åben draft ændrer intet afsluttet (§1.2)', () => {
            seedRow();
            const field = fieldFor();
            dispatchInput(store, catalog, settleField(field, testCase.valid.raw));
            const revisionBefore = store.getState().revision;
            const rendered = renderSurface(surface, field);

            rendered.act(() => rendered.controller().open());
            rendered.act(() => rendered.controller().changeDraft(testCase.otherValid.raw));

            expect(rendered.controller().isOpen).toBe(true);
            expect(store.getState().revision).toBe(revisionBefore);
            expect(canonical(field)).toEqual(testCase.valid.canonical);
          });

          it('gyldigt settle skriver ny canonical og lukker editoren', () => {
            seedRow();
            const field = fieldFor();
            const rendered = renderSurface(surface, field);

            rendered.act(() => rendered.controller().open());
            rendered.act(() => rendered.controller().changeDraft(testCase.valid.raw));
            rendered.act(() => rendered.controller().settle());

            expect(canonical(field)).toEqual(testCase.valid.canonical);
            expect(rejectedRaw(field)).toBeUndefined();
            expect(rendered.controller().isOpen).toBe(false);
          });

          it('tomt settle rydder til feltets canonical tomværdi', () => {
            seedRow();
            const field = fieldFor();
            dispatchInput(store, catalog, settleField(field, testCase.valid.raw));
            const rendered = renderSurface(surface, field);

            rendered.act(() => rendered.controller().open());
            rendered.act(() => rendered.controller().changeDraft(''));
            rendered.act(() => rendered.controller().settle());

            expect(canonical(field)).toEqual(testCase.emptyCanonical);
            expect(rejectedRaw(field)).toBeUndefined();
          });

          it('no-op settle uden ændring giver ingen ny revision (§3.6)', () => {
            seedRow();
            const field = fieldFor();
            dispatchInput(store, catalog, settleField(field, testCase.valid.raw));
            const revisionBefore = store.getState().revision;
            const rendered = renderSurface(surface, field);

            rendered.act(() => rendered.controller().open());
            rendered.act(() => rendered.controller().settle());

            expect(store.getState().revision).toBe(revisionBefore);
          });

          it('Escape lukker uden command, og et efterfølgende settle er no-op (§1.3)', () => {
            seedRow();
            const field = fieldFor();
            dispatchInput(store, catalog, settleField(field, testCase.valid.raw));
            const revisionBefore = store.getState().revision;
            const rendered = renderSurface(surface, field);

            rendered.act(() => rendered.controller().open());
            rendered.act(() => rendered.controller().changeDraft(testCase.otherValid.raw));
            rendered.act(() => rendered.controller().cancel());
            rendered.act(() => rendered.controller().settle());

            expect(rendered.controller().isOpen).toBe(false);
            expect(store.getState().revision).toBe(revisionBefore);
            expect(canonical(field)).toEqual(testCase.valid.canonical);
          });

          it('eksisterende rød fejl bliver stående under redigering (§1.2/§1.8)', () => {
            seedRow();
            const field = fieldFor();
            dispatchInput(store, catalog, settleField(field, testCase.valid.raw));
            issues = [Object.freeze({
              kind: 'field',
              code: `${field.descriptor.id}.bounds`,
              severity: 'error',
              field: toAnyFieldRef(field),
              reason: 'bounds',
              message: 'uden for interval',
            })];
            const rendered = renderSurface(surface, field);

            expect(rendered.controller().issue?.reason).toBe('bounds');
            rendered.act(() => rendered.controller().open());
            rendered.act(() => rendered.controller().changeDraft(testCase.otherValid.raw));
            // UÆNDRET under redigering: den åbne draft driver aldrig fejlfeedback.
            expect(rendered.controller().issue?.reason).toBe('bounds');
          });

          it('værdien går gennem feltets EGET codec — samme parse på begge surfaces', () => {
            seedRow();
            const field = fieldFor();
            const rendered = renderSurface(surface, field);

            rendered.act(() => rendered.controller().open());
            rendered.act(() => rendered.controller().changeDraft(testCase.otherValid.raw));
            rendered.act(() => rendered.controller().settle());

            // Ikke blot "en værdi blev skrevet": PRÆCIS det, codec'et selv resolver råteksten til.
            const resolution = field.descriptor.codec.parseForSettle(testCase.otherValid.raw);
            expect(resolution.status).toBe('valid');
            if (resolution.status !== 'valid') return;
            expect(canonical(field)).toEqual(resolution.value);
            expect(canonical(field)).toEqual(testCase.otherValid.canonical);
          });

          if (testCase.invalidRaw !== null) {
            it('ugyldigt settle er XOR: canonical ryddet, rejected råtekst skrevet (§1.5)', () => {
              seedRow();
              const field = fieldFor();
              dispatchInput(store, catalog, settleField(field, testCase.valid.raw));
              const rendered = renderSurface(surface, field);

              rendered.act(() => rendered.controller().open());
              rendered.act(() => rendered.controller().changeDraft(testCase.invalidRaw!));
              rendered.act(() => rendered.controller().settle());

              expect(canonical(field)).toEqual(testCase.emptyCanonical);
              expect(rejectedRaw(field)).toBe(testCase.invalidRaw);
            });

            it('en NY fejl vises først EFTER settle, ikke under redigering (§1.2)', () => {
              seedRow();
              const field = fieldFor();
              dispatchInput(store, catalog, settleField(field, testCase.valid.raw));
              const rendered = renderSurface(surface, field);

              rendered.act(() => rendered.controller().open());
              rendered.act(() => rendered.controller().changeDraft(testCase.invalidRaw!));
              // Endnu ikke settlet: intet issue, og intet rejected input.
              expect(rendered.controller().issue).toBeUndefined();
              expect(rejectedRaw(field)).toBeUndefined();

              rendered.act(() => rendered.controller().settle());
              expect(rejectedRaw(field)).toBe(testCase.invalidRaw);
            });
          }

          it('tast-initieret åbning følger codec\'ets EGEN acceptsInitialKey', () => {
            seedRow();
            const field = fieldFor();
            const rendered = renderSurface(surface, field);
            const firstChar = testCase.valid.raw[0]!;
            const accepts = field.descriptor.codec.acceptsInitialKey(firstChar);

            // Kontrakten er ikke "åbner altid" men "åbner PRÆCIS når codec'et tillader det" — derfor
            // hævdes begge udfald mod codec'ets eget svar. Choice-familier accepterer ingen tast.
            expect(accepts).toBe(testCase.keyboardOpenable);
            rendered.act(() => rendered.controller().open(firstChar));
            expect(rendered.controller().isOpen).toBe(true);
            if (accepts) {
              expect(rendered.controller().displayText).toBe(firstChar);
            }
          });
        });
      }

      /**
       * Selve PARITETEN: de to adaptere skal give SAMME resultat for samme råtekst. De otte tests
       * ovenfor kører hver for sig og kunne i princippet begge være grønne på hver sin forkerte måde;
       * denne sammenligner udfaldene direkte.
       */
      it('form og grid giver IDENTISK canonical, rejected og visning for samme råtekst', () => {
        const results: Record<SurfaceKind, unknown[]> = { form: [], grid: [] };
        for (const surface of ['form', 'grid'] as const) {
          // Frisk runtime pr. surface, så den ene ikke arver den andens tilstand.
          sessionStorage.clear();
          catalog = createTestCatalog();
          store = __createSlimInputTestStore();
          registry = new ActiveEditorRegistry();
          issues = [];
          seedRow();

          const field = surface === 'form' ? testCase.formField() : testCase.cellField();
          const rendered = renderSurface(surface, field);
          for (const raw of [testCase.valid.raw, testCase.otherValid.raw, ...(
            testCase.invalidRaw === null ? [] : [testCase.invalidRaw]
          ), '']) {
            rendered.act(() => rendered.controller().open());
            rendered.act(() => rendered.controller().changeDraft(raw));
            rendered.act(() => rendered.controller().settle());
            results[surface].push({
              raw,
              canonical: canonical(field),
              rejected: rejectedRaw(field),
              display: rendered.controller().displayText,
            });
          }
        }
        expect(results.grid).toEqual(results.form);
      });
    });
  }
});

/**
 * Dækningskontrollen: hver LEVENDE codecfamilie i produktionen skal have en case ovenfor — eller stå
 * på den navngivne liste over familier, hvor produktionen KUN har den ene surface.
 *
 * Familielisten kommer fra produktionskataloget, ikke fra en konstant her. Det er hele grunden til, at
 * `FieldCodec.family` blev indført: en hånd-vedligeholdt liste ville have samme svaghed som den dækning,
 * fundet beskrev — den kan falde bagud uden at nogen kontrol bliver rød.
 */
describe('§7.1 dækning — hver levende codecfamilie er dækket eller navngivet som enkelt-surface', () => {
  type FamilySurfaces = Readonly<{ form: readonly string[]; cell: readonly string[] }>;

  const liveFamilies = (): ReadonlyMap<FieldCodecFamily, FamilySurfaces> => {
    const result = new Map<FieldCodecFamily, { form: string[]; cell: string[] }>();
    for (const descriptor of productionInputFields) {
      const family = descriptor.codec.family;
      const entry = result.get(family) ?? { form: [], cell: [] };
      const isCell = descriptor.template.path.some((segment) => segment.kind === 'entity');
      (isCell ? entry.cell : entry.form).push(descriptor.id);
      result.set(family, entry);
    }
    return result;
  };

  /**
   * Familier, hvor produktionen kun HAR den ene adressart. En fælles form/grid-kontrakt for dem ville
   * måle en flade, der ikke findes — derfor er de navngivet med deres begrundelse frem for at være
   * udeladt i tavshed, og hver af dem har fortsat sin egen surface-dækning.
   */
  const SINGLE_SURFACE_FAMILIES: Readonly<Record<string, string>> = Object.freeze({
    // Kun formular: ansvarsgrad angives på EO's forligsside, ikke i en tabel.
    fraction: 'kun formular (eo.forligAnsvarsgradBroek); ingen rækkecelle i produktionen',
    year: 'kun formular (satser.aargang, eo.svieSmerteSatserAar); ingen rækkecelle i produktionen',
    // Kun celle: begge er tabel-kolonner uden en formular-modpart.
    stringBacked: 'kun rækkecelle (aarsloen.tableData.col0_maaned m.fl.); ingen formularfelt',
    text: 'kun rækkecelle (eo.oevrigeKravPerioder.udgiftTil); ingen formularfelt',
  });

  const COVERED = new Set<string>(FAMILY_CASES.map((entry) => entry.family));

  it('hver familie med BEGGE surfaces i produktionen har en fælles kontraktcase', () => {
    const missing: string[] = [];
    for (const [family, surfaces] of liveFamilies()) {
      if (surfaces.form.length === 0 || surfaces.cell.length === 0) continue;
      if (COVERED.has(family)) continue;
      missing.push(`${family} (form: ${surfaces.form[0]}, celle: ${surfaces.cell[0]})`);
    }
    expect(
      missing,
      'disse familier findes på BEGGE surfaces i produktionen, men har ingen case i FAMILY_CASES — '
      + '§7.1 kræver den fælles kontrakt kørt for hver familie'
    ).toEqual([]);
  });

  it('hver enkelt-surface-familie er navngivet med en begrundelse — og er faktisk enkelt-surface', () => {
    for (const [family, surfaces] of liveFamilies()) {
      const isSingle = surfaces.form.length === 0 || surfaces.cell.length === 0;
      const named = SINGLE_SURFACE_FAMILIES[family] !== undefined;
      if (isSingle) {
        expect(named, `${family} har kun én surface i produktionen, men er ikke navngivet`).toBe(true);
      } else {
        // Anti-rot: en familie, der HAR fået sin anden surface, må ikke blive stående på listen.
        expect(
          named,
          `${family} har nu BEGGE surfaces i produktionen og skal fjernes fra SINGLE_SURFACE_FAMILIES`
        ).toBe(false);
      }
    }
    // Og hver navngiven post skal svare til en familie, der faktisk findes (ikke en forældet post).
    const families = new Set<string>([...liveFamilies().keys()]);
    for (const family of Object.keys(SINGLE_SURFACE_FAMILIES)) {
      expect(families.has(family), `${family} står på listen, men findes ikke i produktionskataloget`).toBe(true);
    }
  });

  it('kontrollen kan FEJLE: en fjernet case ville blive fanget (prædikatet er ikke vakuøst)', () => {
    // Uden denne kontrol kunne `COVERED` være tom og de to tests ovenfor stadig grønne, hvis
    // `liveFamilies()` ved en fejl gav et tomt map.
    expect(COVERED.size).toBeGreaterThanOrEqual(5);
    expect(liveFamilies().size).toBeGreaterThanOrEqual(10);
    // Et konkret bevis for, at "har begge surfaces"-prædikatet virker: `date` HAR begge.
    const dateSurfaces = liveFamilies().get('date');
    expect(dateSurfaces?.form.length).toBeGreaterThan(0);
    expect(dateSurfaces?.cell.length).toBeGreaterThan(0);
  });
});

// @vitest-environment jsdom
/**
 * §7.5's kritiske handlinger med VIRKELIGE form- og grid-editorer.
 *
 * **Hvad fundet var.** Coordinator- og save/load-testene brugte SYNTETISKE `ActiveEditor`-objekter, og
 * dokumentlivscyklussens "åben draft"-cases castede instrumenterede resultater ind frem for at åbne en
 * editor. Der fandtes ingen grid-integration for de kritiske handlinger overhovedet. Konsekvensen: et brud
 * i `useFieldEditor`-registreringen, i adapterens settle/discard-livscyklus eller i grid-specifik
 * eventorden kunne passere, selv om den syntetiske coordinator-test var grøn — og udfaldet ville være en
 * tabt draft, et stale save eller en forkert kassering ved load.
 *
 * **Hvad denne suite tilføjer, og hvad den IKKE erstatter.** De syntetiske tests beviser MEKANISMEN
 * (serialisering, fail-closed, fault-injection) og bliver stående: de kan injicere fejl, en ægte editor
 * ikke kan fremprovokere. Denne suite beviser INTEGRATIONEN — at de ægte adaptere registrerer sig, at
 * coordinatorens settle faktisk lander deres transaktion, og at BEGGE surfaces opfører sig ens. Det er
 * §7.5's eksplicitte form/grid-paritetskrav, som en unit-test pr. konstruktion ikke kan bære.
 *
 * **Paritetslisten er ÉN funktion pr. handling, kørt for begge surfaces.** To lister, der tilfældigvis
 * hævdede det samme, ville kunne drifte fra hinanden — hvilket er præcis, hvordan dækningen så ud, da
 * fundet blev skrevet.
 */
import * as React from 'react';
import { render, act, cleanup } from '@testing-library/react';
import { __createSlimInputTestStore } from '../../../inputCore/runtime/slimInputStore';
import {
  dispatchInput,
  ActiveEditorRegistry,
  CriticalActionCoordinator,
  type SlimInputStore,
  type CriticalAction,
} from '../../../inputCore/runtime';
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
  replaceCase,
  createEmptySettledInput,
  serializeFieldAddress,
  createEvaluationSourceToken,
  type InputCatalog,
  type FieldRef,
} from '../../../inputCore';
import {
  createTestCatalog,
  aargangField,
  belobField,
  makeRow,
  rentekravRowsRef,
  testRowOrigin,
  testLocation,
} from '../testCatalog';

let catalog: InputCatalog;
let store: SlimInputStore;
let registry: ActiveEditorRegistry;
let coordinator: CriticalActionCoordinator;

beforeEach(() => {
  sessionStorage.clear();
  catalog = createTestCatalog();
  store = __createSlimInputTestStore();
  registry = new ActiveEditorRegistry();
  coordinator = new CriticalActionCoordinator(store, registry);
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

const ROW = 'parity_row';

const makeBinding = (): InputRuntimeBinding =>
  createInputRuntimeBinding(store, catalog, registry, () => {
    const state = store.getState();
    return createInputEvaluation({
      input: state.input,
      catalog,
      sourceToken: createEvaluationSourceToken(state.revision, state.settingsRevision),
    });
  });

const canonical = <T,>(field: FieldRef<T>): T =>
  createValidationReader(store.getState().input, catalog).readCanonical(field);

const rejectedRaw = <T,>(field: FieldRef<T>): string | undefined =>
  store.getState().input.rejectedInputs[serializeFieldAddress(field.address)]?.raw;

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// De to ÆGTE surfaces, monteret som produktionen monterer dem
// ─────────────────────────────────────────────────────────────────────────────────────────────────

type SurfaceKind = 'form' | 'grid';

type MountedSurface<T> = Readonly<{
  field: FieldRef<T>;
  controller: () => FieldEditorController<T>;
  unmount: () => void;
}>;

/**
 * Monterer en ægte editor gennem et RIGTIGT komponenttræ og provider — ikke en `renderHook`-attrap uden
 * DOM. Det er den kæde, fundet påpegede som utestet: registrering + livscyklus + settle gennem
 * coordinatoren.
 */
const mountSurface = <T,>(kind: SurfaceKind, field: FieldRef<T>): MountedSurface<T> => {
  let controller: FieldEditorController<T> | null = null;

  const FormProbe = (): React.ReactElement => {
    controller = useFieldEditor(field, testLocation(`parity:form:${field.descriptor.id}`));
    return <input data-testid="editor" value={controller.displayText} readOnly />;
  };
  const GridProbe = (): React.ReactElement => {
    controller = useCellEditor({
      kind: 'existing',
      field,
      location: testLocation(`parity:grid:${field.descriptor.id}`),
    });
    return <input data-testid="editor" value={controller.displayText} readOnly />;
  };

  const Probe = kind === 'form' ? FormProbe : GridProbe;
  const view = render(
    <InputRuntimeProvider binding={makeBinding()}><Probe /></InputRuntimeProvider>
  );
  return {
    field,
    controller: () => {
      if (controller === null) throw new Error('Testinvariant: editoren blev ikke monteret');
      return controller;
    },
    unmount: () => view.unmount(),
  };
};

const seedRow = (): void => {
  dispatchInput(store, catalog, insertRow(rentekravRowsRef(), makeRow(ROW)), { origin: testRowOrigin() });
};

/** Feltet hver surface redigerer. Samme codecfamilie (amount), så forskellen ER adapteren. */
const fieldFor = (kind: SurfaceKind): FieldRef<unknown> =>
  (kind === 'form' ? aargangField.bind() : belobField.bind(ROW)) as FieldRef<unknown>;

/** En gyldig og en ugyldig råtekst pr. surface — hver families egen form. */
const rawFor = (kind: SurfaceKind) => kind === 'form'
  ? { valid: '2024', invalid: 'abc' }
  : { valid: '1000', invalid: 'abc' };

const SURFACES: readonly SurfaceKind[] = ['form', 'grid'];

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// §7.5's handlinger — samme assertions for begge surfaces
// ─────────────────────────────────────────────────────────────────────────────────────────────────

describe('§7.5 kritiske handlinger — ægte form- OG grid-editor, samme kontrakt', () => {
  describe.each(SURFACES)('surface: %s', (surface) => {
    const raw = () => rawFor(surface);

    it('registrerer den ÆGTE editor i registret, mens den er åben, og afmelder ved luk', () => {
      seedRow();
      const mounted = mountSurface(surface, fieldFor(surface));
      // Lukket: ingen editor "redigerer".
      expect(registry.getEditing()).toBeNull();

      act(() => mounted.controller().open());
      act(() => mounted.controller().changeDraft(raw().valid));
      // Dette er kernen: en VIRKELIG adapter, ikke et syntetisk `ActiveEditor`-objekt.
      expect(registry.getEditing(), `${surface}: den ægte editor registrerede sig ikke`).not.toBeNull();

      act(() => mounted.controller().settle());
      expect(registry.getEditing()).toBeNull();
    });

    it('save settler den åbne draft og ser den nye værdi (ikke den gamle)', async () => {
      seedRow();
      const field = fieldFor(surface);
      const mounted = mountSurface(surface, field);

      act(() => mounted.controller().open());
      act(() => mounted.controller().changeDraft(raw().valid));
      // Draften er endnu ikke afsluttet (§1.2).
      expect(canonical(field)).toBeUndefined();

      let result!: Awaited<ReturnType<typeof coordinator.prepare>>;
      await act(async () => { result = await coordinator.prepare('save'); });

      expect(result.status).toBe('committed');
      // Værdien LANDEDE — den syntetiske coordinator-test kan ikke vise dette, fordi dens editor kun
      // registrerer, at `settle()` blev kaldt.
      expect(canonical(field)).not.toBeUndefined();
      expect(mounted.controller().isOpen).toBe(false);
      // Og tokenet er FRISKT: det hører til revisionen EFTER settle (§3.4/§7.5).
      if (result.status !== 'committed') return;
      expect(result.token.inputRevision).toBe(store.getState().revision);
    });

    it('download settler ligesom save — samme editorbehandling for begge handlinger', async () => {
      seedRow();
      const field = fieldFor(surface);
      const mounted = mountSurface(surface, field);
      act(() => mounted.controller().open());
      act(() => mounted.controller().changeDraft(raw().valid));

      await act(async () => { await coordinator.prepare('download'); });

      expect(canonical(field)).not.toBeUndefined();
      expect(mounted.controller().isOpen).toBe(false);
    });

    it('navigation settler den åbne editor og fortsætter — også når settlet FEJLER', async () => {
      seedRow();
      const field = fieldFor(surface);
      const mounted = mountSurface(surface, field);

      act(() => mounted.controller().open());
      act(() => mounted.controller().changeDraft(raw().invalid));

      let result!: Awaited<ReturnType<typeof coordinator.prepare>>;
      await act(async () => { result = await coordinator.prepare('navigate'); });

      // §1.4: navigationen gennemføres, OG fejlen bliver synlig som rejected råtekst (§1.5). En
      // blokeret navigation ville fange brugeren på siden med sin egen tastefejl.
      expect(result.status).toBe('committed');
      expect(rejectedRaw(field)).toBe(raw().invalid);
      expect(mounted.controller().isOpen).toBe(false);
    });

    it('undo/redo er no-op, mens den ÆGTE editor er åben — draften bevares urørt', async () => {
      seedRow();
      const field = fieldFor(surface);
      dispatchInput(store, catalog, settleField(field, raw().valid));
      const revisionBefore = store.getState().revision;
      const mounted = mountSurface(surface, field);

      act(() => mounted.controller().open());
      act(() => mounted.controller().changeDraft(raw().invalid));

      for (const action of ['undo', 'redo'] as const satisfies readonly CriticalAction[]) {
        let result!: Awaited<ReturnType<typeof coordinator.prepare>>;
        await act(async () => { result = await coordinator.prepare(action); });
        expect(result.status, `${surface}/${action}: nåede history med åben editor`).toBe('noop');
      }

      // Ingen ny revision, og draften står stadig åben med sin uafsluttede tekst.
      expect(store.getState().revision).toBe(revisionBefore);
      expect(mounted.controller().isOpen).toBe(true);
      expect(mounted.controller().displayText).toBe(raw().invalid);
      expect(canonical(field)).not.toBeUndefined();
    });

    it('load kasserer draften ved succes og bevarer den ved fejl — uden at settle den', async () => {
      seedRow();
      const field = fieldFor(surface);
      const mounted = mountSurface(surface, field);

      // (1) FEJLENDE apply: draften BEVARES, intet settles.
      act(() => mounted.controller().open());
      act(() => mounted.controller().changeDraft(raw().valid));
      await act(async () => {
        await coordinator.prepare('load');
        // `applyReplacement` er async: en fejlende apply bliver en AFVIST promise, ikke et synkront kast.
        await expect(coordinator.applyReplacement(() => {
          throw new Error('load fejlede');
        })).rejects.toThrow('load fejlede');
      });
      expect(mounted.controller().isOpen, `${surface}: draften blev kasseret ved en FEJLENDE load`).toBe(true);
      // Og INTET blev settlet — det er `load`s hele forskel fra save/navigate (§1.4).
      expect(canonical(field)).toBeUndefined();

      // (2) VELLYKKET apply: draften kasseres.
      await act(async () => {
        await coordinator.prepare('load');
        await coordinator.applyReplacement(() => {
          dispatchInput(store, catalog, replaceCase(createEmptySettledInput()));
          return undefined;
        });
      });
      expect(mounted.controller().isOpen, `${surface}: draften overlevede en vellykket load`).toBe(false);
      // Stadig ikke settlet: den nye sag er tom, og draftens tekst nåede aldrig aggregaten.
      expect(store.getState().input).toEqual(createEmptySettledInput());
    });

    it('ingen af handlingerne efterlader en registreret editor efter unmount', async () => {
      seedRow();
      const mounted = mountSurface(surface, fieldFor(surface));
      act(() => mounted.controller().open());
      act(() => mounted.controller().changeDraft(raw().valid));
      expect(registry.getEditing()).not.toBeNull();

      act(() => mounted.unmount());

      // En efterladt registrering ville gøre ENHVER senere kritisk handling til en no-op eller få den
      // til at settle en editor, der ikke findes — begge er tabt arbejde for brugeren.
      expect(registry.getEditing()).toBeNull();
      const result = await coordinator.prepare('save');
      expect(result.status).toBe('committed');
    });
  });

  /**
   * Selve PARITETEN: de to surfaces skal give SAMME udfaldsstatus for hver handling. De handlingsvise
   * tests ovenfor kører hver for sig og kunne begge være grønne på hver sin forkerte måde.
   */
  it('form og grid giver identisk udfaldsstatus for hver af de syv kritiske handlinger', async () => {
    const ACTIONS: readonly CriticalAction[] = ['save', 'download', 'navigate', 'reload', 'load', 'undo', 'redo'];
    const outcomes: Record<SurfaceKind, string[]> = { form: [], grid: [] };

    for (const surface of SURFACES) {
      for (const action of ACTIONS) {
        // Frisk runtime pr. (surface, handling), så én handling ikke arver en anden tilstand.
        cleanup();
        sessionStorage.clear();
        catalog = createTestCatalog();
        store = __createSlimInputTestStore();
        registry = new ActiveEditorRegistry();
        coordinator = new CriticalActionCoordinator(store, registry);
        seedRow();

        const field = fieldFor(surface);
        const mounted = mountSurface(surface, field);
        act(() => mounted.controller().open());
        act(() => mounted.controller().changeDraft(rawFor(surface).valid));

        let result!: Awaited<ReturnType<typeof coordinator.prepare>>;
        await act(async () => { result = await coordinator.prepare(action); });
        outcomes[surface].push(`${action}:${result.status}:draftOpen=${mounted.controller().isOpen}`);
      }
    }

    expect(outcomes.grid).toEqual(outcomes.form);
    // Og listen er ikke tom af tomhed: syv handlinger, og mindst to forskellige udfald.
    expect(outcomes.form).toHaveLength(7);
    expect(new Set(outcomes.form.map((entry) => entry.split(':')[1])).size).toBeGreaterThan(1);
  });
});

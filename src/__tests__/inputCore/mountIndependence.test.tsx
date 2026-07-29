// @vitest-environment jsdom
/**
 * §10-kriterium 22 som en DIREKTE måling: *issues, beregninger og gates afhænger ikke af component mount.*
 *
 * **Hvorfor kriteriet manglede en kilde (R8-F01, etape 10).** Den gamle 15-punkts acceptmatrix havde ingen
 * post for mount-uafhængigheden, og de tests, der kunne have båret den, målte hver især noget andet:
 * arkitekturharnesset beviser, at ingen komponent SKRIVER ind i issue-snapshottet, og de enkelte
 * surface-tests beviser, at et lukket felt ikke holder en lokal kopi. Ingen af dem sammenligner det
 * FAKTISKE udfald med og uden et komponenttræ — og det er præcis den påstand, kriteriet gør.
 *
 * **Hvad testen gør.** Den bygger ét afsluttet input gennem den ægte runtime og evaluerer derefter tre
 * lag — feltissues, en domæneprojektion og en dokumentgate — på to måder:
 *
 *   1. HELT uden React: ingen `render`, intet provider-træ, ingen hook.
 *   2. Med et monteret komponenttræ, der aktivt LÆSER de samme felter gennem den ægte inputbinding.
 *
 * De to udfald skal være identiske, og de skal FORBLIVE identiske efter en unmount. Det er stærkere end
 * "ingen komponent skriver": en komponent kunne læse gennem en vej, der cachede, memoiserede eller
 * seedede noget ved mount, og først den sammenligning ville fange det.
 *
 * **Mount-benet bruger produktionens egne hooks** (`useFormFieldSurface`), ikke en attrap: en attrap, der
 * blot renderede en `<div>`, ville ikke røre nogen af de veje, kriteriet handler om.
 */
import * as React from 'react';
import { render, cleanup, act } from '@testing-library/react';
import { __createSlimInputTestStore } from '../../inputCore/runtime/slimInputStore';
import { dispatchInput, ActiveEditorRegistry, type SlimInputStore } from '../../inputCore/runtime';
import {
  createInputRuntimeBinding,
  InputRuntimeProvider,
  useFormFieldSurface,
  type InputRuntimeBinding,
} from '../../inputCore/react';
import { createInputEvaluation } from '../../inputCore/inputReader';
import {
  settleField,
  insertRow,
  serializeFieldAddress,
  createEvaluationSourceToken,
  runProjection,
  mapReadyProjection,
  type InputCatalog,
  type SettledInput,
} from '../../inputCore';
import { projectEoSave } from '../../persistence/eoSaveProjection';
import {
  createTestCatalog,
  aargangField,
  beregningsdatoField,
  belobField,
  tillaegstidField,
  makeRow,
  rentekravRowsRef,
  testRowOrigin,
  testLocation,
} from './testCatalog';

let catalog: InputCatalog;
let store: SlimInputStore;
let registry: ActiveEditorRegistry;

beforeEach(() => {
  sessionStorage.clear();
  catalog = createTestCatalog();
  store = __createSlimInputTestStore();
  registry = new ActiveEditorRegistry();
});

afterEach(() => {
  cleanup();
  sessionStorage.clear();
});

const ROW = 'mount_row';

/**
 * De tre lag, kriteriet nævner, som ÉT observerbart udfald.
 *
 * Beregningen måles både på sit RESULTAT og på antallet af MOTORKALD: et mount, der udløste en ekstra
 * evaluering, ville give samme tal men et andet kaldstal, og kun det andet ville afsløre det.
 */
type Observation = Readonly<{
  issues: readonly string[];
  projectionStatus: 'ready' | 'blocked';
  projectionValue: unknown;
  engineCalls: number;
  documentGate: 'ready' | 'blocked';
  eoSaveGate: 'ready' | 'blocked';
}>;

const observe = (input: SettledInput): Observation => {
  const evaluation = createInputEvaluation({
    input,
    catalog,
    sourceToken: createEvaluationSourceToken(
      store.getState().revision,
      store.getState().settingsRevision
    ),
  });

  let engineCalls = 0;
  const projection = mapReadyProjection(
    runProjection(evaluation.reader, 'mount-uafhaengig-beregning', (collector) => {
      const aargang = collector.require(aargangField.bind());
      const dato = collector.require(beregningsdatoField.bind());
      if (aargang.status !== 'usable' || dato.status !== 'usable') return undefined;
      return { aargang: aargang.value, dato: dato.value };
    }),
    (value) => {
      engineCalls += 1;
      return value.aargang * 2;
    }
  );

  const documentGate = runProjection(evaluation.reader, 'mount-uafhaengig-dokumentgate', (collector) => {
    const belob = collector.require(belobField.bind(ROW));
    return belob.status === 'usable' ? 'ok' as const : undefined;
  });

  return {
    // Sorteret: issue-REKKEFØLGEN er deterministisk af §1.8, men observationen skal måle MÆNGDEN,
    // ikke rækkefølgen, så en ordensforskel ikke maskerer sig som en indholdsforskel.
    issues: [...evaluation.issues.all]
      .map((issue) => `${serializeFieldAddress(issue.field.address)}:${issue.reason}`)
      .sort(),
    projectionStatus: projection.status,
    projectionValue: projection.status === 'ready' ? projection.value : undefined,
    engineCalls,
    documentGate: documentGate.status === 'ready' ? 'ready' : 'blocked',
    eoSaveGate: projectEoSave(input, catalog).status === 'ready' ? 'ready' : 'blocked',
  };
};

const makeBinding = (): InputRuntimeBinding =>
  createInputRuntimeBinding(store, catalog, registry, () => {
    const state = store.getState();
    return createInputEvaluation({
      input: state.input,
      catalog,
      sourceToken: createEvaluationSourceToken(state.revision, state.settingsRevision),
    });
  }, () => {
    const state = store.getState();
    return createInputEvaluation({
      input: state.input,
      catalog,
      sourceToken: createEvaluationSourceToken(state.revision, state.settingsRevision),
    }).issues;
  });

/**
 * En side, der LÆSER de samme felter gennem produktionens egen feltflade. Den skriver intet — pointen er
 * netop, at en ren LÆSER heller ikke må flytte noget.
 */
const ReadingPage = (): React.ReactElement => {
  const aargang = useFormFieldSurface(aargangField.bind(), testLocation('mount:aargang'));
  const dato = useFormFieldSurface(beregningsdatoField.bind(), testLocation('mount:dato'));
  const belob = useFormFieldSurface(belobField.bind(ROW), testLocation('mount:belob'));
  const tillaegstid = useFormFieldSurface(tillaegstidField.bind(ROW), testLocation('mount:tillaegstid'));
  return (
    <div>
      <span data-testid="aargang">{aargang.displayText}</span>
      <span data-testid="aargang-issue">{aargang.issue?.reason ?? ''}</span>
      <span data-testid="dato">{dato.displayText}</span>
      <span data-testid="belob">{belob.displayText}</span>
      <span data-testid="tillaegstid-issue">{tillaegstid.issue?.reason ?? ''}</span>
    </div>
  );
};

const mountPage = () => render(
  <InputRuntimeProvider binding={makeBinding()}><ReadingPage /></InputRuntimeProvider>
);

/** En sag med ét gyldigt felt, ét bounds-fejlende felt og ét rejected felt — alle tre issue-arter. */
const buildMixedCase = (): SettledInput => {
  dispatchInput(store, catalog, insertRow(rentekravRowsRef(), makeRow(ROW)), { origin: testRowOrigin() });
  dispatchInput(store, catalog, settleField(aargangField.bind(), '2024'));
  // Bounds: canonical bevaret, rødt issue (§1.6).
  dispatchInput(store, catalog, settleField(beregningsdatoField.bind(), '01-01-1999'));
  // Rejected råtekst: canonical ryddet, blokerer `.eo`.
  dispatchInput(store, catalog, settleField(tillaegstidField.bind(ROW), 'abc'));
  dispatchInput(store, catalog, settleField(belobField.bind(ROW), '1000'));
  return store.getState().input;
};

describe('§10-kriterium 22 — issues, beregninger og gates afhænger ikke af component mount', () => {
  it('issues, projektion og dokumentgate er identiske med og uden et monteret komponenttræ', () => {
    const input = buildMixedCase();

    // (1) HELT uden React.
    const headless = observe(input);

    // Fixturens forudsætning: der ER noget at måle. Uden dette ben kunne testen sammenligne to tomme
    // observationer og bestå uden at have set nogen af de tre lag.
    expect(headless.issues.length, 'fixturen har ingen issues at sammenligne').toBeGreaterThanOrEqual(2);
    expect(headless.projectionStatus).toBe('blocked'); // bounds-fejlen blokerer beregningen
    expect(headless.eoSaveGate).toBe('blocked'); // rejected råtekst blokerer .eo
    expect(headless.documentGate).toBe('ready'); // beløbet er gyldigt — ingen overblokering

    // (2) Med et monteret træ, der aktivt læser de samme felter.
    const view = mountPage();
    expect(view.getByTestId('aargang').textContent).toBe('2024');
    expect(view.getByTestId('tillaegstid-issue').textContent).toBe('format');
    const mounted = observe(store.getState().input);

    expect(mounted).toEqual(headless);
  });

  it('unmount af siden ændrer intet issue, ingen projektion og ingen dokumentgate', () => {
    const input = buildMixedCase();
    const view = mountPage();
    const whileMounted = observe(store.getState().input);
    // Forudsætning: træet var faktisk monteret og læste feltet.
    expect(view.getByTestId('dato').textContent).toBe('01-01-1999');

    view.unmount();

    const afterUnmount = observe(store.getState().input);
    expect(afterUnmount).toEqual(whileMounted);
    // Og input-aggregaten selv er uberørt af begge livscyklusser.
    expect(store.getState().input).toEqual(input);
  });

  it('et REMOUNT giver samme udfald — der seedes intet ved mount', () => {
    buildMixedCase();
    const first = observe(store.getState().input);
    const revisionBefore = store.getState().revision;

    for (let round = 0; round < 3; round += 1) {
      const view = mountPage();
      view.unmount();
    }

    // Tre mount/unmount-cyklusser: ingen ny revision, intet write, samme observation.
    expect(store.getState().revision).toBe(revisionBefore);
    expect(observe(store.getState().input)).toEqual(first);
  });

  /**
   * **Den anden retning af kriteriet, og den svære.** Testene ovenfor beviser, at et MOUNT ikke flytter
   * noget. Denne beviser det omvendte: at det monterede træ VISER den aktuelle sandhed frem for en
   * tilstand, det fangede da det monterede.
   *
   * Sondringen er ikke akademisk. Første udgave af denne suite havde kun mount→evaluering-retningen, og
   * en mutation, der gjorde bindingens issue-cache STICKY (returnér altid det første snapshot), forblev
   * GRØN: en stale cache flytter ikke den headless evaluering, den ændrer kun hvad DOM viser. Et felt
   * ville da bære en rød markering, brugeren havde rettet — mount-afhængighed i den retning kriteriet
   * også dækker. Testen sammenligner derfor DOM mod den headless sandhed EFTER en revisionsændring.
   */
  it('det monterede træ viser den AKTUELLE sandhed, ikke den det fangede ved mount', () => {
    buildMixedCase();
    const view = mountPage();
    // Udgangspunkt: bounds-fejlen er synlig i DOM, og datoen er den fejlende.
    expect(view.getByTestId('dato').textContent).toBe('01-01-1999');
    expect(view.getByTestId('aargang-issue').textContent).toBe('');

    // Ret datoen OG indfør en ny fejl på et andet felt, mens træet er monteret.
    act(() => {
      dispatchInput(store, catalog, settleField(beregningsdatoField.bind(), '01-01-2020'));
    });
    act(() => {
      dispatchInput(store, catalog, settleField(aargangField.bind(), '1800'));
    });

    const headless = observe(store.getState().input);
    // DOM skal vise den NYE dato …
    expect(view.getByTestId('dato').textContent).toBe('01-01-2020');
    // … og det NYE issue, som ikke fandtes ved mount. En sticky issue-cache fejler netop her.
    expect(view.getByTestId('aargang-issue').textContent).toBe('bounds');
    // Og DOM's issue-billede skal stemme med den headless sandhed, felt for felt.
    expect(headless.issues).toContain('{"section":"satser","path":[],"field":"aargang"}:bounds');
    expect(headless.issues).not.toContain(
      '{"section":"renteberegning","path":[],"field":"beregningsdato"}:bounds'
    );
  });

  /**
   * Modsat retning: observationen skal kunne SE en forskel. Et prædikat, der gav samme resultat for to
   * forskellige inputs, ville bestå de tre tests ovenfor uden at måle noget (jf. Fase 6's `verifyAbsent`).
   */
  it('observationen er ikke vakuøs: et ændret input giver et ANDET udfald', () => {
    buildMixedCase();
    const before = observe(store.getState().input);

    // Ret bounds-fejlen: beregningen skal nu være ready, og issue-mængden mindre.
    dispatchInput(store, catalog, settleField(beregningsdatoField.bind(), '01-01-2020'));
    const after = observe(store.getState().input);

    expect(after).not.toEqual(before);
    expect(after.issues.length).toBeLessThan(before.issues.length);
    expect(after.projectionStatus).toBe('ready');
    expect(after.engineCalls).toBe(1);
    // `.eo` er stadig blokeret: den rejected råtekst står uændret. Uden dette ben kunne testen have
    // læst forskellen som "alt blev godt" frem for "netop dét felt blev rettet".
    expect(after.eoSaveGate).toBe('blocked');
  });
});

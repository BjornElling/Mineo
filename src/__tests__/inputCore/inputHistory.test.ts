import {
  createInputHistory,
  pushInputHistory,
  undoInputHistory,
  redoInputHistory,
  type HistoryOrigin,
  type CollectionHistoryOrigin,
  type FieldHistoryOrigin,
} from '../../inputCore/inputHistory';
import { createEmptySettledInput, type SettledInput } from '../../inputCore';
import { createFieldAddress, type FieldAddress } from '../../inputCore/fieldAddress';

// History bevarer struktur-origin (§3.7) symmetrisk gennem undo → redo, så undo/redo-restoren kan
// navigere til den rette route/fane og fokusere feltet, ændringen kom fra. Ren datastruktur-test uden runtime.

const address: FieldAddress = { section: 'satser', path: [], field: 'aargang' };

const origin: HistoryOrigin = {
  kind: 'field' as const,
  field: address,
  editorLocationId: 'satser:aargang',
  route: '/satser',
  tabKey: null,
};

// To distinkte afsluttede input-værdier at bevæge historyen imellem (indholdet er irrelevant for origin-bevaring).
const inputA: SettledInput = createEmptySettledInput();
const inputB: SettledInput = createEmptySettledInput();

describe('inputHistory — origin-bevaring (§3.7)', () => {
  it('bevarer originen symmetrisk gennem undo → redo', () => {
    // Push et før-snapshot (inputA) MED origin; current er nu inputB.
    const history = pushInputHistory(createInputHistory(), inputA, origin);

    const undo = undoInputHistory(history, inputB);
    expect(undo.changed).toBe(true);
    if (!undo.changed) throw new Error('undo skulle ændre');
    // Undo-target bærer originen (så shellen kan navigere til origin-lokationen).
    expect(undo.target.origin).toEqual(origin);
    // Det gemte current-frame i future bærer SAMME origin, så en efterfølgende redo lander samme sted.
    expect(undo.history.future[0]?.origin).toEqual(origin);

    const redo = redoInputHistory(undo.history, inputA);
    expect(redo.changed).toBe(true);
    if (!redo.changed) throw new Error('redo skulle ændre');
    expect(redo.target.origin).toEqual(origin);
  });

  it('et frame uden origin bevarer fraværet af origin gennem undo → redo', () => {
    const history = pushInputHistory(createInputHistory(), inputA);

    const undo = undoInputHistory(history, inputB);
    if (!undo.changed) throw new Error('undo skulle ændre');
    expect(undo.target.origin).toBeUndefined();
    expect(undo.history.future[0]?.origin).toBeUndefined();

    const redo = redoInputHistory(undo.history, inputA);
    if (!redo.changed) throw new Error('redo skulle ændre');
    expect(redo.target.origin).toBeUndefined();
  });
});

// Destinationen skal være påkrævet i KERNETYPEN, ikke kun i surface-hookens `CollectionRowOrigin`.
// Ellers kan en direkte `dispatchInput`-kalder lave en rækkehandling uden et sted at navigere hen — og en
// rækkehandling har ingen feltadresse at falde tilbage på. Testen er compile-time: `@ts-expect-error` FEJLER,
// hvis typen igen bliver eftergivende, så en opblødning ikke kan slippe gennem en grøn suite.
describe('CollectionHistoryOrigin — destinationen er påkrævet i kernetypen (§3.7)', () => {
  it('accepterer et origin med fuld destination', () => {
    const origin: CollectionHistoryOrigin = {
      kind: 'collection',
      collection: 'oevrigeKravPerioder',
      editorLocationId: 'eo.oevrigeKrav:rows:oevrigeKravPerioder',
      route: '/erstatningsopgoerelse',
      tabKey: 'oplysninger',
    };
    expect(origin.route).toBe('/erstatningsopgoerelse');
  });

  it('afviser et origin uden route og uden tabKey (compile-time)', () => {
    // @ts-expect-error — `route` mangler: rækkehandlingen ville få en origin uden destination.
    const utenRoute: CollectionHistoryOrigin = {
      kind: 'collection',
      collection: 'oevrigeKravPerioder',
      editorLocationId: 'eo.oevrigeKrav:rows:oevrigeKravPerioder',
      tabKey: null,
    };

    // @ts-expect-error — `tabKey` mangler: udeladelse er ikke en lovlig måde at sige "ingen faner" på.
    const utenTabKey: CollectionHistoryOrigin = {
      kind: 'collection',
      collection: 'oevrigeKravPerioder',
      editorLocationId: 'eo.oevrigeKrav:rows:oevrigeKravPerioder',
      route: '/erstatningsopgoerelse',
    };

    expect(utenRoute.collection).toBe('oevrigeKravPerioder');
    expect(utenTabKey.collection).toBe('oevrigeKravPerioder');
  });
});

// Destinationen er ALT-eller-INTET. En `tabKey` uden `route` er lydløst
// inert, fordi restoren kun aktiverer fanen inde i `route !== undefined`-grenen (`MainLayout`). Typen gør den
// inkohærens urepræsenterbar, i stedet for at lade et runtime-værn fange den bagefter.
describe('FieldHistoryOrigin — destinationen er alt-eller-intet (§3.7)', () => {
  const renteAddress = createFieldAddress({ section: 'renteberegning', path: [], field: 'beregningsdato' });

  it('accepterer et anker HELT UDEN destination (standalone er ikke-navigerbar)', () => {
    const origin: FieldHistoryOrigin = {
      kind: 'field',
      field: renteAddress,
      editorLocationId: 'standalone:beregningsdato',
    };
    expect(origin.route).toBeUndefined();
  });

  it('accepterer et anker med FULD destination', () => {
    const origin: FieldHistoryOrigin = {
      kind: 'field',
      field: renteAddress,
      editorLocationId: 'renteberegning:beregningsdato',
      route: '/renteberegning',
      tabKey: null,
    };
    expect(origin.tabKey).toBeNull();
  });

  it('afviser en tabKey UDEN route (compile-time)', () => {
    // @ts-expect-error — `tabKey` uden `route`: fanen ville aldrig blive aktiveret af restoren.
    const kunTabKey: FieldHistoryOrigin = {
      kind: 'field',
      field: renteAddress,
      editorLocationId: 'renteberegning:beregningsdato',
      tabKey: 'calculation',
    };

    // @ts-expect-error — `route` uden `tabKey`: udeladelse er ikke en lovlig måde at sige "ingen faner" på.
    const kunRoute: FieldHistoryOrigin = {
      kind: 'field',
      field: renteAddress,
      editorLocationId: 'renteberegning:beregningsdato',
      route: '/renteberegning',
    };

    expect(kunTabKey.editorLocationId).toBe('renteberegning:beregningsdato');
    expect(kunRoute.editorLocationId).toBe('renteberegning:beregningsdato');
  });
});

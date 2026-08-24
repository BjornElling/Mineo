// @vitest-environment jsdom
import { __createSlimInputTestStore } from '../../../inputCore/runtime/slimInputStore';
import * as React from 'react';
import { render } from '@testing-library/react';
import { ActiveEditorRegistry, type SlimInputStore } from '../../../inputCore/runtime';
import { createInputRuntimeBinding, InputRuntimeProvider } from '../../../inputCore/react';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import { createEvaluationSourceToken, type InputCatalog } from '../../../inputCore';
import { createAutoPruningTestCatalog, rentekravRowsRef } from '../../inputCore/testCatalog';
import { useCollectionTable } from '../../../components/tables/useCollectionTable';
import { hydrateSlimInputStoreForTest } from '../../../test/actSafeInputStore';
import type { RentekravRow } from '../../../schemas/formSchemas';

/**
 * Render-modellens ENE konstruktion.
 *
 * De to ting, der hævdes her, er præcis dem der før lå spredt ud over kaldstederne, og som
 * ingen test dækkede på render-niveau:
 *
 *  - RÆKKEFØLGEN kommer fra `displayRows`, mens placeholder-IDENTITETEN kommer fra mængden af
 *    committede id'er. Blandede man de to, ville en sortering kunne flytte den tomme rækkes
 *    identitet, og en history-origin fra før sorteringen ville miste sit element (§1.11/§3.7).
 *  - HVOR MANGE tomme rækker der vises, afgøres af `minimumVisibleRows` og katalogets fælles
 *    tomhedsvurdering. Den læser både canonical og afvist input, så en række ikke forsvinder fra
 *    sletning eller sortering, blot fordi dens seneste tekst blev afvist.
 */

type Row = RentekravRow;

const row = (id: string, filled = false): Row => ({
  id,
  belob: filled ? { kind: 'number', value: 1_000 } : undefined,
  renterFra: undefined,
  tillaegstid: undefined,
  enhed: 'dage',
});

let catalog: InputCatalog;
let store: SlimInputStore;
let registry: ActiveEditorRegistry;

beforeEach(() => {
  catalog = createAutoPruningTestCatalog();
  store = __createSlimInputTestStore();
  registry = new ActiveEditorRegistry();
});

const makeBinding = () =>
  createInputRuntimeBinding(store, catalog, registry, () => {
    const state = store.getState();
    return createInputEvaluation({
      input: state.input,
      catalog,
      sourceToken: createEvaluationSourceToken(state.revision, state.settingsRevision),
    });
  });

/** Fast id-fabrik, så placeholder-id'erne er forudsigelige i assertions. */
const makeIdFactory = () => {
  let next = 0;
  return () => {
    next += 1;
    return `ph-${next}`;
  };
};

type HarnessProps = Readonly<{
  committedRows: readonly Row[];
  displayRows?: readonly Row[];
  minimumVisibleRows?: number;
  onModel: (rows: readonly Readonly<{ rowId: string; kind: string }>[]) => void;
}>;

const Harness = ({ committedRows, displayRows, minimumVisibleRows, onModel }: HarnessProps) => {
  const createRowId = React.useMemo(() => makeIdFactory(), []);
  const table = useCollectionTable<Row>({
    collection: rentekravRowsRef(),
    committedRows,
    createRowId,
    createEmptyRow: (id) => row(id),
    locationPrefix: 'renteberegning.rentekravRows',
    locationNav: { route: '/renteberegning', tabKey: null },
    ...(minimumVisibleRows === undefined ? {} : { minimumVisibleRows }),
  });
  onModel(table.buildRenderRows(displayRows));
  return null;
};

const renderModel = (props: Omit<HarnessProps, 'onModel'>): readonly Readonly<{ rowId: string; kind: string }>[] => {
  let captured: readonly Readonly<{ rowId: string; kind: string }>[] = [];
  hydrateSlimInputStoreForTest(store, catalog.validateSettledInput({
    sections: {
      stamdata: null, satser: null, aarsloen: null, faellesAarsloen: null,
      renteberegning: { beregningsdato: undefined, kommentarer: undefined, rentekravRows: [...props.committedRows] },
      varigemen: null, forsoergertab: null, erstatningsopgoerelse: null, erhvervsevnetab: null,
    },
    rejectedInputs: {},
  }));
  render(
    <InputRuntimeProvider binding={makeBinding()}>
      <Harness {...props} onModel={(rows) => { captured = rows; }} />
    </InputRuntimeProvider>
  );
  return captured;
};

describe('useCollectionTable.buildRenderRows', () => {
  it('viser rækkerne i `displayRows`-ordenen med placeholderen sidst', () => {
    const committedRows = [row('a', true), row('b', true), row('c', true)];
    const model = renderModel({ committedRows, displayRows: [row('c', true), row('a', true), row('b', true)] });

    expect(model.map((r) => r.rowId)).toEqual(['c', 'a', 'b', 'ph-1']);
    expect(model.map((r) => r.kind)).toEqual(['existing', 'existing', 'existing', 'placeholder']);
  });

  it('bruger de committede rækkers egen orden, når `displayRows` udelades', () => {
    const model = renderModel({ committedRows: [row('a', true), row('b', true)] });
    expect(model.map((r) => r.rowId)).toEqual(['a', 'b', 'ph-1']);
  });

  it('placeholder-identiteten følger MÆNGDEN, ikke den viste orden', () => {
    // Samme committede mængde vist i to forskellige ordener skal give SAMME placeholder-id.
    // Ellers ville en sortering flytte den tomme rækkes identitet, og en history-origin fra før
    // sorteringen ville ikke længere kunne finde sit element.
    const committedRows = [row('a', true), row('b', true)];
    const usorteret = renderModel({ committedRows });
    const sorteret = renderModel({ committedRows, displayRows: [row('b', true), row('a', true)] });

    expect(usorteret.at(-1)!.rowId).toBe(sorteret.at(-1)!.rowId);
  });

  it('viser flere tomme rækker op til `minimumVisibleRows` – alle sammen', () => {
    // Den tidligere reconciliation genfandt placeholderen med `.find` og tog kun den FØRSTE, så
    // en tabel med flere tomme rækker tabte resten tavst. Her skal alle tre komme med.
    const model = renderModel({ committedRows: [], minimumVisibleRows: 3 });

    expect(model.map((r) => r.rowId)).toEqual(['ph-1', 'ph-2', 'ph-3']);
    expect(model.every((r) => r.kind === 'placeholder')).toBe(true);
  });

  it('lægger stadig én tom række på, når de committede fylder `minimumVisibleRows`', () => {
    const model = renderModel({ committedRows: [row('a', true), row('b', true), row('c', true)], minimumVisibleRows: 2 });
    expect(model.map((r) => r.rowId)).toEqual(['a', 'b', 'c', 'ph-1']);
  });

  it('undlader placeholderen, når en committet række allerede ER den tomme indtastningsrække', () => {
    // Rentekrav-reglen: «kun enhed valgt» er stadig semantisk tomt, og den række fungerer selv
    // som trailing indtastningsrække. En placeholder oveni ville give to tomme rækker.
    const model = renderModel({
      committedRows: [row('a', true), row('b')],
    });

    expect(model.map((r) => r.rowId)).toEqual(['a', 'b']);
    expect(model.some((r) => r.kind === 'placeholder')).toBe(false);
  });

  it('lægger placeholderen på igen, så snart ingen committet række er tom', () => {
    const model = renderModel({
      committedRows: [row('a', true), row('b', true)],
    });

    expect(model.map((r) => r.rowId)).toEqual(['a', 'b', 'ph-1']);
  });

  it('den fælles tomhedsvurdering sænker kun BUNDEN – minimumVisibleRows gælder stadig', () => {
    // De to regler er uafhængige: den ene siger «mindst så mange rækker i alt», den anden «en
    // committet tom række tæller som indtastningsrækken». Slås de sammen ét sted, skal begge
    // stadig kunne ses hver for sig.
    const model = renderModel({
      committedRows: [row('a')],
      minimumVisibleRows: 3,
    });

    expect(model.map((r) => r.rowId)).toEqual(['a', 'ph-1', 'ph-2']);
  });
});

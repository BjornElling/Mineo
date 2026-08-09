// @vitest-environment jsdom
import { __hydrateSlimInputStoreForTest } from '../../../inputCore/runtime/slimInputStore';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Aarsloen from '../../../components/pages/Aarsloen';
import OffentligeYdelserTab from '../../../components/pages/erstatningsopgoerelse/OffentligeYdelserTab';
import { AppSettingsProvider } from '../../../contexts/AppSettingsContext';
import { RoutePathnameProvider } from '../../../contexts/RoutePathnameProvider';
import { slimInputStore } from '../../../inputCore/runtime/slimInputStore';
import { getProductionInputCatalog } from '../../../inputCore/catalog/productionCatalog';
import {
  ProductionInputRuntimeProvider,
  createProductionInputRuntimeBinding,
} from '../../../inputCore/react';
import { findRestoreTarget } from '../../../inputCore/react/historyRestoreTarget';
import { lookupEditorLocation } from '../../../inputCore/react/editorLocationDestination';
import { serializeFieldAddress } from '../../../inputCore/fieldAddress';
import { aarsloenOmregningTilFuldtAarField } from '../../../inputCore/catalog/aarsloenDescriptors';
import { eoMidlertidigtEetFraEetSidenField } from '../../../inputCore/catalog/erstatningsopgoerelseDescriptors';
import type { ErstatningsopgoerelseValues } from '../../../schemas/formSchemas';
import { createAarsloenInitialValues } from '../../../domain/aarsloen/aarsloenInitialValues';
import { createErstatningsopgoerelseInitialValues } from '../../../domain/erstatningsopgoerelse/helpers/erstatningsopgoerelseInitialValues';

// De to specialtoggles er persisterede felter gennem feltfamilien.
//
// DEN MANGLENDE EVIDENS. `useOmregningToggle.test.tsx` er en mock-baseret unittest af gate-politikken; den kan
// pr. konstruktion ikke se, om kontrollen bærer sin feltidentitet i DOM. Netop det var fundet: begge toggles
// committede korrekt, men undo/redo kunne ikke REFOKUSERE dem, fordi callsitet forbandt et rå
// `StyledToggleSwitch` manuelt og aldrig førte `restoreTargetAttributes` videre.
//
// Testen kører derfor gennem de ÆGTE sider og den ÆGTE produktions-runtime og hævder de to ting, en type ikke
// kan: at et faktisk klik skaber en history-origin med feltets adresse OG editorlokation, og at
// `findRestoreTarget` — den funktion, undo/redo selv bruger — kan finde kontrollen igen bagefter.
//
// Den tredje assertion (`lookupEditorLocation`) dækker destinationen fra samme vinkel: togglen skal også oplyse sin
// EGEN destination, ellers kan save-blokeringens fokus ikke sende brugeren til dens fane.

const catalog = getProductionInputCatalog();

const hydrate = (sections: Partial<Parameters<typeof catalog.validateSettledInput>[0]['sections']>): void => {
  const input = catalog.validateSettledInput({
    sections: {
      stamdata: null, satser: null, aarsloen: null, faellesAarsloen: null, renteberegning: null,
      varigemen: null, forsoergertab: null, erstatningsopgoerelse: null, erhvervsevnetab: null,
      ...sections,
    },
    rejectedInputs: {},
  });
  __hydrateSlimInputStoreForTest(slimInputStore, input);
};

const renderPage = (node: React.ReactNode, route: string) => render(
  <MemoryRouter initialEntries={[route]}>
    <AppSettingsProvider>
      <RoutePathnameProvider>
        <ProductionInputRuntimeProvider binding={createProductionInputRuntimeBinding()}>
          {node}
        </ProductionInputRuntimeProvider>
      </RoutePathnameProvider>
    </AppSettingsProvider>
  </MemoryRouter>
);

// jsdom implementerer ikke `scrollIntoView`. Gate-afvisningen guider brugeren til fejlcellen og scroller derfor;
// uden stubben bliver det en uncaught exception, som skjuler det, testen faktisk måler.
beforeEach(() => {
  Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', { configurable: true, value: vi.fn() });
});

/** Det seneste history-frames origin — det, en undo vil forsøge at restore fokus til. */
const latestOrigin = () => {
  const frames = slimInputStore.getState().history.past;
  return frames[frames.length - 1]?.origin;
};

describe('persisterede specialtoggles → klik → undo-fokusmål', () => {
  it('Årsløns GATEDE omregningstoggle bærer feltadresse + editorlokation, så undo kan refokusere den', () => {
    // Gaten skal TILLADE aktiveringen, ellers afvises committen (og der er intet at refokusere). En løntabel
    // med én fuldt udfyldt månedsperiode opfylder gatens krav om en gyldig periode uden fejlende celler.
    hydrate({
      aarsloen: {
        ...createAarsloenInitialValues(),
        loenperiode: 'maaned',
        omregningTilFuldtAar: false,
        // `col0_maaned` = måned, `col1_maaned` = ÅR, `col2` = beløb (jf. `standardLoenTableRowSchema`).
        tableData: [
          { id: 'row-1', col0_maaned: '1', col1_maaned: '2024', col2: { kind: 'number', value: 30000 } },
        ],
      } as never,
    });

    renderPage(<Aarsloen />, '/aarsloen');

    // Togglen har ingen aria-label (etiketten står som en søsterlinje i layoutet), så den vælges på sit
    // `name` — samme identitet, som DOM-attributterne hænger på.
    const toggle = document.querySelector<HTMLInputElement>('input[name="omregningTilFuldtAar"]');
    expect(toggle).not.toBeNull();
    if (toggle === null) return;

    // ET ÆGTE KLIK gennem kontrollen — ikke et direkte dispatch. Kun så måles callsitets binding.
    act(() => { fireEvent.click(toggle); });

    // Committen landede som brugerens ene handling.
    expect(slimInputStore.getState().input.sections.aarsloen?.omregningTilFuldtAar).toBe(true);

    // (1) Originen er et FELT-commit med feltets adresse OG editorlokation (§3.7).
    const origin = latestOrigin();
    expect(origin?.kind).toBe('field');
    if (origin?.kind !== 'field') return;
    expect(serializeFieldAddress(origin.field))
      .toBe(serializeFieldAddress(aarsloenOmregningTilFuldtAarField.bind().address));

    // (2) DET AFGØRENDE: undo/redo's egen opslagsfunktion finder kontrollen igen. Før rettelsen bar det rå
    //     `StyledToggleSwitch` ingen restore-attributter, og dette returnerede `null`.
    expect(findRestoreTarget(origin)).toBe(toggle);

    // (3) Togglen oplyser sin EGEN destination: Årsløn er en side uden faner.
    const lookup = lookupEditorLocation(serializeFieldAddress(origin.field));
    expect(lookup.kind).toBe('visible');
  });

  it('EO-togglens ATOMISKE flerfelts-transaktion bevarer også fokusmålet', () => {
    const eoValues = {
      ...createErstatningsopgoerelseInitialValues(),
      midlertidigtEetFraEetSiden: 'Nej',
      offentligeYdelserRows: [],
    } as unknown as ErstatningsopgoerelseValues;
    hydrate({ erstatningsopgoerelse: eoValues as never });

    renderPage(<OffentligeYdelserTab values={eoValues} />, '/erstatningsopgoerelse');

    const toggle = screen.getByRole('checkbox', {
      name: 'Midlertidigt EET indsættes fra Erhvervsevnetab-siden',
    });

    act(() => { fireEvent.click(toggle); });

    // Transaktionen skrev BEGGE felter — togglen og bilag-checkboxen — som ét trin.
    const sections = slimInputStore.getState().input.sections;
    expect(sections.erstatningsopgoerelse?.midlertidigtEetFraEetSiden).toBe('Ja');
    expect(sections.erstatningsopgoerelse?.eoBilagSelection?.midlertidigEet).toBe(true);

    // Ingen rækker blev slettet, så transaktionen er REN felt-baseret; originen må derfor ikke foregøgle en
    // rækkehandling. Fokusmålet er togglen selv.
    const origin = latestOrigin();
    expect(origin?.kind).toBe('field');
    if (origin?.kind !== 'field') return;
    expect(serializeFieldAddress(origin.field))
      .toBe(serializeFieldAddress(eoMidlertidigtEetFraEetSidenField.bind().address));
    expect(findRestoreTarget(origin)).toBe(toggle);

    // Og den oplyser sin fane, så save-blokeringens fokus kan finde den.
    const lookup = lookupEditorLocation(serializeFieldAddress(origin.field));
    expect(lookup.kind).toBe('visible');
    expect(toggle).toHaveAttribute('data-mineo-editor-tab', 'offentlige_ydelser');
  });

  it('en gate-AFVIST aktivering skriver ikke og efterlader intet history-trin', () => {
    // Tom løntabel → gaten kan ikke aktivere. Adapterens `commit`-override returnerer `'reject'`, og
    // skrivningen sker derfor ikke. Dét er forskellen på den nye kontrakt og en boolsk override, som kun
    // kunne sige "jeg klarede det selv".
    hydrate({
      aarsloen: {
        ...createAarsloenInitialValues(),
        loenperiode: 'maaned',
        omregningTilFuldtAar: false,
        tableData: [],
      } as never,
    });

    renderPage(<Aarsloen />, '/aarsloen');
    const framesBefore = slimInputStore.getState().history.past.length;

    const toggle = document.querySelector<HTMLInputElement>('input[name="omregningTilFuldtAar"]')!;
    act(() => { fireEvent.click(toggle); });

    expect(slimInputStore.getState().input.sections.aarsloen?.omregningTilFuldtAar).toBe(false);
    expect(slimInputStore.getState().history.past.length).toBe(framesBefore);
  });
});

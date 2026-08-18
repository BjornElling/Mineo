// @vitest-environment jsdom
import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PageTabs from '../../../components/layout/PageTabs';
import SideTab from '../../../components/layout/SideTab';
import { __createSlimInputTestStore } from '../../../inputCore/runtime/slimInputStore';
import { ActiveEditorRegistry, type SlimInputStore } from '../../../inputCore/runtime';
import {
  createInputRuntimeBinding,
  InputRuntimeProvider,
  type InputRuntimeBinding,
} from '../../../inputCore/react';
import { createInputEvaluation } from '../../../inputCore/inputReader';
import { createEvaluationSourceToken, type InputCatalog } from '../../../inputCore';
import { createTestCatalog } from '../../inputCore/testCatalog';

type Key = 'a' | 'b' | 'c';

const ITEMS = [
  { key: 'a' as const, label: 'Fane A' },
  { key: 'b' as const, label: 'Fane B' },
  { key: 'c' as const, label: 'Fane C' },
];

let catalog: InputCatalog;
let store: SlimInputStore;
let registry: ActiveEditorRegistry;

beforeEach(() => {
  catalog = createTestCatalog();
  store = __createSlimInputTestStore();
  registry = new ActiveEditorRegistry();
});

const makeBinding = (): InputRuntimeBinding =>
  createInputRuntimeBinding(store, catalog, registry, () => {
    const state = store.getState();
    return createInputEvaluation({
      input: state.input,
      catalog,
      sourceToken: createEvaluationSourceToken(state.revision, state.settingsRevision),
    });
  });

/**
 * Fanerne er en kritisk-handlings-flade: et faneskift settler den åbne editor gennem
 * `CriticalActionCoordinator`, præcis som sidenavigation gør. Komponenten kræver derfor et
 * input-runtime omkring sig — den kan ikke længere renderes som ren præsentation.
 */
const renderTabs = (props: Partial<React.ComponentProps<typeof PageTabs<Key>>> = {}) => render(
  <InputRuntimeProvider binding={makeBinding()}>
    <PageTabs<Key>
      items={ITEMS}
      value={props.value ?? 'a'}
      onChange={props.onChange ?? vi.fn()}
    />
  </InputRuntimeProvider>
);

describe('PageTabs', () => {
  it('rendere en fane pr. item med den delte tab-item-klasse', () => {
    renderTabs();
    for (const item of ITEMS) {
      const tab = screen.getByRole('tab', { name: item.label });
      expect(tab.classList.contains('tab-item')).toBe(true);
      expect(tab).toHaveAttribute('data-mineo-tab-navigation', 'true');
    }
  });

  it('kan navigere mellem faner med piletaster og aktivere den fokuserede fane med Enter', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    renderTabs({ onChange });

    const firstTab = screen.getByRole('tab', { name: 'Fane A' });
    const secondTab = screen.getByRole('tab', { name: 'Fane B' });
    act(() => firstTab.focus());

    await user.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(secondTab);

    await user.keyboard('{Enter}');
    await waitFor(() => { expect(onChange).toHaveBeenCalledWith('b'); });
  });

  it('kalder onChange med den valgte fane-nøgle', async () => {
    const onChange = vi.fn();
    renderTabs({ onChange });
    fireEvent.click(screen.getByRole('tab', { name: 'Fane B' }));
    // Skiftet går nu gennem den asynkrone settle-barriere, så svaret kommer først på en senere tick.
    await waitFor(() => { expect(onChange).toHaveBeenCalledWith('b'); });
  });

  it('markerer den aktive fane som selected', () => {
    renderTabs({ value: 'c' });
    expect(screen.getByRole('tab', { name: 'Fane C' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Fane A' })).toHaveAttribute('aria-selected', 'false');
  });

  it('markerer ingen fane når value er false (side-fane aktiv)', () => {
    renderTabs({ value: false });
    for (const item of ITEMS) {
      expect(screen.getByRole('tab', { name: item.label })).toHaveAttribute('aria-selected', 'false');
    }
  });

  it('settler den ÅBNE editor FØR faneskiftet — ikke som en bivirkning af museklikket', async () => {
    // Kernen i fundet: skiftet byggede på, at musen forlod feltet først, så blur'en committede det
    // indtastede. Skiftet gjorde intet selv.
    //
    // Testen registrerer en RIGTIG editor i det registry, coordinatoren bruger — ikke en mock af
    // coordinatoren. Den måler dermed den faktiske settle-vej og ikke, at komponenten kaldte en
    // funktion, vi selv havde stillet frem.
    const order: string[] = [];
    const settle = vi.fn(() => { order.push('settle'); });
    registry.register({
      id: 'aabent-felt',
      isEditing: () => true,
      settle,
      discard: vi.fn(),
    });
    const onChange = vi.fn(() => { order.push('change'); });

    renderTabs({ onChange });
    fireEvent.click(screen.getByRole('tab', { name: 'Fane B' }));

    await waitFor(() => { expect(onChange).toHaveBeenCalledWith('b'); });
    expect(settle).toHaveBeenCalledTimes(1);
    // Rækkefølgen er hele pointen: et settle EFTER skiftet ville ikke redde indtastningen.
    expect(order).toEqual(['settle', 'change']);
  });

  it('skifter fane uden settle, når ingen editor er åben', async () => {
    // Modprøven, der gør testen ovenfor til andet end en tautologi: uden en åben editor må
    // barrieren ikke gøre noget, og skiftet skal stadig ske.
    const onChange = vi.fn();
    renderTabs({ onChange });
    fireEvent.click(screen.getByRole('tab', { name: 'Fane C' }));

    await waitFor(() => { expect(onChange).toHaveBeenCalledWith('c'); });
  });
});

describe('SideTab', () => {
  it('rendere label og står på indholdsboksens højrekant via top-prop', () => {
    render(<SideTab label="EO-kontrol" active={false} onClick={vi.fn()} top="125px" />);
    const el = screen.getByText('EO-kontrol');
    expect(el.classList.contains('side-tab')).toBe(true);
    expect(el.classList.contains('active')).toBe(false);
    // Fanen roteres 90° om venstre-bund og rager derfor sin egen HØJDE (48 px) ud til højre for
    // `left`. `left` ER indholdsboksens kant, så fanen ligger HELT uden for boksen, og dens
    // `border-bottom` — den blå streg — lander præcis på kanten. Udhænget er bevidst uden for
    // skaleringens pladsregnskab og klippes af `SideTabRail`.
    expect(el).toHaveStyle({ top: '125px', left: '1200px', height: '48px' });
  });

  it('bærer fane-klassen og lader CSS eje typografien', () => {
    // Etiketten skal have PRÆCIS samme signatur som de vandrette faners, og den fælles
    // `.tab-item`-regel er det ene sted, den kommer fra. Bærer `sx` sin egen typografi eller sin
    // egen `border`, vinder emotion over klassen — og netop det gjorde fanerne usynlige i dark mode
    // (`color: inherit`) og slettede den blå streg (`border: none`). Derfor hævdes fraværet her.
    render(<SideTab label="EO-kontrol" active={false} onClick={vi.fn()} top="125px" />);
    const el = screen.getByText('EO-kontrol');

    expect(el.classList.contains('tab-item')).toBe(true);

    // Målingen er en SAMMENLIGNING med en bar knap, der bærer de samme klasser og INGEN `sx`.
    // Absolutte værdier kan ikke bruges: jsdom giver `font-size` startværdien «medium» og `color` en
    // startfarve, uanset om nogen satte dem. Forskellen kan derimod kun komme fra `sx`.
    const reference = document.createElement('button');
    reference.className = 'tab-item side-tab';
    document.body.appendChild(reference);

    const tabStyle = window.getComputedStyle(el);
    const referenceStyle = window.getComputedStyle(reference);
    for (const property of ['color', 'font-size', 'font-family', 'font-weight', 'line-height', 'letter-spacing', 'border-bottom-style', 'border-bottom-width']) {
      expect(tabStyle.getPropertyValue(property)).toBe(referenceStyle.getPropertyValue(property));
    }

    // Kontrolprøven, der gør sammenligningen til andet end en tautologi: `sx`'ens GEOMETRI er
    // synlig for netop denne måling, så et typografi-`sx` ville også have været det.
    expect(tabStyle.getPropertyValue('left')).toBe('1200px');
    expect(referenceStyle.getPropertyValue('left')).not.toBe('1200px');
    reference.remove();
  });

  it('tilføjer active-klassen når aktiv', () => {
    render(<SideTab label="Test" active onClick={vi.fn()} top="-25px" />);
    expect(screen.getByText('Test').classList.contains('active')).toBe(true);
  });

  it('kalder onClick ved klik', () => {
    const onClick = vi.fn();
    render(<SideTab label="Kontroltabel" active={false} onClick={onClick} top="125px" />);
    fireEvent.click(screen.getByText('Kontroltabel'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('er en native knap, der kan aktiveres med Enter og mellemrum', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<SideTab label="Kontroltabel" active={false} onClick={onClick} top="125px" />);

    const tab = screen.getByRole('button', { name: 'Kontroltabel' });
    expect(tab).toHaveAttribute('type', 'button');
    expect(tab).toHaveAttribute('aria-pressed', 'false');

    tab.focus();
    await user.keyboard('{Enter}');
    await user.keyboard('[Space]');

    expect(onClick).toHaveBeenCalledTimes(2);
  });
});

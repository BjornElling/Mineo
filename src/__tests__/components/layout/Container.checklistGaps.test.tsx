// @vitest-environment jsdom
import * as React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Container from '../../../components/layout/Container';
import StyledDropdown from '../../../components/inputs/StyledDropdown';
import TransientDateInput from '../../../components/inputs/transient/TransientDateInput';
import TransientTextInput from '../../../components/inputs/transient/TransientTextInput';
import { toISODateString } from '../../../types/branded';

/**
 * Container keyboard-navigation – dækning af punkter der tidligere kun var i den
 * manuelle QA-tjekliste (nu migreret til automatiske tests; jf. `src/contracts/keyboard-navigation.md`).
 *
 * Disse tests dækker de punkter, der KAN verificeres i JSDOM:
 *  - Afsnit 4: Container intercepter IKKE museklik (klik giver fokus til det klikkede felt)
 *  - Afsnit 5: Disabled-felter springes over i Tab-rækkefølgen
 *  - Afsnit 1/3/4: Den rigtige StyledDropdown (readOnly combobox) indgår i Tab-rækkefølgen,
 *    åbner på Enter og første klik, og Container intercepter ikke
 *  - Afsnit 7: datofelt får fokus ved Tab uden selection
 *
 * Rent visuelle punkter (blå markerings-rendering, fokus-ring-CSS) kan ikke verificeres
 * i JSDOM og forbliver i den manuelle tjekliste / live-verifikation.
 *
 * Note om test-styling: `position: fixed` matcher Container.test.tsx og giver inputs
 * layout-bokse i JSDOM-synligheds-selektorerne.
 */

describe('Container keyboard navigation – tjekliste-huller', () => {
  const getRectsSpy = vi.spyOn(HTMLElement.prototype, 'getClientRects');

  const mockVisibleRects = () => {
    getRectsSpy.mockImplementation(() => {
      const rects = [
        { x: 0, y: 0, width: 10, height: 10, top: 0, left: 0, right: 10, bottom: 10, toJSON: () => ({}) } as DOMRect,
      ];
      const rectList = Object.assign(rects, { item: (index: number) => rects[index] ?? null });
      return rectList as DOMRectList;
    });
  };

  const waitForSelectionClear = async () => {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  };

  /**
   * Flush StyledDropdowns Grow-transitions efterslæb inde i et act()-vindue.
   *
   * Problemet: MUI's Popover åbner via en Grow-transition, hvis afsluttende `onEntered`-callback
   * fyrer på en efterfølgende macrotask (setTimeout, ~0 ms i JSDOM hvor `transitionDuration="auto"`
   * giver duration 0). `findByRole('listbox')` resolver allerede når listboxen mountes – dvs. ved
   * transitionens START – så den efterslæbende state-opdatering kan lande EFTER testens act-vindue
   * under tung parallel CI-belastning, hvor event-loopet er optaget ("update ... not wrapped in act").
   * Ved at vente på en efterfølgende macrotask inde i act() trækkes den allerede planlagte
   * transition-timer (FIFO før vores egen) ind i et act-vindue, så advarslen ikke kan opstå.
   */
  const flushPopoverTransition = async () => {
    await act(async () => {
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 0);
      });
    });
  };

  beforeAll(() => {
    mockVisibleRects();
  });

  afterAll(() => {
    getRectsSpy.mockRestore();
  });

  // --- Afsnit 5: Disabled-felter springes over -------------------------------

  it('Tab springer disabled-felter over i Tab-rækkefølgen', async () => {
    const user = userEvent.setup();

    render(
      <Container>
        <input data-testid="field1" type="text" style={{ position: 'fixed' }} />
        <input data-testid="disabled" type="text" disabled style={{ position: 'fixed' }} />
        <input data-testid="field2" type="text" style={{ position: 'fixed' }} />
      </Container>
    );

    const field1 = screen.getByTestId('field1') as HTMLInputElement;
    const disabled = screen.getByTestId('disabled') as HTMLInputElement;
    const field2 = screen.getByTestId('field2') as HTMLInputElement;

    field1.focus();
    await user.keyboard('{Tab}');
    await waitForSelectionClear();

    expect(document.activeElement).toBe(field2);
    expect(document.activeElement).not.toBe(disabled);
  });

  it('Shift+Tab springer disabled-felter over i Tab-rækkefølgen', async () => {
    const user = userEvent.setup();

    render(
      <Container>
        <input data-testid="field1" type="text" style={{ position: 'fixed' }} />
        <input data-testid="disabled" type="text" disabled style={{ position: 'fixed' }} />
        <input data-testid="field2" type="text" style={{ position: 'fixed' }} />
      </Container>
    );

    const field1 = screen.getByTestId('field1') as HTMLInputElement;
    const disabled = screen.getByTestId('disabled') as HTMLInputElement;
    const field2 = screen.getByTestId('field2') as HTMLInputElement;

    field2.focus();
    await user.keyboard('{Shift>}{Tab}{/Shift}');
    await waitForSelectionClear();

    expect(document.activeElement).toBe(field1);
    expect(document.activeElement).not.toBe(disabled);
  });

  // --- Afsnit 4: Container intercepter IKKE museklik -------------------------

  it('Museklik giver fokus til det klikkede felt (Container intercepter ikke)', async () => {
    const user = userEvent.setup();

    render(
      <Container>
        <input data-testid="field1" type="text" style={{ position: 'fixed' }} />
        <input data-testid="field2" type="text" style={{ position: 'fixed' }} />
        <input data-testid="field3" type="text" style={{ position: 'fixed' }} />
      </Container>
    );

    const field1 = screen.getByTestId('field1') as HTMLInputElement;
    const field3 = screen.getByTestId('field3') as HTMLInputElement;

    field1.focus();
    expect(document.activeElement).toBe(field1);

    // Et klik må lande fokus præcis på det klikkede felt – IKKE på Containers
    // tab-rækkefølge (ville være et tegn på at Container kaprer klik).
    await user.click(field3);
    await waitForSelectionClear();

    expect(document.activeElement).toBe(field3);
    expect((field3 as HTMLInputElement).selectionStart).toBe((field3 as HTMLInputElement).selectionEnd);
  });

  it('Museklik på allerede fokuseret felt udløser ingen utilsigtet fokus-flytning', async () => {
    const user = userEvent.setup();

    render(
      <Container>
        <input data-testid="field1" type="text" defaultValue="abc" style={{ position: 'fixed' }} />
        <input data-testid="field2" type="text" style={{ position: 'fixed' }} />
      </Container>
    );

    const field1 = screen.getByTestId('field1') as HTMLInputElement;

    await user.click(field1);
    await user.click(field1);
    await waitForSelectionClear();

    expect(document.activeElement).toBe(field1);
  });

  // --- Afsnit 1/3/4: Rigtig StyledDropdown-integration ----------------------

  const DropdownHarness = () => {
    const [value, setValue] = React.useState<string | undefined>('a');
    return (
      <Container>
        <input data-testid="before" type="text" style={{ position: 'fixed' }} />
        <StyledDropdown
          ariaLabel="Valg"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          name="valg"
          placeholder="Vælg"
          sx={{ '& input': { position: 'fixed' } }}
        >
          <option value="a">Alfa</option>
          <option value="b">Beta</option>
        </StyledDropdown>
        <input data-testid="after" type="text" style={{ position: 'fixed' }} />
      </Container>
    );
  };

  it('Tab når den readOnly StyledDropdown (combobox indgår i Tab-rækkefølgen)', async () => {
    const user = userEvent.setup();
    render(<DropdownHarness />);

    const before = screen.getByTestId('before') as HTMLInputElement;
    const combobox = screen.getByRole('combobox');

    before.focus();
    await user.keyboard('{Tab}');
    await waitForSelectionClear();

    expect(document.activeElement).toBe(combobox);
  });

  it('Enter på lukket StyledDropdown åbner menuen og Container flytter ikke fokus', async () => {
    const user = userEvent.setup();
    render(<DropdownHarness />);

    const combobox = screen.getByRole('combobox');
    const after = screen.getByTestId('after') as HTMLInputElement;

    // act-wrap: StyledDropdowns InputBase opdaterer focus-state ved focus; et bart .focus()
    // ville lande den state-opdatering uden for act ("update to ForwardRef(InputBase) not wrapped").
    await act(async () => {
      combobox.focus();
    });
    expect(screen.queryByRole('listbox')).toBeNull();

    await user.keyboard('{Enter}');

    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    // Flush Grow-transitionens efterslæb inde i act (se flushPopoverTransition): findByRole resolver
    // ved transitionens start, så onEntered-opdateringen skal trækkes ind i et act-vindue.
    await flushPopoverTransition();
    expect(document.activeElement).toBe(combobox);
    expect(document.activeElement).not.toBe(after);
  });

  it('Første klik på StyledDropdown åbner menuen (Container intercepter ikke)', async () => {
    const user = userEvent.setup();
    render(<DropdownHarness />);

    const combobox = screen.getByRole('combobox');
    expect(screen.queryByRole('listbox')).toBeNull();

    await user.click(combobox);

    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    // Flush Grow-transitionens efterslæb inde i act (se flushPopoverTransition).
    await flushPopoverTransition();
  });

  // --- Afsnit 7: datofelt får fokus uden selection --------------------

  it('Tab til et datofelt med værdi giver fokus uden selection', async () => {
    const user = userEvent.setup();

    const Harness = () => {
      const [value, setValue] = React.useState<ReturnType<typeof toISODateString> | undefined>(
        toISODateString('2026-01-15')
      );
      return (
        <Container>
          <input data-testid="before" type="text" style={{ position: 'fixed' }} />
          <TransientDateInput value={value} onCommit={setValue} sx={{ '& .MuiInputBase-input': { position: 'fixed' } }} />
        </Container>
      );
    };

    render(<Harness />);

    const before = screen.getByTestId('before') as HTMLInputElement;
    const dateInput = screen.getByDisplayValue('15-01-2026') as HTMLInputElement;

    before.focus();
    await user.keyboard('{Tab}');
    await waitForSelectionClear();

    expect(document.activeElement).toBe(dateInput);
    expect(dateInput.selectionStart).toBe(dateInput.selectionEnd);
  });

  it('Tekstfelt indgår i Tab-rækkefølgen og får fokus uden selection', async () => {
    const user = userEvent.setup();

    const Harness = () => {
      const [value, setValue] = React.useState('Lang ledsagetekst med mange tegn');
      return (
        <Container>
          <input data-testid="before" type="text" style={{ position: 'fixed' }} />
          <TransientTextInput value={value} onChange={setValue} sx={{ '& .MuiInputBase-input': { position: 'fixed' } }} />
        </Container>
      );
    };

    render(<Harness />);

    const before = screen.getByTestId('before') as HTMLInputElement;
    const textInput = screen.getByDisplayValue('Lang ledsagetekst med mange tegn') as HTMLInputElement;

    before.focus();
    await user.keyboard('{Tab}');
    await waitForSelectionClear();

    expect(document.activeElement).toBe(textInput);
    expect(textInput.selectionStart).toBe(textInput.selectionEnd);
  });
});

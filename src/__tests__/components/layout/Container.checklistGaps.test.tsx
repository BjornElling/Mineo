import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Container from '../../../components/layout/Container';
import StyledDropdown from '../../../components/inputs/StyledDropdown';
import StyledDateField from '../../../components/inputs/StyledDateField';
import StyledTextField from '../../../components/inputs/StyledTextField';
import { toISODateString } from '../../../types/branded';

/**
 * Container keyboard-navigation — dækning af punkter der tidligere kun var i den
 * manuelle QA-tjekliste (nu migreret til automatiske tests; jf. `src/contracts/keyboard-navigation.md`).
 *
 * Disse tests dækker de punkter, der KAN verificeres i JSDOM:
 *  - Afsnit 4: Container intercepter IKKE museklik (klik giver fokus til det klikkede felt)
 *  - Afsnit 5: Disabled-felter springes over i Tab-rækkefølgen
 *  - Afsnit 1/3/4: Den rigtige StyledDropdown (readOnly combobox) indgår i Tab-rækkefølgen,
 *    åbner på Enter og første klik, og Container intercepter ikke
 *  - Afsnit 7: StyledDateField får fokus ved Tab uden selection
 *
 * Rent visuelle punkter (blå markerings-rendering, fokus-ring-CSS) kan ikke verificeres
 * i JSDOM og forbliver i den manuelle tjekliste / live-verifikation.
 *
 * Note om test-styling: `position: fixed` matcher Container.test.tsx og giver inputs
 * layout-bokse i JSDOM-synligheds-selektorerne.
 */

describe('Container keyboard navigation — tjekliste-huller', () => {
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

    // Et klik må lande fokus præcis på det klikkede felt — IKKE på Containers
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

    combobox.focus();
    expect(screen.queryByRole('listbox')).toBeNull();

    await user.keyboard('{Enter}');

    // findByRole (act-bevidst waitFor) frem for getByRole: MUI Selects menu åbner med en
    // Grow-transition, hvis efterslæbende fokus/transition-opdatering på InputBase ellers lander
    // uden for et act()-vindue ("update ... not wrapped in act"). waitFor flusher den inde i sit
    // eget vindue, hvor opdateringen ikke udløser advarslen.
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
    expect(document.activeElement).toBe(combobox);
    expect(document.activeElement).not.toBe(after);
  });

  it('Første klik på StyledDropdown åbner menuen (Container intercepter ikke)', async () => {
    const user = userEvent.setup();
    render(<DropdownHarness />);

    const combobox = screen.getByRole('combobox');
    expect(screen.queryByRole('listbox')).toBeNull();

    await user.click(combobox);

    // Se kommentar ovenfor: act-bevidst findByRole flusher Grow-transitionens efterslæb.
    expect(await screen.findByRole('listbox')).toBeInTheDocument();
  });

  // --- Afsnit 7: StyledDateField fr fokus uden selection --------------------

  it('Tab til StyledDateField med værdi giver fokus uden selection', async () => {
    const user = userEvent.setup();

    const Harness = () => {
      const [value, setValue] = React.useState<ReturnType<typeof toISODateString> | undefined>(
        toISODateString('2026-01-15')
      );
      return (
        <Container>
          <input data-testid="before" type="text" style={{ position: 'fixed' }} />
          <StyledDateField
            value={value}
            onCommit={(e) => setValue(e.target.value)}
            sx={{ '& .MuiInputBase-input': { position: 'fixed' } }}
          />
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
    // Lukket editor => readOnly => indgår i pil-/Tab-navigation uden at åbne caret.
    expect(dateInput.readOnly).toBe(true);
  });

  it('StyledTextField indgår i Tab-rækkefølgen og får fokus uden selection', async () => {
    const user = userEvent.setup();

    const Harness = () => {
      const [value, setValue] = React.useState('Lang ledsagetekst med mange tegn');
      return (
        <Container>
          <input data-testid="before" type="text" style={{ position: 'fixed' }} />
          <StyledTextField
            value={value}
            onCommit={(e) => setValue(e.target.value)}
            sx={{ '& .MuiInputBase-input': { position: 'fixed' } }}
          />
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

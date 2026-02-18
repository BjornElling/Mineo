import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Container from '../../../components/layout/Container';
import StyledIntegerField from '../../../components/inputs/StyledIntegerField';

/**
 * Container keyboard navigation tests
 *
 * Disse tests verificerer den normative keyboard-kontrakt:
 * - Tab/Shift+Tab flytter fokus uden at selektere indhold
 * - Enter flytter fokus som Tab (uden selection)
 * - Enter på popup-widgets intercepteres IKKE
 * - Cirkulær navigation fungerer korrekt
 *
 * Se src/contracts/keyboard-navigation.md for fuld kontrakt.
 *
 * Note om test-styling:
 * `position: fixed` bruges i flere tests som JSDOM-workaround, så inputs får layout-boxe
 * og dermed indgår stabilt i synligheds-/fokus-selektorerne.
 */

describe('Container keyboard navigation', () => {
  const getRectsSpy = vi.spyOn(HTMLElement.prototype, 'getClientRects');

  const mockVisibleRects = () => {
    getRectsSpy.mockImplementation(() => {
      const rects = [
        {
          x: 0,
          y: 0,
          width: 10,
          height: 10,
          top: 0,
          left: 0,
          right: 10,
          bottom: 10,
          toJSON: () => ({}),
        } as DOMRect,
      ];
      const rectList = Object.assign(rects, {
        item: (index: number) => rects[index] ?? null,
      });
      return rectList as DOMRectList;
    });
  };

  const restoreRects = () => {
    getRectsSpy.mockRestore();
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
    restoreRects();
  });
  it('Tab flytter fokus fremad uden at selektere indhold', async () => {
    const user = userEvent.setup();

    render(
      <Container>
        <input data-testid="field1" type="text" defaultValue="Værdi 1"  style={{ position: 'fixed' }} />
        <input data-testid="field2" type="text" defaultValue="Værdi 2"  style={{ position: 'fixed' }} />
        <input data-testid="field3" type="text" defaultValue="Værdi 3"  style={{ position: 'fixed' }} />
      </Container>
    );

    const field1 = screen.getByTestId('field1') as HTMLInputElement;
    const field2 = screen.getByTestId('field2') as HTMLInputElement;

    field1.focus();
    expect(document.activeElement).toBe(field1);

    await user.keyboard('{Tab}');
    await waitForSelectionClear();

    // Fokus skal flytte til næste felt
    expect(document.activeElement).toBe(field2);

    // Indhold må IKKE være selekteret
    expect(field2.selectionStart).toBe(field2.selectionEnd);
  });

  it('Shift+Tab flytter fokus baglæns uden at selektere indhold', async () => {
    const user = userEvent.setup();

    render(
      <Container>
        <input data-testid="field1" type="text" defaultValue="Værdi 1"  style={{ position: 'fixed' }} />
        <input data-testid="field2" type="text" defaultValue="Værdi 2"  style={{ position: 'fixed' }} />
        <input data-testid="field3" type="text" defaultValue="Værdi 3"  style={{ position: 'fixed' }} />
      </Container>
    );

    const field1 = screen.getByTestId('field1') as HTMLInputElement;
    const field2 = screen.getByTestId('field2') as HTMLInputElement;

    field2.focus();
    expect(document.activeElement).toBe(field2);

    await user.keyboard('{Shift>}{Tab}{/Shift}');
    await waitForSelectionClear();

    // Fokus skal flytte til forrige felt
    expect(document.activeElement).toBe(field1);

    // Indhold må IKKE være selekteret
    expect(field1.selectionStart).toBe(field1.selectionEnd);
  });

  it('Enter flytter fokus fremad uden at selektere indhold', async () => {
    const user = userEvent.setup();

    render(
      <Container>
        <input data-testid="field1" type="text" defaultValue="Værdi 1"  style={{ position: 'fixed' }} />
        <input data-testid="field2" type="text" defaultValue="Værdi 2"  style={{ position: 'fixed' }} />
        <input data-testid="field3" type="text" defaultValue="Værdi 3"  style={{ position: 'fixed' }} />
      </Container>
    );

    const field1 = screen.getByTestId('field1') as HTMLInputElement;
    const field2 = screen.getByTestId('field2') as HTMLInputElement;

    field1.focus();
    expect(document.activeElement).toBe(field1);

    await user.keyboard('{Enter}');
    await waitForSelectionClear();

    // Fokus skal flytte til næste felt (samme som Tab)
    expect(document.activeElement).toBe(field2);

    // Indhold må IKKE være selekteret
    expect(field2.selectionStart).toBe(field2.selectionEnd);
  });

  it('Shift+Enter flytter fokus baglæns uden at selektere indhold', async () => {
    const user = userEvent.setup();

    render(
      <Container>
        <input data-testid="field1" type="text" defaultValue="Værdi 1"  style={{ position: 'fixed' }} />
        <input data-testid="field2" type="text" defaultValue="Værdi 2"  style={{ position: 'fixed' }} />
        <input data-testid="field3" type="text" defaultValue="Værdi 3"  style={{ position: 'fixed' }} />
      </Container>
    );

    const field1 = screen.getByTestId('field1') as HTMLInputElement;
    const field2 = screen.getByTestId('field2') as HTMLInputElement;

    field2.focus();
    expect(document.activeElement).toBe(field2);

    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await waitForSelectionClear();

    expect(document.activeElement).toBe(field1);
    expect(field1.selectionStart).toBe(field1.selectionEnd);
  });

  it('Tab fra sidste felt går til første felt (cirkulær navigation)', async () => {
    const user = userEvent.setup();

    render(
      <Container>
        <input data-testid="field1" type="text"  style={{ position: 'fixed' }} />
        <input data-testid="field2" type="text"  style={{ position: 'fixed' }} />
        <input data-testid="field3" type="text"  style={{ position: 'fixed' }} />
      </Container>
    );

    const field1 = screen.getByTestId('field1') as HTMLInputElement;
    const field3 = screen.getByTestId('field3') as HTMLInputElement;

    field3.focus();
    expect(document.activeElement).toBe(field3);

    await user.keyboard('{Tab}');
    await waitForSelectionClear();

    // Fokus skal hoppe til første felt (cirkulær)
    expect(document.activeElement).toBe(field1);

    // Indhold må IKKE være selekteret
    expect(field1.selectionStart).toBe(field1.selectionEnd);
  });

  it('Shift+Tab fra første felt går til sidste felt (cirkulær navigation)', async () => {
    const user = userEvent.setup();

    render(
      <Container>
        <input data-testid="field1" type="text"  style={{ position: 'fixed' }} />
        <input data-testid="field2" type="text"  style={{ position: 'fixed' }} />
        <input data-testid="field3" type="text"  style={{ position: 'fixed' }} />
      </Container>
    );

    const field1 = screen.getByTestId('field1') as HTMLInputElement;
    const field3 = screen.getByTestId('field3') as HTMLInputElement;

    field1.focus();
    expect(document.activeElement).toBe(field1);

    await user.keyboard('{Shift>}{Tab}{/Shift}');
    await waitForSelectionClear();

    // Fokus skal hoppe til sidste felt (cirkulær)
    expect(document.activeElement).toBe(field3);

    // Indhold må IKKE være selekteret
    expect(field3.selectionStart).toBe(field3.selectionEnd);
  });

  it('Enter på combobox-widget intercepteres IKKE af Container', async () => {
    const user = userEvent.setup();
    let enterWasFired = false;

    render(
      <Container>
        <input data-testid="field1" type="text"  style={{ position: 'fixed' }} />
        <input
          style={{ position: 'fixed' }}
          data-testid="combobox"
          type="text"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded="false"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              enterWasFired = true;
            }
          }}
        />
        <input data-testid="field2" type="text"  style={{ position: 'fixed' }} />
      </Container>
    );

    const combobox = screen.getByTestId('combobox');
    combobox.focus();
    expect(document.activeElement).toBe(combobox);

    await user.keyboard('{Enter}');

    // Enter skal NÅ til combobox'en (ikke intercepteret af Container)
    expect(enterWasFired).toBe(true);

    // Fokus skal IKKE flytte til næste felt
    expect(document.activeElement).toBe(combobox);
  });

  it('Tab fra sidste lukkede combobox går til første felt (cirkulær navigation)', async () => {
    const user = userEvent.setup();

    render(
      <Container>
        <input data-testid="field1" type="text" style={{ position: 'fixed' }} />
        <input
          style={{ position: 'fixed' }}
          data-testid="combobox-last"
          type="text"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded="false"
        />
      </Container>
    );

    const field1 = screen.getByTestId('field1') as HTMLInputElement;
    const comboboxLast = screen.getByTestId('combobox-last');

    comboboxLast.focus();
    expect(document.activeElement).toBe(comboboxLast);

    await user.keyboard('{Tab}');
    await waitForSelectionClear();

    expect(document.activeElement).toBe(field1);
  });

  it('Tab kan fokusere popup-trigger med aria-haspopup (MUI Select-semantik)', async () => {
    const user = userEvent.setup();

    render(
      <Container>
        <input data-testid="field1" type="text" style={{ position: 'fixed' }} />
        <div
          data-testid="popup-trigger"
          role="button"
          tabIndex={0}
          aria-haspopup="listbox"
          aria-expanded="false"
          style={{ position: 'fixed' }}
        />
        <input data-testid="field3" type="text" style={{ position: 'fixed' }} />
      </Container>
    );

    const field1 = screen.getByTestId('field1');
    const popupTrigger = screen.getByTestId('popup-trigger');

    (field1 as HTMLInputElement).focus();
    expect(document.activeElement).toBe(field1);

    await user.keyboard('{Tab}');
    await waitForSelectionClear();

    expect(document.activeElement).toBe(popupTrigger);
  });

  it('Enter i textarea giver newline (ikke fokus-flytning)', async () => {
    const user = userEvent.setup();

    render(
      <Container>
        <input data-testid="field1" type="text"  style={{ position: 'fixed' }} />
        <textarea data-testid="textarea" defaultValue="Linje 1"  style={{ position: 'fixed' }} />
        <input data-testid="field2" type="text"  style={{ position: 'fixed' }} />
      </Container>
    );

    const textarea = screen.getByTestId('textarea') as HTMLTextAreaElement;

    textarea.focus();
    expect(document.activeElement).toBe(textarea);

    const valueBefore = textarea.value;
    await user.keyboard('{Enter}');

    // Enter skal IKKE flytte fokus
    expect(document.activeElement).toBe(textarea);

    // Enter skal give newline (værdi ændres)
    expect(textarea.value).not.toBe(valueBefore);
  });

  it('Tom felt får fokus uden selection', async () => {
    const user = userEvent.setup();

    render(
      <Container>
        <input data-testid="field1" type="text"  style={{ position: 'fixed' }} />
        <input data-testid="field2" type="text" defaultValue=""  style={{ position: 'fixed' }} />
      </Container>
    );

    const field1 = screen.getByTestId('field1') as HTMLInputElement;
    const field2 = screen.getByTestId('field2') as HTMLInputElement;

    field1.focus();
    await user.keyboard('{Tab}');
    await waitForSelectionClear();

    expect(document.activeElement).toBe(field2);

    // Tomt felt skal også kun få fokus (ingen selection)
    expect(field2.selectionStart).toBe(field2.selectionEnd);
  });

  it('Enter i open StyledIntegerField committer og flytter fokus som Tab', async () => {
    const user = userEvent.setup();

    const Harness = () => {
      const [value1, setValue1] = React.useState<number | undefined>(1);
      const [value2, setValue2] = React.useState<number | undefined>(5);
      return (
        <Container>
          <StyledIntegerField
            value={value1}
            onCommit={(e) => setValue1(e.target.value)}
            sx={{ '& .MuiInputBase-input': { position: 'fixed' } }}
          />
          <StyledIntegerField
            value={value2}
            onCommit={(e) => setValue2(e.target.value)}
            sx={{ '& .MuiInputBase-input': { position: 'fixed' } }}
          />
        </Container>
      );
    };

    render(<Harness />);

    const first = screen.getByDisplayValue('1') as HTMLInputElement;
    const second = screen.getByDisplayValue('5') as HTMLInputElement;

    await user.click(first);
    await user.click(first);
    await user.clear(first);
    await user.type(first, '2');
    await user.keyboard('{Enter}');
    await waitForSelectionClear();

    expect(first).toHaveValue('2');
    expect(document.activeElement).toBe(second);
  });

  it('Shift+Enter i open StyledIntegerField committer og flytter fokus som Shift+Tab', async () => {
    const user = userEvent.setup();

    const Harness = () => {
      const [value1, setValue1] = React.useState<number | undefined>(1);
      const [value2, setValue2] = React.useState<number | undefined>(5);
      return (
        <Container>
          <StyledIntegerField
            value={value1}
            onCommit={(e) => setValue1(e.target.value)}
            sx={{ '& .MuiInputBase-input': { position: 'fixed' } }}
          />
          <StyledIntegerField
            value={value2}
            onCommit={(e) => setValue2(e.target.value)}
            sx={{ '& .MuiInputBase-input': { position: 'fixed' } }}
          />
        </Container>
      );
    };

    render(<Harness />);

    const first = screen.getByDisplayValue('1') as HTMLInputElement;
    const second = screen.getByDisplayValue('5') as HTMLInputElement;

    await user.click(second);
    await user.click(second);
    await user.clear(second);
    await user.type(second, '7');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await waitForSelectionClear();

    expect(second).toHaveValue('7');
    expect(document.activeElement).toBe(first);
  });
});

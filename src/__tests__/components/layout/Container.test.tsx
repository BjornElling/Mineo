// @vitest-environment jsdom
import * as React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Container from '../../../components/layout/Container';
import TransientTextInput from '../../../components/inputs/transient/TransientTextInput';
import InlineActionButton from '../../../components/inputs/InlineActionButton';
import InsertTodayDateButton from '../../../components/inputs/InsertTodayDateButton';
import DownloadIconButton from '../../../components/inputs/DownloadIconButton';
import { StandardGridTable } from '../../../components/tables/StandardGridTable';
import SideTab from '../../../components/layout/SideTab';

/**
 * Container keyboard navigation tests
 *
 * Disse tests verificerer den normative keyboard-kontrakt:
 * - Tab/Shift+Tab flytter fokus uden at selektere indhold
 * - Enter flytter fokus som Tab (uden selection), undtagen på særlige widgets
 * - Enter på popup-widgets intercepteres IKKE
 * - Enter på radiobutton vælger den fokuserede radiobutton
 * - ArrowLeft/ArrowRight på radiobutton flytter aktiv selection med wrap i gruppen
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

  it('aktiverer en fokuseret sidefane, men holder indholdets tastatursekvens fri for sidefanen', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <Container>
        <SideTab label="Kontroltabel" active={false} onClick={onClick} top="125px" />
        <input data-testid="field1" type="text" style={{ position: 'fixed' }} />
        <input data-testid="field2" type="text" style={{ position: 'fixed' }} />
      </Container>
    );

    const sideTab = screen.getByRole('button', { name: 'Kontroltabel' });
    const field1 = screen.getByTestId('field1');
    const field2 = screen.getByTestId('field2');

    sideTab.focus();
    await user.keyboard('{Enter}');
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(sideTab);

    field1.focus();
    await user.keyboard('{Tab}');
    await waitForSelectionClear();
    expect(document.activeElement).toBe(field2);

    await user.keyboard('{Tab}');
    await waitForSelectionClear();
    expect(document.activeElement).toBe(field1);
    expect(document.activeElement).not.toBe(sideTab);

    await user.keyboard('{Shift>}{Tab}{/Shift}');
    await waitForSelectionClear();
    expect(document.activeElement).toBe(field2);
    expect(document.activeElement).not.toBe(sideTab);
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

  it('Tab og Shift+Tab afslutter et enkelt felt, før det får fokus igen', async () => {
    const user = userEvent.setup();
    const onBlur = vi.fn();

    render(
      <Container>
        <input data-testid="eneste-felt" type="text" onBlur={onBlur} style={{ position: 'fixed' }} />
      </Container>
    );

    const field = screen.getByTestId('eneste-felt') as HTMLInputElement;
    field.focus();

    await user.keyboard('{Tab}');
    await waitForSelectionClear();
    expect(onBlur).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(field);

    await user.keyboard('{Shift>}{Tab}{/Shift}');
    await waitForSelectionClear();
    expect(onBlur).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toBe(field);
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

  it('Enter på radiobutton vælger fokuseret option og flytter ikke fokus', async () => {
    const user = userEvent.setup();
    const onChangeA = vi.fn();
    const onChangeB = vi.fn();

    render(
      <Container>
        <input data-testid="before" type="text" style={{ position: 'fixed' }} />
        <input data-testid="radio-a" type="radio" name="valg" value="a" style={{ position: 'fixed' }} onChange={onChangeA} />
        <input data-testid="radio-b" type="radio" name="valg" value="b" style={{ position: 'fixed' }} onChange={onChangeB} />
        <input data-testid="after" type="text" style={{ position: 'fixed' }} />
      </Container>
    );

    const radioA = screen.getByTestId('radio-a') as HTMLInputElement;
    const radioB = screen.getByTestId('radio-b') as HTMLInputElement;
    const after = screen.getByTestId('after') as HTMLInputElement;

    radioB.focus();
    expect(document.activeElement).toBe(radioB);
    expect(radioA.checked).toBe(false);
    expect(radioB.checked).toBe(false);

    await user.keyboard('{Enter}');
    await waitForSelectionClear();

    expect(radioB.checked).toBe(true);
    expect(radioA.checked).toBe(false);
    expect(onChangeB).toHaveBeenCalledTimes(1);
    expect(onChangeA).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(radioB);
    expect(document.activeElement).not.toBe(after);
  });

  it('ArrowRight/ArrowLeft på radiobutton flytter aktiv selection med wrap i gruppen', async () => {
    const user = userEvent.setup();
    const onChangeA = vi.fn();
    const onChangeB = vi.fn();
    const onChangeC = vi.fn();

    render(
      <Container>
        <input data-testid="radio-a" type="radio" name="valg" value="a" defaultChecked style={{ position: 'fixed' }} onChange={onChangeA} />
        <input data-testid="radio-b" type="radio" name="valg" value="b" style={{ position: 'fixed' }} onChange={onChangeB} />
        <input data-testid="radio-c" type="radio" name="valg" value="c" style={{ position: 'fixed' }} onChange={onChangeC} />
      </Container>
    );

    const radioA = screen.getByTestId('radio-a') as HTMLInputElement;
    const radioB = screen.getByTestId('radio-b') as HTMLInputElement;
    const radioC = screen.getByTestId('radio-c') as HTMLInputElement;

    radioB.focus();
    expect(document.activeElement).toBe(radioB);
    expect(radioA.checked).toBe(true);

    await user.keyboard('{ArrowRight}');
    await waitForSelectionClear();
    expect(document.activeElement).toBe(radioC);
    expect(radioC.checked).toBe(true);
    expect(radioA.checked).toBe(false);
    expect(onChangeC).toHaveBeenCalledTimes(1);

    await user.keyboard('{ArrowRight}');
    await waitForSelectionClear();
    expect(document.activeElement).toBe(radioA);
    expect(radioA.checked).toBe(true);

    await user.keyboard('{ArrowLeft}');
    await waitForSelectionClear();
    expect(document.activeElement).toBe(radioC);
    expect(radioC.checked).toBe(true);
    expect(onChangeB).not.toHaveBeenCalled();
  });

  it('Tab passerer en radiogruppe som ét tabstop', async () => {
    const user = userEvent.setup();

    render(
      <Container>
        <input data-testid="before" type="text" style={{ position: 'fixed' }} />
        <input data-testid="radio-a" type="radio" name="valg" value="a" style={{ position: 'fixed' }} />
        <input data-testid="radio-b" type="radio" name="valg" value="b" defaultChecked style={{ position: 'fixed' }} />
        <input data-testid="after" type="text" style={{ position: 'fixed' }} />
      </Container>
    );

    const before = screen.getByTestId('before') as HTMLInputElement;
    const radioA = screen.getByTestId('radio-a') as HTMLInputElement;
    const radioB = screen.getByTestId('radio-b') as HTMLInputElement;
    const after = screen.getByTestId('after') as HTMLInputElement;

    before.focus();
    await user.keyboard('{Tab}');
    await waitForSelectionClear();

    expect(document.activeElement).toBe(radioB);
    expect(document.activeElement).not.toBe(radioA);

    await user.keyboard('{Tab}');
    await waitForSelectionClear();

    expect(document.activeElement).toBe(after);
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

  it('Enter paa InlineActionButton aktiverer knappen og flytter ikke fokus videre', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <Container>
        <input data-testid="field1" type="text" style={{ position: 'fixed' }} />
        <InlineActionButton onClick={onClick}>Indsæt</InlineActionButton>
        <input data-testid="field3" type="text" style={{ position: 'fixed' }} />
      </Container>
    );

    const button = screen.getByRole('button', { name: 'Indsæt' });
    const field3 = screen.getByTestId('field3');

    (button as HTMLButtonElement).focus();
    expect(document.activeElement).toBe(button);

    await user.keyboard('{Enter}');

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(button);
    expect(document.activeElement).not.toBe(field3);
  });

  it('Enter paa inaktiv InlineActionButton flytter ikke fokus videre og udloeser ikke handling', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();

    render(
      <Container>
        <input data-testid="field1" type="text" style={{ position: 'fixed' }} />
        <InlineActionButton onClick={onClick} disabled>Indsæt</InlineActionButton>
        <input data-testid="field3" type="text" style={{ position: 'fixed' }} />
      </Container>
    );

    const button = screen.getByRole('button', { name: 'Indsæt' });
    const field3 = screen.getByTestId('field3');

    (button as HTMLButtonElement).focus();
    expect(document.activeElement).toBe(button);

    await user.keyboard('{Enter}');

    expect(onClick).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(button);
    expect(document.activeElement).not.toBe(field3);
  });

  it('Indsæt dags dato og synlige download-knapper indgår i Tab-rækkefølgen og aktiveres med Enter og mellemrum', async () => {
    const user = userEvent.setup();
    const onInsertToday = vi.fn();
    const onDownload = vi.fn();

    render(
      <Container>
        <input data-testid="before-action-buttons" type="text" style={{ position: 'fixed' }} />
        <InsertTodayDateButton onCommit={onInsertToday} />
        <DownloadIconButton onClick={onDownload} tooltip="Download som PDF" />
        <input data-testid="after-action-buttons" type="text" style={{ position: 'fixed' }} />
      </Container>
    );

    const before = screen.getByTestId('before-action-buttons') as HTMLInputElement;
    const insertToday = screen.getByRole('button', { name: 'Indsæt dags dato' });
    const download = screen.getByRole('button', { name: 'Download som PDF' });

    // JSDOM har ingen layoutmotor. Inline position giver samme synlighedssignal som i de øvrige
    // Container-tests og invalidérer inventarets cache gennem den observerede style-attribut.
    insertToday.style.position = 'fixed';
    download.style.position = 'fixed';
    await act(async () => { await Promise.resolve(); });

    await user.click(before);
    await user.keyboard('{Tab}');
    await waitForSelectionClear();
    expect(document.activeElement).toBe(insertToday);

    await user.keyboard('{Enter}');
    expect(onInsertToday).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(insertToday);

    await user.keyboard(' ');
    expect(onInsertToday).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toBe(insertToday);

    await user.keyboard('{Tab}');
    expect(document.activeElement).toBe(download);

    await user.keyboard('{Enter}');
    expect(onDownload).toHaveBeenCalledTimes(1);
    expect(document.activeElement).toBe(download);

    await user.keyboard(' ');
    expect(onDownload).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toBe(download);
  });

  it('beholder fokus på indsætningsknappen efter et commit, der gen-render fladen', async () => {
    const user = userEvent.setup();

    const DynamicAction = () => {
      const [value, setValue] = React.useState('før');
      return (
        <>
          <InsertTodayDateButton onCommit={() => setValue('efter')} />
          <output data-testid="dynamic-action-value">{value}</output>
        </>
      );
    };

    render(<DynamicAction />);
    const button = screen.getByRole('button', { name: 'Indsæt dags dato' });
    button.focus();

    await user.keyboard('{Enter}');
    expect(screen.getByTestId('dynamic-action-value')).toHaveTextContent('efter');
    await waitForSelectionClear();
    expect(document.activeElement).toBe(button);
  });

  it('skipper skjulte download-knapper i Tab-rækkefølgen', async () => {
    const user = userEvent.setup();

    render(
      <Container>
        <input data-testid="before-hidden-download" type="text" style={{ position: 'fixed' }} />
        <div hidden>
          <DownloadIconButton onClick={vi.fn()} tooltip="Skjult download" />
        </div>
        <input data-testid="after-hidden-download" type="text" style={{ position: 'fixed' }} />
      </Container>
    );

    const before = screen.getByTestId('before-hidden-download') as HTMLInputElement;
    const after = screen.getByTestId('after-hidden-download') as HTMLInputElement;

    before.focus();
    await user.keyboard('{Tab}');

    expect(document.activeElement).toBe(after);
  });

  it('skipper deaktiverede download-knapper i Tab-rækkefølgen', async () => {
    const user = userEvent.setup();

    render(
      <Container>
        <input data-testid="before-disabled-download" type="text" style={{ position: 'fixed' }} />
        <DownloadIconButton disabled onClick={vi.fn()} tooltip="Deaktiveret download" />
        <input data-testid="after-disabled-download" type="text" style={{ position: 'fixed' }} />
      </Container>
    );

    const before = screen.getByTestId('before-disabled-download') as HTMLInputElement;
    const after = screen.getByTestId('after-disabled-download') as HTMLInputElement;

    before.focus();
    await user.keyboard('{Tab}');

    expect(document.activeElement).toBe(after);
  });

  it('beholder fokus på feltet, når dets settle deaktiverer den næste download-knap', async () => {
    const user = userEvent.setup();

    const Harness = () => {
      const [downloadDisabled, setDownloadDisabled] = React.useState(false);
      return (
        <Container>
          <input
            data-testid="settling-field"
            type="text"
            onBlur={() => setDownloadDisabled(true)}
            style={{ position: 'fixed' }}
          />
          <DownloadIconButton disabled={downloadDisabled} onClick={vi.fn()} tooltip="Afhængig download" />
        </Container>
      );
    };

    render(<Harness />);

    const field = screen.getByTestId('settling-field') as HTMLInputElement;
    const download = screen.getByRole('button', { name: 'Afhængig download' });
    download.style.position = 'fixed';
    await act(async () => { await Promise.resolve(); });

    field.focus();
    await user.keyboard('{Tab}');
    await waitForSelectionClear();

    expect(download).toBeDisabled();
    expect(document.activeElement).toBe(field);
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

  // Container'ens Enter-som-Tab-navigation. Testen handler om CONTAINEREN, ikke om et bestemt felts
  // commit-mekanik, så den bruger et simpelt transient tekstfelt som navigationsmål.
  it('Enter i et fokuseret felt flytter fokus som Tab', async () => {
    const user = userEvent.setup();

    const Harness = () => {
      const [value1, setValue1] = React.useState('1');
      const [value2, setValue2] = React.useState('5');
      return (
        <Container>
          <TransientTextInput value={value1} onChange={setValue1} sx={{ '& .MuiInputBase-input': { position: 'fixed' } }} />
          <TransientTextInput value={value2} onChange={setValue2} sx={{ '& .MuiInputBase-input': { position: 'fixed' } }} />
        </Container>
      );
    };

    render(<Harness />);

    const first = screen.getByDisplayValue('1') as HTMLInputElement;
    const second = screen.getByDisplayValue('5') as HTMLInputElement;

    await user.click(first);
    await user.clear(first);
    await user.type(first, '2');
    await user.keyboard('{Enter}');
    await waitForSelectionClear();

    expect(first).toHaveValue('2');
    expect(document.activeElement).toBe(second);
  });

  it('Shift+Enter i et fokuseret felt flytter fokus som Shift+Tab', async () => {
    const user = userEvent.setup();

    const Harness = () => {
      const [value1, setValue1] = React.useState('1');
      const [value2, setValue2] = React.useState('5');
      return (
        <Container>
          <TransientTextInput value={value1} onChange={setValue1} sx={{ '& .MuiInputBase-input': { position: 'fixed' } }} />
          <TransientTextInput value={value2} onChange={setValue2} sx={{ '& .MuiInputBase-input': { position: 'fixed' } }} />
        </Container>
      );
    };

    render(<Harness />);

    const first = screen.getByDisplayValue('1') as HTMLInputElement;
    const second = screen.getByDisplayValue('5') as HTMLInputElement;

    await user.click(second);
    await user.clear(second);
    await user.type(second, '7');
    await user.keyboard('{Shift>}{Enter}{/Shift}');
    await waitForSelectionClear();

    expect(second).toHaveValue('7');
    expect(document.activeElement).toBe(first);
  });

  it('ArrowRight/ArrowLeft navigerer i samme række med wrap når editor er lukket', async () => {
    const user = userEvent.setup();

    render(
      <Container>
        <div className="row--label-right-hover" style={{ position: 'fixed' }}>
          <input data-testid="r1c1" type="text" readOnly defaultValue="A" style={{ position: 'fixed' }} />
          <input data-testid="r1c2" type="text" readOnly defaultValue="B" style={{ position: 'fixed' }} />
          <input data-testid="r1c3" type="text" readOnly defaultValue="C" style={{ position: 'fixed' }} />
        </div>
      </Container>
    );

    const r1c1 = screen.getByTestId('r1c1') as HTMLInputElement;
    const r1c2 = screen.getByTestId('r1c2') as HTMLInputElement;
    const r1c3 = screen.getByTestId('r1c3') as HTMLInputElement;
    expect(r1c1.readOnly).toBe(true);

    r1c1.focus();
    expect(document.activeElement).toBe(r1c1);

    await user.keyboard('{ArrowRight}');
    await waitForSelectionClear();
    expect(document.activeElement).toBe(r1c2);

    await user.keyboard('{ArrowRight}');
    await waitForSelectionClear();
    expect(document.activeElement).toBe(r1c3);

    await user.keyboard('{ArrowRight}');
    await waitForSelectionClear();
    expect(document.activeElement).toBe(r1c1);

    await user.keyboard('{ArrowLeft}');
    await waitForSelectionClear();
    expect(document.activeElement).toBe(r1c3);
  });

  it('ArrowUp/ArrowDown går til første felt i række over/under med wrap', async () => {
    const user = userEvent.setup();

    render(
      <Container>
        <div className="row--label-right-hover" style={{ position: 'fixed' }}>
          <input data-testid="r1c1" type="text" readOnly defaultValue="A" style={{ position: 'fixed' }} />
          <input data-testid="r1c2" type="text" readOnly defaultValue="B" style={{ position: 'fixed' }} />
        </div>
        <div className="row--label-right-hover" style={{ position: 'fixed', marginTop: 30 }}>
          <input data-testid="r2c1" type="text" readOnly defaultValue="C" style={{ position: 'fixed' }} />
          <input data-testid="r2c2" type="text" readOnly defaultValue="D" style={{ position: 'fixed' }} />
        </div>
      </Container>
    );

    const r1c1 = screen.getByTestId('r1c1') as HTMLInputElement;
    const r1c2 = screen.getByTestId('r1c2') as HTMLInputElement;
    const r2c1 = screen.getByTestId('r2c1') as HTMLInputElement;
    const r2c2 = screen.getByTestId('r2c2') as HTMLInputElement;
    expect(r1c2.readOnly).toBe(true);

    r1c2.focus();
    expect(document.activeElement).toBe(r1c2);

    await user.keyboard('{ArrowDown}');
    await waitForSelectionClear();
    expect(document.activeElement).toBe(r2c1);

    await user.keyboard('{ArrowDown}');
    await waitForSelectionClear();
    expect(document.activeElement).toBe(r1c1);

    await user.keyboard('{ArrowUp}');
    await waitForSelectionClear();
    expect(document.activeElement).toBe(r2c2);
  });

  it('Pil-navigation intercepteres ikke når editor er åben (readOnly=false)', async () => {
    const user = userEvent.setup();

    render(
      <Container>
        <input data-testid="editable" type="text" defaultValue="A" style={{ position: 'fixed' }} />
        <input data-testid="next" type="text" readOnly defaultValue="B" style={{ position: 'fixed' }} />
      </Container>
    );

    const editable = screen.getByTestId('editable') as HTMLInputElement;
    const next = screen.getByTestId('next') as HTMLInputElement;

    editable.focus();
    expect(document.activeElement).toBe(editable);

    await user.keyboard('{ArrowRight}');
    await waitForSelectionClear();
    expect(document.activeElement).toBe(editable);

    await user.keyboard('{ArrowDown}');
    await waitForSelectionClear();
    expect(document.activeElement).toBe(editable);
    expect(document.activeElement).not.toBe(next);
  });

  it('Pil-navigation intercepteres ikke i table-subtree', async () => {
    const user = userEvent.setup();

    render(
      <Container>
        <div data-mineo-table-navigation="true" style={{ position: 'fixed' }}>
          <input data-testid="table-cell" type="text" readOnly defaultValue="celle" style={{ position: 'fixed' }} />
        </div>
        <input data-testid="outside" type="text" readOnly defaultValue="udenfor" style={{ position: 'fixed' }} />
      </Container>
    );

    const tableCell = screen.getByTestId('table-cell') as HTMLInputElement;
    const outside = screen.getByTestId('outside') as HTMLInputElement;

    tableCell.focus();
    expect(document.activeElement).toBe(tableCell);

    await user.keyboard('{ArrowRight}');
    await waitForSelectionClear();
    expect(document.activeElement).toBe(tableCell);
    expect(document.activeElement).not.toBe(outside);
  });

  it('Pil-navigation intercepteres ikke når combobox-popup er åben', async () => {
    const user = userEvent.setup();

    render(
      <Container>
        <input
          data-testid="combobox-open"
          type="text"
          role="combobox"
          aria-haspopup="listbox"
          aria-expanded="true"
          readOnly
          defaultValue="A"
          style={{ position: 'fixed' }}
        />
        <input data-testid="next" type="text" readOnly defaultValue="B" style={{ position: 'fixed' }} />
      </Container>
    );

    const openCombobox = screen.getByTestId('combobox-open') as HTMLInputElement;
    const next = screen.getByTestId('next') as HTMLInputElement;

    openCombobox.focus();
    expect(document.activeElement).toBe(openCombobox);

    await user.keyboard('{ArrowDown}');
    await waitForSelectionClear();
    expect(document.activeElement).toBe(openCombobox);
    expect(document.activeElement).not.toBe(next);
  });

  it('Pil-navigation virker fra toggle/switch-fokus (checkbox)', async () => {
    const user = userEvent.setup();

    render(
      <Container>
        <div className="row--label-right-hover" style={{ position: 'fixed' }}>
          <input data-testid="toggle" type="checkbox" style={{ position: 'fixed' }} />
          <input data-testid="next" type="text" readOnly defaultValue="B" style={{ position: 'fixed' }} />
        </div>
      </Container>
    );

    const toggle = screen.getByTestId('toggle') as HTMLInputElement;
    const next = screen.getByTestId('next') as HTMLInputElement;

    toggle.focus();
    expect(document.activeElement).toBe(toggle);

    await user.keyboard('{ArrowRight}');
    await waitForSelectionClear();
    expect(document.activeElement).toBe(next);

    await user.keyboard('{ArrowLeft}');
    await waitForSelectionClear();
    expect(document.activeElement).toBe(toggle);
  });

  it('Tab til felt udenfor viewport scroller mod vertikal center', async () => {
    const user = userEvent.setup();

    render(
      <Container>
        <input data-testid="field1" type="text" style={{ position: 'fixed' }} />
        <input data-testid="field2" type="text" style={{ position: 'fixed' }} />
      </Container>
    );

    const container = document.querySelector('[data-mineo-scroll-container="true"]') as HTMLDivElement;
    const field1 = screen.getByTestId('field1') as HTMLInputElement;
    const field2 = screen.getByTestId('field2') as HTMLInputElement;

    Object.defineProperty(container, 'clientHeight', { configurable: true, value: 400 });
    Object.defineProperty(container, 'scrollHeight', { configurable: true, value: 3000 });
    Object.defineProperty(container, 'clientWidth', { configurable: true, value: 1000 });
    Object.defineProperty(container, 'scrollWidth', { configurable: true, value: 1000 });
    container.scrollTop = 0;
    container.scrollLeft = 0;

    const scrollToSpy = vi.spyOn(container, 'scrollTo');

    Object.defineProperty(container, 'getBoundingClientRect', {
      configurable: true,
      value: () =>
        ({
          x: 0,
          y: 0,
          width: 1000,
          height: 400,
          top: 0,
          left: 0,
          right: 1000,
          bottom: 400,
          toJSON: () => ({}),
        }) as DOMRect,
    });

    Object.defineProperty(field1, 'getBoundingClientRect', {
      configurable: true,
      value: () =>
        ({
          x: 10,
          y: 20,
          width: 100,
          height: 20,
          top: 20,
          left: 10,
          right: 110,
          bottom: 40,
          toJSON: () => ({}),
        }) as DOMRect,
    });

    Object.defineProperty(field2, 'getBoundingClientRect', {
      configurable: true,
      value: () =>
        ({
          x: 10,
          y: 900,
          width: 100,
          height: 20,
          top: 900,
          left: 10,
          right: 110,
          bottom: 920,
          toJSON: () => ({}),
        }) as DOMRect,
    });

    field1.focus();
    await user.keyboard('{Tab}');
    await waitForSelectionClear();

    expect(document.activeElement).toBe(field2);
    expect(scrollToSpy).toHaveBeenCalled();
    const lastCall = scrollToSpy.mock.calls[scrollToSpy.mock.calls.length - 1]?.[0] as ScrollToOptions;
    expect(lastCall.top).toBe(710);
  });

  it('ArrowDown/ArrowUp fra sidefelter kan gå ind i tabel over/under', async () => {
    const user = userEvent.setup();

    render(
      <Container>
        <input data-testid="above" type="text" readOnly style={{ position: 'fixed' }} />
        <table data-mineo-table-navigation="true">
          <tbody>
            <tr>
              <td>
                <input data-testid="table-cell" type="text" readOnly style={{ position: 'fixed' }} />
              </td>
            </tr>
          </tbody>
        </table>
        <input data-testid="below" type="text" readOnly style={{ position: 'fixed' }} />
      </Container>
    );

    const above = screen.getByTestId('above') as HTMLInputElement;
    const tableCell = screen.getByTestId('table-cell') as HTMLInputElement;
    const below = screen.getByTestId('below') as HTMLInputElement;

    Object.defineProperty(above, 'getBoundingClientRect', {
      configurable: true,
      value: () =>
        ({
          x: 10,
          y: 40,
          width: 100,
          height: 20,
          top: 40,
          left: 10,
          right: 110,
          bottom: 60,
          toJSON: () => ({}),
        }) as DOMRect,
    });
    Object.defineProperty(tableCell, 'getBoundingClientRect', {
      configurable: true,
      value: () =>
        ({
          x: 10,
          y: 140,
          width: 100,
          height: 20,
          top: 140,
          left: 10,
          right: 110,
          bottom: 160,
          toJSON: () => ({}),
        }) as DOMRect,
    });
    Object.defineProperty(below, 'getBoundingClientRect', {
      configurable: true,
      value: () =>
        ({
          x: 10,
          y: 260,
          width: 100,
          height: 20,
          top: 260,
          left: 10,
          right: 110,
          bottom: 280,
          toJSON: () => ({}),
        }) as DOMRect,
    });

    above.focus();
    await user.keyboard('{ArrowDown}');
    await waitForSelectionClear();
    expect(document.activeElement).toBe(tableCell);

    below.focus();
    await user.keyboard('{ArrowUp}');
    await waitForSelectionClear();
    expect(document.activeElement).toBe(tableCell);
  });

  it('ArrowUp/ArrowDown kan forlade tabel ved kant og følge side-regel (up->sidste, down->første)', async () => {
    const user = userEvent.setup();

    render(
      <Container>
        <div className="row--label-right-hover">
          <input data-testid="above-first" type="text" readOnly style={{ position: 'fixed' }} />
          <input data-testid="above-last" type="text" readOnly style={{ position: 'fixed' }} />
        </div>
        <StandardGridTable tableWidth="400px">
          <tbody>
            <tr data-mineo-row-id="r1">
              <td>
                <input data-testid="table-top" type="text" readOnly style={{ position: 'fixed' }} />
              </td>
            </tr>
            <tr data-mineo-row-id="r2">
              <td>
                <input data-testid="table-bottom" type="text" readOnly style={{ position: 'fixed' }} />
              </td>
            </tr>
          </tbody>
        </StandardGridTable>
        <div className="row--label-right-hover">
          <input data-testid="below-first" type="text" readOnly style={{ position: 'fixed' }} />
          <input data-testid="below-last" type="text" readOnly style={{ position: 'fixed' }} />
        </div>
      </Container>
    );

    const aboveFirst = screen.getByTestId('above-first') as HTMLInputElement;
    const aboveLast = screen.getByTestId('above-last') as HTMLInputElement;
    const tableTop = screen.getByTestId('table-top') as HTMLInputElement;
    const tableBottom = screen.getByTestId('table-bottom') as HTMLInputElement;
    const belowFirst = screen.getByTestId('below-first') as HTMLInputElement;
    const belowLast = screen.getByTestId('below-last') as HTMLInputElement;
    const aboveRow = aboveFirst.closest('.row--label-right-hover') as HTMLDivElement;
    const belowRow = belowFirst.closest('.row--label-right-hover') as HTMLDivElement;

    Object.defineProperty(aboveFirst, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ x: 10, y: 40, width: 100, height: 20, top: 40, left: 10, right: 110, bottom: 60, toJSON: () => ({}) }) as DOMRect,
    });
    Object.defineProperty(aboveLast, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ x: 220, y: 40, width: 100, height: 20, top: 40, left: 220, right: 320, bottom: 60, toJSON: () => ({}) }) as DOMRect,
    });
    Object.defineProperty(aboveRow, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ x: 0, y: 40, width: 600, height: 40, top: 40, left: 0, right: 600, bottom: 80, toJSON: () => ({}) }) as DOMRect,
    });
    Object.defineProperty(tableTop, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ x: 10, y: 140, width: 100, height: 20, top: 140, left: 10, right: 110, bottom: 160, toJSON: () => ({}) }) as DOMRect,
    });
    Object.defineProperty(tableBottom, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ x: 10, y: 240, width: 100, height: 20, top: 240, left: 10, right: 110, bottom: 260, toJSON: () => ({}) }) as DOMRect,
    });
    Object.defineProperty(belowFirst, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ x: 10, y: 340, width: 100, height: 20, top: 340, left: 10, right: 110, bottom: 360, toJSON: () => ({}) }) as DOMRect,
    });
    Object.defineProperty(belowLast, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ x: 220, y: 340, width: 100, height: 20, top: 340, left: 220, right: 320, bottom: 360, toJSON: () => ({}) }) as DOMRect,
    });
    Object.defineProperty(belowRow, 'getBoundingClientRect', {
      configurable: true,
      value: () => ({ x: 0, y: 340, width: 600, height: 40, top: 340, left: 0, right: 600, bottom: 380, toJSON: () => ({}) }) as DOMRect,
    });

    await act(async () => {
      tableTop.focus();
    });
    await user.keyboard('{ArrowUp}');
    await waitForSelectionClear();
    expect(document.activeElement).toBe(aboveLast);

    await act(async () => {
      tableBottom.focus();
    });
    await user.keyboard('{ArrowDown}');
    await waitForSelectionClear();
    expect(document.activeElement).toBe(belowFirst);
  });

  it('ArrowLeft/ArrowRight slipper ikke ud af tabel ved rækkekant', async () => {
    const user = userEvent.setup();

    render(
      <Container>
        <StandardGridTable tableWidth="400px">
          <tbody>
            <tr data-mineo-row-id="r1">
              <td>
                <input data-testid="table-left" type="text" readOnly style={{ position: 'fixed' }} />
              </td>
              <td>
                <input data-testid="table-right" type="text" readOnly style={{ position: 'fixed' }} />
              </td>
            </tr>
          </tbody>
        </StandardGridTable>
        <input data-testid="outside" type="text" readOnly style={{ position: 'fixed' }} />
      </Container>
    );

    const tableLeft = screen.getByTestId('table-left') as HTMLInputElement;
    const tableRight = screen.getByTestId('table-right') as HTMLInputElement;
    const outside = screen.getByTestId('outside') as HTMLInputElement;

    await act(async () => {
      tableRight.focus();
    });
    await user.keyboard('{ArrowRight}');
    await waitForSelectionClear();
    expect(document.activeElement).toBe(tableLeft);
    expect(document.activeElement).not.toBe(outside);

    await act(async () => {
      tableLeft.focus();
    });
    await user.keyboard('{ArrowLeft}');
    await waitForSelectionClear();
    expect(document.activeElement).toBe(tableRight);
    expect(document.activeElement).not.toBe(outside);
  });
});

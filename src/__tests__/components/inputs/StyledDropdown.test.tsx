// @vitest-environment jsdom
/// <reference types="vitest/globals" />
import React from 'react';
import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StyledDropdown from '../../../components/inputs/StyledDropdown';

type DemoValue = 'A' | 'B' | 'C';

const ControlledDropdown = ({
  initialValue = 'A',
  onClose,
}: {
  initialValue?: DemoValue;
  onClose?: () => void;
}) => {
  const [value, setValue] = React.useState<DemoValue>(initialValue);
  return (
    <>
      <StyledDropdown<DemoValue>
        allowEmpty={false}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onClose={onClose}
        placeholder="Vælg"
      >
        <MenuOption value="A">Alfa</MenuOption>
        <StyledDropdown.Divider />
        <MenuOption value="B">Beta</MenuOption>
        <MenuOption value="C">Charlie</MenuOption>
      </StyledDropdown>
      <button type="button">Næste felt</button>
    </>
  );
};

const MenuOption = <T extends string | number>({ children }: { value: T; disabled?: boolean; children: React.ReactNode }) => <>{children}</>;

describe('StyledDropdown', () => {
  it('lukker ikke på blur til element inde i listbox', async () => {
    const user = userEvent.setup();
    render(<ControlledDropdown />);

    const input = screen.getByRole('combobox');
    await user.click(input);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    const betaOption = screen.getByRole('option', { name: 'Beta' });
    fireEvent.blur(input, { relatedTarget: betaOption });

    expect(screen.getByRole('listbox')).toBeInTheDocument();
  });

  it('lukker på blur til element udenfor', async () => {
    const user = userEvent.setup();
    render(<ControlledDropdown />);

    const input = screen.getByRole('combobox');
    await user.click(input);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    const outsideButton = screen.getByText('Næste felt');
    fireEvent.blur(input, { relatedTarget: outsideButton });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('klik udenfor lukker kun én gang', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<ControlledDropdown onClose={onClose} />);

    const input = screen.getByRole('combobox');
    await user.click(input);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.mouseDown(document.body);
    fireEvent.blur(input, { relatedTarget: document.body });

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(input).toHaveFocus();
  });

  it('Tab når open lukker popover og flytter fokus videre', async () => {
    const user = userEvent.setup();
    render(<ControlledDropdown />);

    const input = screen.getByRole('combobox');
    await user.click(input);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    input.focus();
    await user.keyboard('{Tab}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Næste felt' })).toHaveFocus();
  });

  it('Escape lukker popover uden at ændre værdi eller udsende valg', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const Wrapper = () => {
      const [value, setValue] = React.useState<DemoValue>('A');
      return (
        <StyledDropdown<DemoValue>
          allowEmpty={false}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setValue(e.target.value);
          }}
          placeholder="Vælg"
        >
          <MenuOption value="A">Alfa</MenuOption>
          <MenuOption value="B">Beta</MenuOption>
        </StyledDropdown>
      );
    };
    render(<Wrapper />);

    const input = screen.getByRole('combobox') as HTMLInputElement;
    await user.click(input);
    expect(screen.getByRole('listbox')).toBeInTheDocument();
    // Naviger til en anden option for at bevise at Escape forkaster den uden at committe.
    await user.keyboard('{ArrowDown}');

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
    expect(input.value).toBe('Alfa');
  });

  it('Arrow navigation skipper divider', async () => {
    const user = userEvent.setup();
    render(<ControlledDropdown />);

    const input = screen.getByRole('combobox');
    await user.click(input);
    input.focus();

    await user.keyboard('{ArrowDown}');

    const activeDescendant = input.getAttribute('aria-activedescendant');
    expect(activeDescendant).toBeTruthy();
    expect(activeDescendant).toMatch(/-option-2$/);
  });

  it('ArrowDown åbner ikke dropdown når den er lukket', async () => {
    const user = userEvent.setup();
    render(<ControlledDropdown />);

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);

    await user.keyboard('{ArrowDown}');

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('typeahead hopper over divider og vælger option efter Enter', async () => {
    const user = userEvent.setup();
    render(<ControlledDropdown />);

    const input = screen.getByRole('combobox');
    await user.click(input);
    input.focus();

    await user.keyboard('b');
    expect(input.getAttribute('aria-activedescendant')).toMatch(/-option-2$/);

    await user.keyboard('{Enter}');
    expect((input as HTMLInputElement).value).toBe('Beta');
  });

  it('lukket typeahead starter med første match og cirkulerer ved gentagelse', async () => {
    const user = userEvent.setup();
    const Wrapper = () => {
      const [value, setValue] = React.useState<'fleks' | 'ferie'>('ferie');
      return (
        <StyledDropdown value={value} allowEmpty={false} onChange={(event) => setValue(event.target.value)}>
          <MenuOption value="fleks">Flekstilskud</MenuOption>
          <MenuOption value="ferie">Feriepenge</MenuOption>
        </StyledDropdown>
      );
    };
    render(<Wrapper />);

    const input = screen.getByRole('combobox');
    input.focus();

    await user.keyboard('f');
    expect(input).toHaveValue('Flekstilskud');

    await user.keyboard('f');
    expect(input).toHaveValue('Feriepenge');

    await user.keyboard('f');
    expect(input).toHaveValue('Flekstilskud');

    input.blur();
    input.focus();
    await user.keyboard('f');
    expect(input).toHaveValue('Flekstilskud');

    await user.keyboard('x');
    await user.keyboard('f');
    expect(input).toHaveValue('Flekstilskud');
  });

  it('fører disabled-optioner igennem til menuen og springer dem over ved typeahead', async () => {
    const user = userEvent.setup();
    render(
      <StyledDropdown value="aktiv" allowEmpty={false}>
        <MenuOption value="aktiv">Aktiv</MenuOption>
        <MenuOption value="blokeret" disabled>Blokeret</MenuOption>
      </StyledDropdown>
    );

    const input = screen.getByRole('combobox');
    input.focus();
    await user.keyboard('b');
    expect(input).toHaveValue('Aktiv');

    await user.click(input);
    expect(screen.getByRole('option', { name: 'Blokeret' })).toHaveAttribute('aria-disabled', 'true');
  });

  it('kaster i DEV når allowEmpty=false og value=undefined', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => {
      render(
        <StyledDropdown allowEmpty={false} value={undefined as never}>
          <MenuOption value="A">Alfa</MenuOption>
        </StyledDropdown>
      );
    }).toThrow('Ugyldig konfiguration: value mangler (allowEmpty=false)');

    errSpy.mockRestore();
  });

  it('viser placeholder for en valgfri værdi som ikke findes blandt options', () => {
    render(
      <StyledDropdown<DemoValue> value={'ukendt' as DemoValue} placeholder="Vælg">
        <MenuOption value="A">Alfa</MenuOption>
        <MenuOption value="B">Beta</MenuOption>
      </StyledDropdown>
    );

    expect(screen.getByRole('combobox')).toHaveValue('');
  });

  it('kopierer den viste label ved copy-genvej', async () => {
    const user = userEvent.setup();
    render(<ControlledDropdown initialValue="B" />);

    const input = screen.getByRole('combobox');
    await user.click(input);

    const clipboardData = {
      setData: vi.fn(),
    };
    const copyEvent = createEvent.copy(input);
    Object.defineProperty(copyEvent, 'clipboardData', { value: clipboardData });

    fireEvent(input, copyEvent);

    expect(clipboardData.setData).toHaveBeenCalledWith('text/plain', 'Beta');
    expect(copyEvent.defaultPrevented).toBe(true);
  });

  it('vælger matching option ved paste af præcis label', async () => {
    const user = userEvent.setup();
    render(<ControlledDropdown initialValue="A" />);

    const input = screen.getByRole('combobox');
    await user.click(input);
    expect((input as HTMLInputElement).value).toBe('Alfa');

    input.focus();
    await user.paste('Charlie');

    expect((input as HTMLInputElement).value).toBe('Charlie');
  });

  it('ignorerer paste når label ikke matcher en option præcist', async () => {
    const user = userEvent.setup();
    render(<ControlledDropdown initialValue="A" />);

    const input = screen.getByRole('combobox');
    await user.click(input);

    input.focus();
    await user.paste('charlie');

    expect((input as HTMLInputElement).value).toBe('Alfa');
  });
});

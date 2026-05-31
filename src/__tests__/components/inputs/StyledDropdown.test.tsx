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

const MenuOption = <T extends string | number>({ children }: { value: T; children: React.ReactNode }) => <>{children}</>;

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

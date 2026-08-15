// @vitest-environment jsdom
/// <reference types="vitest/globals" />
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StyledDropdown from '../../../components/inputs/StyledDropdown';

// VÆRN for tre fund i valg-kontrollen, som alle handler om at fejl og taster skal opføre sig som i
// resten af programmet:
//
//   1. Fejlbeskeden nåede kun ØJET. Kontrollen viste rød ramme + hover-tooltip, men havde hverken en
//      visuelt skjult besked eller `aria-describedby` — begge dele har tekstfelterne haft hele tiden
//      (`StyledTextFieldBase`). En skærmlæserbruger fik altså at vide AT feltet var forkert, aldrig hvad.
//   2. Escape på en LUKKET dropdown blev slugt (`preventDefault` + `stopPropagation`), selv om der
//      intet var at lukke. En omgivende dialog kunne derfor ikke lukkes med Escape, hvis fokus stod i
//      en af dens dropdowns.
//   3. Delete/Backspace med ÅBEN menu ryddede valget OG lukkede menuen i ét tryk — `gridUxSpec.ts`
//      giver kun ryddetasten til en LUKKET kontrol.

type DemoValue = 'A' | 'B';

const MenuOption = <T extends string | number>(
  { children }: { value: T; disabled?: boolean; children: React.ReactNode }
) => <>{children}</>;

const Harness = ({
  error = false,
  onEscape,
}: {
  error?: boolean;
  onEscape?: () => void;
}) => {
  const [value, setValue] = React.useState<DemoValue | undefined>('A');
  return (
    <div onKeyDown={(e) => { if (e.key === 'Escape') onEscape?.(); }}>
      <StyledDropdown<DemoValue>
        ariaLabel="Ydelsestype"
        allowEmpty
        value={value}
        onChange={(e: { target: { value: DemoValue | undefined } }) => setValue(e.target.value)}
        error={error}
        helperText={error ? 'Vælg en ydelsestype' : ''}
      >
        <MenuOption value="A">Alfa</MenuOption>
        <MenuOption value="B">Beta</MenuOption>
      </StyledDropdown>
    </div>
  );
};

describe('StyledDropdown — fejlformidling og tastesemantik', () => {
  it('binder fejlbeskeden til kontrollen, så den også når en skærmlæser', () => {
    render(<Harness error />);
    const combobox = screen.getByRole('combobox');
    const describedBy = combobox.getAttribute('aria-describedby');
    expect(describedBy).not.toBeNull();
    const description = document.getElementById(describedBy ?? '');
    expect(description?.textContent).toBe('Vælg en ydelsestype');
  });

  it('binder ingenting, når feltet er fejlfrit (måler den rigtige mekanisme)', () => {
    // Uden denne kontrast kunne testen ovenfor bestå af en attribut, der altid var sat.
    render(<Harness />);
    expect(screen.getByRole('combobox').getAttribute('aria-describedby')).toBeNull();
  });

  it('Escape på en LUKKET dropdown når den omgivende flade', async () => {
    const onEscape = vi.fn();
    const user = userEvent.setup();
    render(<Harness onEscape={onEscape} />);

    const combobox = screen.getByRole('combobox');
    combobox.focus();
    await user.keyboard('{Escape}');

    expect(onEscape).toHaveBeenCalledTimes(1);
  });

  it('Escape på en ÅBEN dropdown lukker KUN menuen og når ikke fladen', async () => {
    const onEscape = vi.fn();
    const user = userEvent.setup();
    render(<Harness onEscape={onEscape} />);

    const combobox = screen.getByRole('combobox');
    await user.click(combobox);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('listbox')).toBeNull();
    expect(onEscape).not.toHaveBeenCalled();
  });

  it('Delete med ÅBEN menu rydder ikke valget', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const combobox = screen.getByRole('combobox');
    await user.click(combobox);
    expect(screen.getByRole('listbox')).toBeInTheDocument();

    fireEvent.keyDown(combobox, { key: 'Delete' });

    expect(screen.getByRole('listbox')).toBeInTheDocument();
    expect(combobox).toHaveValue('Alfa');
  });

  it('Delete med LUKKET menu rydder valget (kontrasten der beviser at tasten virker)', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const combobox = screen.getByRole('combobox');
    combobox.focus();
    await user.keyboard('{Delete}');

    expect(combobox).toHaveValue('');
  });
});

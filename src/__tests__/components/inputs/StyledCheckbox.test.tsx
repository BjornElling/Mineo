// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StyledCheckbox from '../../../components/inputs/StyledCheckbox';

describe('StyledCheckbox', () => {
  it('viser en programinaktiv valgt checkbox uden hak og gendanner visningen ved reaktivering', () => {
    const onCommit = vi.fn();
    const { rerender } = render(
      <StyledCheckbox checked disabled label="Bilag" onCommit={onCommit} />
    );

    const checkbox = screen.getByRole('checkbox', { name: 'Bilag' });
    expect(checkbox).toBeDisabled();
    expect(checkbox).not.toBeChecked();
    expect(onCommit).not.toHaveBeenCalled();

    rerender(<StyledCheckbox checked label="Bilag" onCommit={onCommit} />);

    expect(screen.getByRole('checkbox', { name: 'Bilag' })).toBeChecked();
    expect(onCommit).not.toHaveBeenCalled();
  });

  // `lockedOn` er den MODSATTE tilstand af `disabled`: permanent tilvalg, ikke programinaktiv.
  // Testdataene sætter derfor `checked={false}`, så et grønt resultat ikke kan forklares af, at
  // værdien tilfældigvis var sand – kun låsningen kan give hakket.
  it('viser et låst-til element markeret, selv når den afsluttede værdi er falsk', () => {
    const onCommit = vi.fn();
    render(<StyledCheckbox checked={false} lockedOn label="Opgørelse" onCommit={onCommit} />);

    const checkbox = screen.getByRole('checkbox', { name: 'Opgørelse' });
    expect(checkbox).toBeChecked();
    expect(checkbox).toBeDisabled();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('viser et kombineret programinaktivt og låst felt umarkeret', () => {
    const onCommit = vi.fn();
    render(<StyledCheckbox checked disabled lockedOn label="Bilag" onCommit={onCommit} />);

    const checkbox = screen.getByRole('checkbox', { name: 'Bilag' });
    expect(checkbox).toBeDisabled();
    expect(checkbox).not.toBeChecked();
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('kan ikke fravælges med klik eller tastatur, og committer aldrig', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<StyledCheckbox checked lockedOn label="Opgørelse" onCommit={onCommit} />);

    const checkbox = screen.getByRole('checkbox', { name: 'Opgørelse' });
    await user.click(checkbox);
    expect(checkbox).toBeChecked();

    checkbox.focus();
    await user.keyboard(' ');
    await user.keyboard('{Enter}');

    expect(checkbox).toBeChecked();
    expect(onCommit).not.toHaveBeenCalled();
  });
});

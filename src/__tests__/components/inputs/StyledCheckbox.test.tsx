// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
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
});

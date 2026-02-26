import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import StyledPercentField from '../../../components/inputs/StyledPercentField';

describe('StyledPercentField', () => {
  it('giver fokus ved klik på procenttegn og åbner editor ved andet klik', async () => {
    const user = userEvent.setup();
    render(<StyledPercentField value={undefined} useDefaultPercentRange />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    const percentText = screen.getByText('%');
    const adornment = percentText.closest('.MuiInputAdornment-root') as HTMLElement;

    expect(adornment).not.toBeNull();
    expect(window.getComputedStyle(adornment).pointerEvents).toBe('none');

    const inputRoot = input.closest('.MuiOutlinedInput-root') as HTMLElement;
    expect(inputRoot).not.toBeNull();

    await user.click(inputRoot);
    expect(input).toHaveFocus();
    expect(input.readOnly).toBe(true);

    await user.click(inputRoot);
    expect(input.readOnly).toBe(false);
  });

  it('tillader commit over 100 når maxValue er højere', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();

    render(<StyledPercentField value={undefined} minValue={0} maxValue={200} onCommit={onCommit} />);

    const input = screen.getByRole('textbox') as HTMLInputElement;

    await user.click(input);
    await user.click(input);
    await user.type(input, '150,25');
    await user.tab();

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenLastCalledWith(
      expect.objectContaining({ target: { value: 150.25 } })
    );
  });

  it('accepterer værdi præcis på max-grænsen', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();

    render(<StyledPercentField value={undefined} minValue={0} maxValue={200} onCommit={onCommit} />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.click(input);
    await user.click(input);
    await user.type(input, '200,00');
    await user.tab();

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenLastCalledWith(
      expect.objectContaining({ target: { value: 200 } })
    );
  });

  it('afviser værdi lige over max-grænsen', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();

    render(<StyledPercentField value={undefined} minValue={0} maxValue={200} onCommit={onCommit} />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.click(input);
    await user.click(input);
    await user.type(input, '200,01');
    await user.tab();

    expect(onCommit).not.toHaveBeenCalled();
    const describedBy = input.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
    const errorEl = describedBy ? document.getElementById(describedBy) : null;
    expect(errorEl).toHaveTextContent('Procent skal være mellem 0,00 og 200,00');
  });
});

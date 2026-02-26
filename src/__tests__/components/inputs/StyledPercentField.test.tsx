import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
});

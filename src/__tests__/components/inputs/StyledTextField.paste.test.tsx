import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StyledTextField from '../../../components/inputs/StyledTextField';

describe('StyledTextField paste behavior', () => {
  it('keeps the editor closed when pasting into a focused field', async () => {
    const user = userEvent.setup();

    render(<StyledTextField value="" onCommit={vi.fn()} />);

    const input = screen.getByRole('textbox');

    await user.click(input);
    expect(input).toHaveAttribute('readonly');

    input.focus();
    await user.paste('hej');

    expect(input).toHaveValue('hej');
    expect(input).toHaveAttribute('readonly');
    expect(document.activeElement).toBe(input);
  });
});

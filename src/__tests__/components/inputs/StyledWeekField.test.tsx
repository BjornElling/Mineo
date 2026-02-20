import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StyledWeekField from '../../../components/inputs/StyledWeekField';

describe('StyledWeekField', () => {
  const TEST_TIMEOUT_MS = 15000;

  it('tillader redigering foran ugyldig /2022 efter genåbning', async () => {
    const user = userEvent.setup();

    const Wrapper = () => {
      const [value, setValue] = React.useState<string | undefined>('01/2022');
      return (
        <StyledWeekField
          value={value}
          onCommit={(e) => setValue(e.target.value)}
        />
      );
    };

    render(<Wrapper />);

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.click(input);
    input.setSelectionRange(0, 2);
    await user.keyboard('{Delete}');
    await user.tab();

    expect(input).toHaveValue('/2022');
    expect(screen.getByText('Ugyldigt format')).toBeInTheDocument();

    await user.click(input);
    await user.click(input);
    input.setSelectionRange(0, 0);
    await user.type(input, '1');

    expect(input).not.toHaveValue('/2022');
    expect(String((input as HTMLInputElement).value)).toContain('1');
  }, TEST_TIMEOUT_MS);
});

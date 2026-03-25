import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StyledIntegerField from '../../../components/inputs/StyledIntegerField';

describe('StyledIntegerField', () => {
  it('normalizes pasted text while editor is closed', async () => {
    const user = userEvent.setup();

    const Wrapper = () => {
      const [value, setValue] = React.useState<number | undefined>(undefined);
      return <StyledIntegerField value={value} maxDigits={4} onCommit={(e) => setValue(e.target.value)} />;
    };

    render(<Wrapper />);

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.paste(input, 'adffergregs//sgd1712,56//');
    await user.tab();

    expect(input).toHaveValue('1712');
  });

  it('normalizes pasted text while editor is open', async () => {
    const user = userEvent.setup();

    render(<StyledIntegerField value={undefined} maxDigits={4} />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.click(input);
    await user.click(input);
    await user.paste(input, 'adffergregs//sgd1712,56//');

    expect(input).toHaveValue('1712');
  });

  it('keeps pasted integer negative when the nearest real prefix character is minus and negatives are allowed', async () => {
    const user = userEvent.setup();

    const Wrapper = () => {
      const [value, setValue] = React.useState<number | undefined>(undefined);
      return <StyledIntegerField value={value} allowNegative onCommit={(e) => setValue(e.target.value)} />;
    };

    render(<Wrapper />);

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.paste(input, 'abc - 1712,56');
    await user.tab();

    expect(input).toHaveValue('-1712');
  });
});

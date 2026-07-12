// @vitest-environment jsdom
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StyledIntegerField from '../../../components/inputs/StyledIntegerField';

describe('StyledIntegerField', () => {
  it('genudleder en ikke-blokerende visual-fejl fra committed værdi', () => {
    const onFieldError = vi.fn();
    render(
      <StyledIntegerField
        value={11}
        minValue={0}
        maxValue={10}
        enforceRange={false}
        onFieldError={onFieldError}
      />
    );

    expect(screen.getByText('Værdi skal være mellem 0 og 10')).toBeInTheDocument();
    expect(onFieldError).toHaveBeenLastCalledWith({
      message: 'Værdi skal være mellem 0 og 10',
      blocksSave: false,
    });
  });

  it('normalizes pasted text while editor is closed', async () => {
    const user = userEvent.setup();

    const Wrapper = () => {
      const [value, setValue] = React.useState<number | undefined>(undefined);
      return <StyledIntegerField value={value} maxDigits={4} onCommit={(e) => {
        setValue(e.target.value);
        return true;
      }} />;
    };

    render(<Wrapper />);

    const input = screen.getByRole('textbox');
    await user.click(input);
    input.focus();
    await user.paste('adffergregs//sgd1712,56//');
    await user.tab();

    expect(input).toHaveValue('1712');
  });

  it('normalizes pasted text while editor is open', async () => {
    const user = userEvent.setup();

    render(<StyledIntegerField value={undefined} maxDigits={4} />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.click(input);
    await user.click(input);
    input.focus();
    await user.paste('adffergregs//sgd1712,56//');

    expect(input).toHaveValue('1712');
  });

  it('keeps pasted integer negative when the nearest real prefix character is minus and negatives are allowed', async () => {
    const user = userEvent.setup();

    const Wrapper = () => {
      const [value, setValue] = React.useState<number | undefined>(undefined);
      return <StyledIntegerField value={value} allowNegative onCommit={(e) => {
        setValue(e.target.value);
        return true;
      }} />;
    };

    render(<Wrapper />);

    const input = screen.getByRole('textbox');
    await user.click(input);
    input.focus();
    await user.paste('abc - 1712,56');
    await user.tab();

    expect(input).toHaveValue('-1712');
  });
});

import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StyledYearField from '../../../components/inputs/StyledYearField';

describe('StyledYearField', () => {
  it('normalizes pasted text while editor is closed', async () => {
    const user = userEvent.setup();

    const Wrapper = () => {
      const [value, setValue] = React.useState<number | undefined>(undefined);
      return <StyledYearField value={value} onCommit={(e) => setValue(e.target.value)} />;
    };

    render(<Wrapper />);

    const input = screen.getByRole('textbox');
    await user.click(input);
    input.focus();
    await user.paste('adffergregs//sgd1712,56//');
    await user.tab();

    expect(input).toHaveValue('1712');
  });
});

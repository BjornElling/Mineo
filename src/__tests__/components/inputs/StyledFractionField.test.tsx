import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StyledFractionField from '../../../components/inputs/StyledFractionField';

describe('StyledFractionField', () => {
  it('normalizes pasted text while editor is closed', async () => {
    const user = userEvent.setup();

    const Wrapper = () => {
      const [value, setValue] = React.useState<string | undefined>(undefined);
      return <StyledFractionField value={value} onCommit={(e) => setValue(e.target.value)} />;
    };

    render(<Wrapper />);

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.paste(input, 'adffergregs//sgd1712,56//');
    await user.tab();

    expect(input).toHaveValue('1712,56/');
  });
});

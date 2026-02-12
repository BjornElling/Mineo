import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { toISODateString, type ISODateString } from '../../../types/branded';
import StyledDateField from '../../../components/inputs/StyledDateField';

describe('StyledDateField', () => {
  it('commits cleared value on blur when cleared via Delete/Backspace while closed', async () => {
    const user = userEvent.setup();

    const Wrapper = () => {
      const [value, setValue] = React.useState<ISODateString | undefined>(toISODateString('2023-05-01'));
      return (
        <StyledDateField
          value={value}
          onCommit={(e) => setValue(e.target.value)}
        />
      );
    };

    render(<Wrapper />);

    const input = screen.getByDisplayValue('01-05-2023');
    await user.click(input);

    await user.keyboard('{Delete}');

    expect(screen.getByDisplayValue('')).toBeInTheDocument();

    // Blur should commit the cleared value (undefined), so the field stays empty.
    await user.tab();
    expect(screen.getByDisplayValue('')).toBeInTheDocument();
    expect(screen.queryByDisplayValue('01-05-2023')).toBeNull();
  });

  it('commits formatted date and shows range error when out of range', async () => {
    const user = userEvent.setup();
    const handleCommit = vi.fn();

    const Wrapper = () => {
      const [value, setValue] = React.useState<ISODateString | undefined>(undefined);
      return (
        <StyledDateField
          value={value}
          minDate={toISODateString('2020-01-01')}
          maxDate={toISODateString('2020-12-31')}
          onCommit={(e) => {
            handleCommit(e.target.value);
            setValue(e.target.value);
          }}
        />
      );
    };

    render(<Wrapper />);

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.type(input, '1-1-28');
    await user.tab();

    expect(handleCommit).toHaveBeenCalledWith(toISODateString('2028-01-01'));
    expect(input).toHaveValue('01-01-2028');
    expect(screen.getByText(/Dato skal/)).toBeInTheDocument();
  });

  it('does not commit invalid format and keeps draft with error', async () => {
    const user = userEvent.setup();
    const handleCommit = vi.fn();

    const Wrapper = () => {
      const [value, setValue] = React.useState<ISODateString | undefined>(undefined);
      return (
        <StyledDateField
          value={value}
          onCommit={(e) => {
            handleCommit(e.target.value);
            setValue(e.target.value);
          }}
        />
      );
    };

    render(<Wrapper />);

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.type(input, '1-1');
    await user.tab();

    expect(handleCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue('1-1');
    expect(screen.getByText('Ugyldig dato')).toBeInTheDocument();
  });

  it('tillader redigering foran ugyldig -2022 uden at tastetryk blokeres', async () => {
    const user = userEvent.setup();

    const Wrapper = () => {
      const [value, setValue] = React.useState<ISODateString | undefined>(toISODateString('2022-01-01'));
      return (
        <StyledDateField
          value={value}
          onCommit={(e) => setValue(e.target.value)}
        />
      );
    };

    render(<Wrapper />);

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.click(input);
    input.setSelectionRange(0, 5);
    await user.keyboard('{Delete}');
    await user.tab();

    expect(input).toHaveValue('-2022');
    expect(screen.getByText('Ugyldig dato')).toBeInTheDocument();

    await user.click(input);
    await user.click(input);
    input.setSelectionRange(0, 0);
    await user.type(input, '1');

    expect(input).not.toHaveValue('-2022');
    expect(String((input as HTMLInputElement).value)).toContain('1');
  });

});

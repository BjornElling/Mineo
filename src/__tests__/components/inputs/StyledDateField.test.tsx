// @vitest-environment jsdom
import * as React from 'react';
import { createEvent, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { isoToDanish, toISODateString, type ISODateString } from '../../../types/branded';
import StyledDateField from '../../../components/inputs/StyledDateField';
import { getTodayLocalISO } from '../../../utils/dateUtils';
import { insertTodayDate } from '../../../utils/insertTodayDate';

describe('StyledDateField', () => {
  it('genudleder en ikke-blokerende range-fejl fra committed værdi', () => {
    const onFieldError = vi.fn();
    render(
      <StyledDateField
        value={toISODateString('2028-01-01')}
        minDate={toISODateString('2020-01-01')}
        maxDate={toISODateString('2020-12-31')}
        onFieldError={onFieldError}
      />
    );

    expect(screen.getByText(/Dato skal/)).toBeInTheDocument();
    expect(onFieldError).toHaveBeenLastCalledWith(
      expect.objectContaining({ blocksSave: false })
    );
  });

  it('commits cleared value on blur when cleared via Delete/Backspace while closed', async () => {
    const user = userEvent.setup();

    const Wrapper = () => {
      const [value, setValue] = React.useState<ISODateString | undefined>(toISODateString('2023-05-01'));
      return (
        <StyledDateField
          value={value}
          onCommit={(e) => {
            setValue(e.target.value);
            return true;
          }}
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
            return true;
          }}
        />
      );
    };

    render(<Wrapper />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
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
            return true;
          }}
        />
      );
    };

    render(<Wrapper />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
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
          onCommit={(e) => {
            setValue(e.target.value);
            return true;
          }}
        />
      );
    };

    render(<Wrapper />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
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

  it('normalizes pasted text to date parts while editor is closed', async () => {
    const user = userEvent.setup();

    const Wrapper = () => {
      const [value, setValue] = React.useState<ISODateString | undefined>(undefined);
      return <StyledDateField value={value} onCommit={(e) => {
        setValue(e.target.value);
        return true;
      }} />;
    };

    render(<Wrapper />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.click(input);
    input.focus();
    await user.paste('adffergregs//sgd1712,56//');
    await user.tab();

    expect(input).toHaveValue('17-12-1956');
  });

  it('normalizes commas and other special characters to hyphens on commit', async () => {
    const user = userEvent.setup();

    const Wrapper = () => {
      const [value, setValue] = React.useState<ISODateString | undefined>(undefined);
      return <StyledDateField value={value} onCommit={(e) => {
        setValue(e.target.value);
        return true;
      }} />;
    };

    render(<Wrapper />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.click(input);
    await user.type(input, '1,1@28');
    await user.tab();

    expect(input).toHaveValue('01-01-2028');
  });

  it('committer ikke ufuldstændig dato med trailing separator', async () => {
    const user = userEvent.setup();
    const handleCommit = vi.fn();

    render(<StyledDateField value={undefined} onCommit={handleCommit} />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.click(input);
    await user.type(input, '1-1-2-');
    await user.tab();

    expect(handleCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue('1-1-2-');
    expect(screen.getByText('Ugyldig dato')).toBeInTheDocument();
  });

  it('rejects letters in date drafts', async () => {
    const user = userEvent.setup();

    render(<StyledDateField value={undefined} />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.click(input);
    await user.type(input, '1a1');

    expect(input).toHaveValue('11');
  });

  it('erstatter ugyldig draft med dags dato, selv når committed værdi allerede er dags dato', async () => {
    const user = userEvent.setup();
    const today = getTodayLocalISO();
    const expectedDisplay = isoToDanish(today);
    const handleCommit = vi.fn();

    const Wrapper = () => {
      const inputRef = React.useRef<HTMLInputElement>(null);
      const [value, setValue] = React.useState<ISODateString | undefined>(today);

      return (
        <>
          <StyledDateField
            value={value}
            inputRef={inputRef}
            onCommit={(e) => {
              handleCommit(e.target.value);
              setValue(e.target.value);
              return true;
            }}
          />
          <button
            type="button"
            onClick={() => insertTodayDate({
              onCommit: (nextToday) => {
                handleCommit(nextToday);
                setValue(nextToday);
              },
              focusRef: inputRef,
            })}
          >
            Indsæt dags dato
          </button>
        </>
      );
    };

    render(<Wrapper />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.click(input);
    await user.click(input);
    await user.keyboard('{Control>}a{/Control}1-1');

    expect(input).toHaveValue('1-1');

    await user.click(screen.getByRole('button', { name: 'Indsæt dags dato' }));

    expect(input).toHaveValue(expectedDisplay);
    expect(screen.queryByText('Ugyldig dato')).toBeNull();
    expect(handleCommit).toHaveBeenLastCalledWith(today);
  });

  it('copies the full field value while focused and editor is closed', async () => {
    const user = userEvent.setup();

    render(<StyledDateField value={toISODateString('2023-05-01')} />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.click(input);

    const clipboardData = {
      setData: vi.fn(),
      getData: vi.fn(),
    } as unknown as DataTransfer;
    const copyEvent = createEvent.copy(input);
    Object.defineProperty(copyEvent, 'clipboardData', { value: clipboardData });

    fireEvent(input, copyEvent);

    expect(clipboardData.setData).toHaveBeenCalledWith('text/plain', '01-05-2023');
    expect(copyEvent.defaultPrevented).toBe(true);
  });

});

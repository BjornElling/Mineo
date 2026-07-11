// @vitest-environment jsdom
import * as React from 'react';
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

  it('viser enheden både i hvile og under indtastning, uden for input-værdien', async () => {
    const user = userEvent.setup();
    render(<StyledPercentField value={12.5} useDefaultPercentRange />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    const adornment = screen.getByText('%').closest('.MuiInputAdornment-root') as HTMLElement;

    // I hvile: enheden er synlig, og input-værdien er rent tallet (enheden er ikke en del af værdien).
    expect(window.getComputedStyle(adornment).visibility).toBe('visible');
    expect(input).toHaveValue('12,5');

    // Under indtastning: enheden forbliver synlig, og værdien er stadig kun tallet.
    const inputRoot = input.closest('.MuiOutlinedInput-root') as HTMLElement;
    await user.click(inputRoot);
    await user.click(inputRoot);
    expect(input.readOnly).toBe(false);
    expect(window.getComputedStyle(adornment).visibility).toBe('visible');
    expect(input).toHaveValue('12,5');
  });

  it('bruger det konfigurerede maksimum under typing', async () => {
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

  it('accepterer 100 selv når maxValue er højere', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();

    render(<StyledPercentField value={undefined} minValue={0} maxValue={200} onCommit={onCommit} />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.click(input);
    await user.click(input);
    await user.type(input, '100,00');
    await user.tab();

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenLastCalledWith(
      expect.objectContaining({ target: { value: 100 } })
    );
  });

  it('committer en værdi uden for intervallet og rapporterer en ikke-blokerende fejl når enforceRange=false', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    const onFieldError = vi.fn();

    const Wrapper = () => {
      const [value, setValue] = React.useState<number | undefined>(undefined);
      return (
        <StyledPercentField
          value={value}
          minValue={0}
          maxValue={200}
          enforceRange={false}
          onCommit={(event) => {
            onCommit(event);
            setValue(event.target.value);
          }}
          onFieldError={onFieldError}
        />
      );
    };

    render(<Wrapper />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.click(input);
    await user.click(input);
    await user.type(input, '200,01');
    await user.tab();

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenLastCalledWith(
      expect.objectContaining({ target: { value: 200.01 } })
    );
    expect(screen.getByText('Procent skal være mellem 0,00 og 200,00')).toBeInTheDocument();
    expect(onFieldError).toHaveBeenLastCalledWith({
      message: 'Procent skal være mellem 0,00 og 200,00',
      blocksSave: false,
    });
  });

  it('blokerer commit over intervallet når enforceRange er valgt', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();

    render(
      <StyledPercentField
        value={undefined}
        minValue={0}
        maxValue={120}
        allowDecimals={false}
        enforceRange
        onCommit={onCommit}
      />
    );

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.click(input);
    await user.type(input, '121');
    await user.tab();

    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue('121');
    expect(screen.getByText('Procent skal være mellem 0 og 120')).toBeInTheDocument();
  });

  it('genudleder og rydder range-fejlen fra committed værdi og ændrede bounds når enforceRange=false', () => {
    const onFieldError = vi.fn();
    const { rerender } = render(
      <StyledPercentField value={150} minValue={0} maxValue={100} enforceRange={false} onFieldError={onFieldError} />
    );

    expect(screen.getByText('Procent skal være mellem 0,00 og 100,00')).toBeInTheDocument();
    expect(onFieldError).toHaveBeenLastCalledWith({
      message: 'Procent skal være mellem 0,00 og 100,00',
      blocksSave: false,
    });

    rerender(<StyledPercentField value={150} minValue={0} maxValue={200} enforceRange={false} onFieldError={onFieldError} />);

    expect(screen.queryByText('Procent skal være mellem 0,00 og 100,00')).toBeNull();
    expect(onFieldError).toHaveBeenLastCalledWith(undefined);
  });

  it('formaterer en eksternt sat værdi deterministisk med 2 decimaler (undo/redo/load uden commit)', () => {
    // En værdi der sættes via prop (undo/redo-restore, .eo-load) — uden at et commit kørte i
    // dette felt — SKAL formatere med feltets default-decimaler, ikke afhænge af tidligere
    // commit-historik. Værner mod, at det ref-baserede decimal-minde lækker på tværs af værdier.
    const { rerender } = render(<StyledPercentField value={12.5} useDefaultPercentRange />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    expect(input).toHaveValue('12,5');

    // Ny ekstern værdi (fx efter undo) skal også formatere deterministisk efter værdien alene —
    // det tidligere ref-baserede decimal-minde må ikke lække over på den nye værdi.
    rerender(<StyledPercentField value={7.25} useDefaultPercentRange />);
    expect(input).toHaveValue('7,25');
  });

  it('begrænser pasted tekst til feltets grammatiske cifferloft og afviser værdi uden for intervallet (default enforceRange)', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();

    render(<StyledPercentField value={undefined} useDefaultPercentRange onCommit={onCommit} />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.click(input);
    input.focus();
    await user.paste('adffergregs//sgd1712,56//');
    await user.tab();

    // Pasten grammatik-begrænses til cifferloftet (171), men 171 > 100 afvises straks i feltet:
    // værdien committes ikke og når derfor aldrig ind i beregningen (default enforceRange=true).
    expect(input).toHaveValue('171');
    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByText('Procent skal være mellem 0,00 og 100,00')).toBeInTheDocument();
  });

  it('afviser som default et typet tal uden for intervallet uden at committe', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();

    // Ingen enforceRange-prop → default true: værdien afvises i feltet frem for at committe.
    render(<StyledPercentField value={undefined} minValue={0} maxValue={100} onCommit={onCommit} />);

    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.click(input);
    await user.click(input);
    await user.type(input, '150');
    await user.tab();

    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue('150');
    expect(screen.getByText('Procent skal være mellem 0,00 og 100,00')).toBeInTheDocument();
  });
});

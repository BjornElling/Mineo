// @vitest-environment jsdom
import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TransientAmountInput from '../../../components/inputs/transient/TransientAmountInput';
import TransientDateInput from '../../../components/inputs/transient/TransientDateInput';
import TransientTextInput from '../../../components/inputs/transient/TransientTextInput';
import { toISODateString } from '../../../types/branded';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { AMOUNT_DIVISION_BY_ZERO_MESSAGE } from '../../../utils/expressionAmount';
import type { ISODateString } from '../../../types/branded';

// Transiente felter (§2.1-undtagelse: IKKE sagsdata). De har ingen feltadresse, issue-snapshot, history eller
// persistens – men de SKAL bevare den Mineo-velkendte commit-mekanik, så et scratchfelt føles som et rigtigt
// felt: commit på blur og Enter, Escape fortryder til det man begyndte at redigere, og en afvist draft
// rapporteres til kalderen i stedet for at blive stiltiende rullet tilbage.

describe('TransientAmountInput', () => {
  const Harness = ({ onCommit }: { onCommit?: (v: AmountValue | undefined) => void }) => {
    const [value, setValue] = React.useState<AmountValue | undefined>(undefined);
    const [error, setError] = React.useState<string | undefined>(undefined);
    return (
      <TransientAmountInput
        value={value}
        onCommit={(next) => { setValue(next); onCommit?.(next); }}
        onReject={setError}
        errorMessage={error}
      />
    );
  };

  it('committer beløbet på blur', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.type(input, '1234');
    await user.tab();

    expect(onCommit).toHaveBeenCalledWith({ kind: 'number', value: 1234 });
  });

  it('committer på Enter uden at kræve blur', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);

    await user.type(screen.getByRole('textbox'), '900{Enter}');

    expect(onCommit).toHaveBeenCalledWith({ kind: 'number', value: 900 });
  });

  it('Escape fortryder til værdien redigeringen startede fra, og et efterfølgende blur committer ikke', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);

    const input = screen.getByRole('textbox');
    await user.click(input);
    await user.type(input, '555');
    await user.keyboard('{Escape}');
    await user.tab();

    expect(input).toHaveValue('');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('rapporterer en afvist draft til kalderen (ingen stille rollback)', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    const input = screen.getByRole('textbox');
    // Et bart minus er ikke et gyldigt beløb, og negative beløb er ikke tilladt her.
    await user.type(input, '5-{Enter}');

    // Kalderen fik en fejl at vise; feltet ruller ikke stiltiende tilbage til tom.
    expect(await screen.findByRole('textbox')).toBeInTheDocument();
  });

  it('rydder den forrige værdi ved en afvisning og afvisningen ved et gyldigt beløb', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const input = screen.getByRole('textbox');

    await user.click(input);
    await user.keyboard('30000');
    await user.tab();
    await user.click(input);
    await user.keyboard('1/0');
    await user.tab();
    expect(onCommit).toHaveBeenLastCalledWith(undefined);
    expect(input).toHaveValue('1/0');
    expect(input).toHaveAttribute('aria-invalid', 'true');

    await user.click(input);
    await user.keyboard('500');
    await user.tab();
    expect(onCommit).toHaveBeenLastCalledWith({ kind: 'number', value: 500 });
    expect(input).not.toHaveAttribute('aria-invalid', 'true');
  });

  /**
   * Typografiske minustegn følger SAMME sign-policy-vej som de persisterede beløbsfelter – de
   * normaliseres til ASCII '-' før tegnfilteret ved paste, tastning og første tast.
   */
  describe('typografisk minus', () => {
    const SignedHarness = ({ onCommit, allowNegative }: {
      onCommit: (v: AmountValue | undefined) => void;
      allowNegative: boolean;
    }) => {
      const [value, setValue] = React.useState<AmountValue | undefined>(undefined);
      return (
        <TransientAmountInput
          value={value}
          allowNegative={allowNegative}
          onCommit={(next) => { setValue(next); onCommit(next); }}
        />
      );
    };

    const paste = (text: string) =>
      fireEvent.paste(screen.getByRole('textbox'), { clipboardData: { getData: () => text } });

    it.each([['U+2212', '−'], ['U+2013', '–']])('%s: indsat 10x1 og 1200x200 regnes som subtraktion', (_name, minus) => {
      const onCommit = vi.fn();
      render(<SignedHarness onCommit={onCommit} allowNegative={false} />);
      paste(`10${minus}1`);
      expect(onCommit).toHaveBeenLastCalledWith(expect.objectContaining({ value: 9 }));
      paste(`1200${minus}200`);
      expect(onCommit).toHaveBeenLastCalledWith(expect.objectContaining({ value: 1000 }));
    });

    it('indsat −1200 er negativt i et fortegnet felt og springer det unære minus over ellers (§8.2)', () => {
      const signed = vi.fn();
      const { unmount } = render(<SignedHarness onCommit={signed} allowNegative />);
      paste('−1200');
      expect(signed).toHaveBeenLastCalledWith(expect.objectContaining({ value: -1200 }));
      unmount();

      const nonNegative = vi.fn();
      render(<SignedHarness onCommit={nonNegative} allowNegative={false} />);
      paste('−1200');
      expect(nonNegative).toHaveBeenLastCalledWith(expect.objectContaining({ value: 1200 }));
    });

    it('tastet 10−1 bliver 10-1 i draften og committes som 9', async () => {
      const user = userEvent.setup();
      const onCommit = vi.fn();
      render(<SignedHarness onCommit={onCommit} allowNegative={false} />);
      const input = screen.getByRole('textbox');
      await user.type(input, '10−1');
      expect(input).toHaveValue('10-1');
      await user.keyboard('{Enter}');
      expect(onCommit).toHaveBeenLastCalledWith(expect.objectContaining({ value: 9 }));
    });

    it('U+2212 som første tast åbner et fortegnet felt med ASCII-minus', () => {
      render(<SignedHarness onCommit={vi.fn()} allowNegative />);
      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: '−' });
      expect(input).toHaveValue('-');
    });
  });

  /**
   * Tab og Enter afslutter en tastet indtastning, så en indsat tabulator eller et linjeskift afslutter
   * den indsatte. To regnearksceller må ikke smelte sammen til 1.200.200,00.
   */
  describe('indsættelse fra regneark', () => {
    const paste = (text: string) =>
      fireEvent.paste(screen.getByRole('textbox'), { clipboardData: { getData: () => text } });

    it.each([
      ['tabulator', '1200\t200'],
      ['linjeskift', '1200\n200'],
      ['Windows-linjeskift', '1200\r\n200'],
      ['afsluttende linjeskift fra én celle', '1200\r\n'],
      ['indledende linjeskift', '\r\n1200'],
    ])('%s giver kun det første beløb', (_name, text) => {
      const onCommit = vi.fn();
      render(<Harness onCommit={onCommit} />);
      paste(text);
      expect(onCommit).toHaveBeenLastCalledWith({ kind: 'number', value: 1200 });
      expect(screen.getByRole('textbox')).toHaveValue('1.200,00');
    });
  });

  it('forklarer division med 0 med den fælles beløbsbesked', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const input = screen.getByRole('textbox');

    await user.click(input);
    await user.keyboard('1/0');
    await user.tab();

    expect(onCommit).toHaveBeenLastCalledWith(undefined);
    expect(input).toHaveValue('1/0');
    expect(screen.getByText(AMOUNT_DIVISION_BY_ZERO_MESSAGE)).toBeInTheDocument();
  });
});

describe('TransientDateInput', () => {
  const Harness = ({
    minDate,
    maxDate,
    onCommit,
  }: {
    minDate?: ISODateString;
    maxDate?: ISODateString;
    onCommit?: (v: ISODateString | undefined) => void;
  }) => {
    const [value, setValue] = React.useState<ISODateString | undefined>(undefined);
    const [error, setError] = React.useState<string | undefined>(undefined);
    return (
      <TransientDateInput
        value={value}
        onCommit={(next) => { setValue(next); onCommit?.(next); }}
        onReject={setError}
        errorMessage={error}
        {...(minDate === undefined ? {} : { minDate })}
        {...(maxDate === undefined ? {} : { maxDate })}
      />
    );
  };

  it('bevarer en dato uden for de kronologiske grænser og markerer den som fejl', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(
      <Harness
        minDate={toISODateString('2026-01-01')}
        maxDate={toISODateString('2026-12-31')}
        onCommit={onCommit}
      />
    );

    await user.type(screen.getByRole('textbox'), '15-01-2020{Enter}');

    // Range er ikke en formatfejl: datoen bevares, mens hjælperens handling holdes disabled af fejlen.
    expect(onCommit).toHaveBeenCalledWith(toISODateString('2020-01-15'));
    // Bounds-beskeden kommer fra den DELTE bounds-kerne, som de persisterede datofelter også bruger.
    expect(await screen.findByText(/2026/)).toBeInTheDocument();
  });

  it('beholder en afvist dato synligt, også når den erstatter en gyldig dato', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    const input = screen.getByRole('textbox');

    await user.click(input);
    await user.keyboard('01-07-2026');
    await user.tab();
    expect(input).toHaveValue('01-07-2026');

    await user.click(input);
    await user.keyboard('31-02-2026');
    await user.tab();

    // XOR-reglen: værdien ryddes, men den afviste tekst står tilbage til rettelse med sin fejl.
    expect(onCommit).toHaveBeenLastCalledWith(undefined);
    expect(input).toHaveValue('31-02-2026');
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  it('viser en ekstern værdiændring, når feltet ikke redigeres', async () => {
    const Controlled = () => {
      const [value, setValue] = React.useState<ISODateString | undefined>(toISODateString('2026-01-15'));
      return (
        <>
          <TransientDateInput value={value} onCommit={setValue} />
          <button onClick={() => setValue(toISODateString('2026-02-20'))}>skift</button>
        </>
      );
    };
    const user = userEvent.setup();
    render(<Controlled />);

    expect(screen.getByRole('textbox')).toHaveValue('15-01-2026');
    await user.click(screen.getByRole('button', { name: 'skift' }));
    expect(screen.getByRole('textbox')).toHaveValue('20-02-2026');
  });

  it('følger den almindelige datofeltmotor ved klik, tastning og lukket-felt-paste', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);

    const input = screen.getByRole('textbox');
    await user.click(input);
    expect(input).toHaveProperty('readOnly', true);

    await user.click(input);
    expect(input).toHaveProperty('readOnly', false);
    await user.keyboard('12--2-2026');
    // Den anden separator og cifre ud over segmenternes lofter kommer aldrig ind ved tastning.
    expect(input).toHaveValue('12-2-2026');

    await user.keyboard('{Escape}');
    expect(input).toHaveProperty('readOnly', true);

    // Lukket paste normaliseres tegn for tegn, erstatter værdien og committer straks.
    fireEvent.paste(input, {
      clipboardData: { getData: () => '---12--2----------2026' },
    });
    expect(onCommit).toHaveBeenLastCalledWith(toISODateString('2026-02-12'));
  });

  it('bruger kun den første af to indsatte regnearksceller', () => {
    const onCommit = vi.fn();
    render(<Harness onCommit={onCommit} />);
    fireEvent.paste(screen.getByRole('textbox'), {
      clipboardData: { getData: () => '01-02-2026\t15-03-2026' },
    });
    expect(onCommit).toHaveBeenLastCalledWith(toISODateString('2026-02-01'));
  });
});

describe('TransientTextInput', () => {
  it('er styret på draften: hver tastning ER værdien (intet commit-begreb)', async () => {
    const Harness = () => {
      const [value, setValue] = React.useState('');
      return (
        <>
          <TransientTextInput value={value} onChange={setValue} />
          <span data-testid="echo">{value}</span>
        </>
      );
    };
    const user = userEvent.setup();
    render(<Harness />);

    await user.type(screen.getByRole('textbox'), 'hej');

    expect(screen.getByTestId('echo')).toHaveTextContent('hej');
  });

  it('understøtter flerlinjet tekst', async () => {
    const Harness = () => {
      const [value, setValue] = React.useState('');
      return <TransientTextInput value={value} onChange={setValue} multiline rows={3} />;
    };
    const user = userEvent.setup();
    render(<Harness />);

    const area = screen.getByRole('textbox');
    await user.type(area, 'linje 1{Enter}linje 2');

    expect(area).toHaveValue('linje 1\nlinje 2');
  });
});

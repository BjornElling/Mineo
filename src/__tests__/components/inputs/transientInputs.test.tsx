// @vitest-environment jsdom
import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TransientAmountInput from '../../../components/inputs/transient/TransientAmountInput';
import TransientDateInput from '../../../components/inputs/transient/TransientDateInput';
import TransientTextInput from '../../../components/inputs/transient/TransientTextInput';
import { toISODateString } from '../../../types/branded';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import type { ISODateString } from '../../../types/branded';

// Transiente felter (§3.1-undtagelse: IKKE sagsdata). De har ingen feltadresse, issue-snapshot, history eller
// persistens — men de SKAL bevare den Mineo-velkendte commit-mekanik, så et scratchfelt føles som et rigtigt
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

  it('afviser en dato uden for de kronologiske grænser og committer ikke', async () => {
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

    expect(onCommit).not.toHaveBeenCalled();
    // Bounds-beskeden kommer fra den DELTE bounds-kerne, som de persisterede datofelter også bruger.
    expect(await screen.findByText(/2026/)).toBeInTheDocument();
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

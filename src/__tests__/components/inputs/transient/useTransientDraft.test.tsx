// @vitest-environment jsdom
import * as React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import TransientAmountInput from '../../../../components/inputs/transient/TransientAmountInput';
import TransientDateInput from '../../../../components/inputs/transient/TransientDateInput';
import type { AmountValue } from '../../../../schemas/amountExpressionSchema';
import type { ISODateString } from '../../../../types/branded';

// Transient input (§3.1-undtagelsen): de FÅ flader, hvor et input ikke er sagsdata — overlay-/dialog-scratchfelter.
// De har hverken feltadresse, issue-snapshot, rejectedInputs, history eller persistens, men de skal bevare den
// Mineo-velkendte blur-/Enter-commit-mekanik, så de føles som rigtige felter.
//
// Dækningen her genetablerer de UX-invarianter, som de slettede Styled*Field-tests dækkede på den gamle vej:
// blur-commit, Enter-commit, Escape-fortryd UDEN et efterfølgende blur-commit, afvist draft, ekstern resync
// og beløbsparsing gennem den delte kerne.

/** Controlled wrapper: holder den committede værdi, som en dialog/overlay ville gøre. */
const AmountHarness: React.FC<Readonly<{
  initial?: AmountValue;
  onCommitSpy?: (next: AmountValue | undefined) => void;
}>> = ({ initial, onCommitSpy }) => {
  const [value, setValue] = React.useState<AmountValue | undefined>(initial);
  const [error, setError] = React.useState<string | undefined>(undefined);
  return (
    <>
      <TransientAmountInput
        value={value}
        onCommit={(next) => {
          setError(undefined);
          setValue(next);
          onCommitSpy?.(next);
        }}
        onReject={(message) => setError(message)}
        errorMessage={error}
        aria-label="beloeb"
      />
      <span data-testid="committed">{value === undefined ? '-' : String(value.value)}</span>
      <button type="button">anden fokus</button>
    </>
  );
};

const amount = (value: number): AmountValue => ({ kind: 'number', value });

describe('transient input: commit-mekanik', () => {
  it('committer draften ved blur', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<AmountHarness onCommitSpy={onCommit} />);

    await user.click(screen.getByLabelText('beloeb'));
    await user.keyboard('1234');
    await user.click(screen.getByRole('button', { name: 'anden fokus' }));

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('committed')).toHaveTextContent('1234');
  });

  it('committer draften ved Enter uden at kræve blur', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<AmountHarness onCommitSpy={onCommit} />);

    await user.click(screen.getByLabelText('beloeb'));
    await user.keyboard('5000{Enter}');

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('committed')).toHaveTextContent('5000');
  });

  it('Escape fortryder — og det EFTERFØLGENDE blur må ikke committe den forkastede draft', async () => {
    // Kerne-invarianten. Uden `suppressNextBlurCommitRef` ville blur'et efter Escape committe den tekst,
    // brugeren netop har fortrudt.
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<AmountHarness initial={amount(1000)} onCommitSpy={onCommit} />);

    await user.click(screen.getByLabelText('beloeb'));
    await user.keyboard('{Control>}a{/Control}9999');
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'anden fokus' }));

    expect(onCommit).not.toHaveBeenCalled();
    expect(screen.getByTestId('committed')).toHaveTextContent('1000');
  });

  it('gentagne Enter på en uændret draft committer højst én gang (no-op-detektion)', async () => {
    // Bevidst design (`useTransientDraft.ts:62-74`): den FØRSTE commit må ikke være en falsk no-op, så den
    // udføres, selv om draften er lig den formaterede værdi. Efterfølgende Enter på samme råtekst er no-op.
    // Værdien er desuden idempotent, så det første ekstra commit ikke ændrer noget for brugeren.
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<AmountHarness initial={amount(2500)} onCommitSpy={onCommit} />);

    await user.click(screen.getByLabelText('beloeb'));
    await user.keyboard('{Enter}{Enter}{Enter}');

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('committed')).toHaveTextContent('2500');
  });

  it('uparsebar tekst RYDDER feltet — samme regel som de persisterede beløbsfelter', async () => {
    // `parseAmountInput` returnerer `ok` uden værdi for tekst, der ikke er et beløb; det committes derfor som
    // "tomt" i stedet for at blive afvist. Transientfeltet arver bevidst den delte kernes regel, så et
    // overlay-beløb opfører sig som et rigtigt beløbsfelt.
    const user = userEvent.setup();
    render(<AmountHarness initial={amount(1000)} />);

    await user.click(screen.getByLabelText('beloeb'));
    await user.keyboard('{Control>}a{/Control}ikke-et-beloeb{Enter}');

    expect(screen.getByTestId('committed')).toHaveTextContent('-');
  });

  it('parser et regneudtryk gennem den DELTE beløbskerne', async () => {
    // Samme parse-kerne som de persisterede beløbsfelter (`parseAmountInput`), så indtastningsreglerne er ens.
    const user = userEvent.setup();
    const onCommit = vi.fn();
    render(<AmountHarness onCommitSpy={onCommit} />);

    await user.click(screen.getByLabelText('beloeb'));
    await user.keyboard('1000+500{Enter}');

    expect(screen.getByTestId('committed')).toHaveTextContent('1500');
  });
});

describe('transient input: ekstern resync', () => {
  const ResyncHarness: React.FC = () => {
    const [value, setValue] = React.useState<AmountValue | undefined>(amount(100));
    return (
      <>
        <TransientAmountInput value={value} onCommit={setValue} aria-label="beloeb" />
        <button type="button" onClick={() => setValue(amount(777))}>ekstern</button>
      </>
    );
  };

  it('overtager en ny ekstern værdi, når feltet IKKE er fokuseret', async () => {
    const user = userEvent.setup();
    render(<ResyncHarness />);

    await user.click(screen.getByRole('button', { name: 'ekstern' }));

    expect(screen.getByLabelText('beloeb')).toHaveValue('777,00');
  });

  it('trækker ALDRIG brugerens indtastning væk, når en EKSTERN ændring sker under fokus', async () => {
    // Uden fokus-guarden ville den eksterne opdatering overskrive draften under fingrene.
    // ⚠️ Testen SKAL faktisk udløse den eksterne ændring, mens feltet har fokus — ellers beviser den intet.
    const user = userEvent.setup();
    render(<ResyncHarness />);

    const input = screen.getByLabelText('beloeb');
    await user.click(input);
    await user.keyboard('{Control>}a{/Control}42');
    expect(input).toHaveValue('42');

    // Den eksterne ændring sker nu, MENS feltet stadig har fokus. Knappen fokuseres bevidst ikke:
    // `fireEvent.click` flytter ikke fokus, så inputtet forbliver det aktive element.
    expect(document.activeElement).toBe(input);
    fireEvent.click(screen.getByRole('button', { name: 'ekstern' }));

    // Draften er urørt — brugeren mister ikke sin indtastning.
    expect(document.activeElement).toBe(input);
    expect(input).toHaveValue('42');

    // Først når feltet forlades, overtager den committede værdi visningen. Blur committer draften (42),
    // så den EKSTERNE værdi (777) er bevidst overskrevet af brugerens eget input.
    await user.tab();
    expect(input).toHaveValue('42,00');
  });
});

describe('TransientDateInput', () => {
  const DateHarness: React.FC = () => {
    const [value, setValue] = React.useState<ISODateString | undefined>(undefined);
    return (
      <>
        <TransientDateInput value={value} onCommit={setValue} aria-label="dato" />
        <span data-testid="committed">{value ?? '-'}</span>
      </>
    );
  };

  const BoundedHarness: React.FC = () => {
    const [value, setValue] = React.useState<ISODateString | undefined>(undefined);
    const [error, setError] = React.useState<string | undefined>(undefined);
    return (
      <>
        <TransientDateInput
          value={value}
          onCommit={setValue}
          onReject={setError}
          errorMessage={error}
          minDate={'2026-01-10' as ISODateString}
          maxDate={'2026-01-20' as ISODateString}
          aria-label="dato"
        />
        <span data-testid="committed">{value ?? '-'}</span>
        <span data-testid="fejl">{error ?? '-'}</span>
      </>
    );
  };

  it('committer en dato ved Enter og normaliserer visningen', async () => {
    const user = userEvent.setup();
    render(<DateHarness />);

    const input = screen.getByLabelText('dato');
    await user.click(input);
    await user.keyboard('15-01-2026');
    expect(input).toHaveValue('15-01-2026');

    await user.keyboard('{Enter}');

    expect(screen.getByTestId('committed')).toHaveTextContent('2026-01-15');
    // Enter lukker den almindelige to-trins-editor, så den canonical danske visning overtager straks.
    expect(input).toHaveValue('15-01-2026');
  });

  it('afviser en dato uden for de angivne grænser', async () => {
    // Regressionsværn for bounds-stien: `resolveDateRangeErrorMessage` melder "ingen fejl" med en TOM STRENG.
    // En `!== undefined`-test afviste derfor tidligere ENHVER dato — også de gyldige — med en tom besked.
    const user = userEvent.setup();
    render(<BoundedHarness />);

    const input = screen.getByLabelText('dato');
    await user.click(input);
    await user.keyboard('01022026{Enter}');

    expect(screen.getByTestId('committed')).toHaveTextContent('-');
    expect(screen.getByTestId('fejl').textContent).not.toBe('-');
  });

  it('committer en dato inden for de angivne grænser', async () => {
    const user = userEvent.setup();
    render(<BoundedHarness />);

    const input = screen.getByLabelText('dato');
    await user.click(input);
    await user.click(input);
    await user.keyboard('{Control>}a{/Control}15-01-2026{Enter}');

    expect(screen.getByTestId('committed')).toHaveTextContent('2026-01-15');
  });
});

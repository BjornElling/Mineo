import * as React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StyledTextField from '../../../components/inputs/StyledTextField';
import StyledAmountField from '../../../components/inputs/StyledAmountField';
import StyledDateField from '../../../components/inputs/StyledDateField';
import StyledPercentField from '../../../components/inputs/StyledPercentField';
import StyledIntegerField from '../../../components/inputs/StyledIntegerField';
import StyledYearField from '../../../components/inputs/StyledYearField';
import StyledWeekField from '../../../components/inputs/StyledWeekField';
import StyledFractionField from '../../../components/inputs/StyledFractionField';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';
import { toISODateString } from '../../../types/branded';

/**
 * Escape-kontrakt for ALLE almindelige (ikke-tabel) styled-felter.
 *
 * Felterne deler to-trins-aktivering (klik 1 fokuserer read-only, klik 2 ELLER første
 * tastetryk åbner editoren) og Escape-cancel (gendan den committede værdi, intet commit).
 * Denne kontrakt verificerer at Escape opfører sig korrekt UANSET hvordan editoren blev
 * åbnet — det er afgørende, fordi de to åbningsveje sætter draften på forskellige tidspunkter:
 *
 *  - dobbeltklik: editoren åbnes FØR nogen tast → draften ændres først bagefter.
 *  - tastetryk:   første tast åbner editoren OG sætter draften til tegnet i samme ombæring.
 *
 * Regressionen i StyledTextField (det programmatiske caret-re-fokus gen-tog focus-snapshot'et
 * efter at draften allerede indeholdt første-karakteren, så Escape bevarede "a") ramte kun
 * tastetryk-vejen. Adapter-felterne (useStyledFieldAdapter) videregiver bevidst IKKE
 * editableElementRef til to-trins-hook'en og kører derfor aldrig det re-fokus — kontrakten
 * fastholder at de forbliver immune.
 */

type EscapeFieldCase = Readonly<{
  label: string;
  /** Den committede værdi feltet starter med (afgør den display-streng Escape skal gendanne). */
  renderManaged: (onCommit: (next: unknown) => void) => React.JSX.Element;
  /**
   * Streng der tastes efter editoren er åben. Første tegn SKAL være en gyldig aktiveringstast
   * (digit for numeriske felter, bogstav for fri tekst), så tastetryk-vejen kan åbne editoren.
   */
  typed: string;
}>;

const FIELD_CASES: readonly EscapeFieldCase[] = [
  {
    label: 'text',
    renderManaged: (onCommit) => <ManagedField<string> initial="foo" render={(value, commit) => <StyledTextField value={value} onCommit={(e) => commit(e.value)} />} onCommit={onCommit} />,
    typed: 'bar',
  },
  {
    label: 'amount',
    renderManaged: (onCommit) => (
      <ManagedField<AmountValue | undefined>
        initial={{ kind: 'number', value: 12.5 }}
        render={(value, commit) => <StyledAmountField value={value} onCommit={(e) => commit(e.value)} />}
        onCommit={onCommit}
      />
    ),
    typed: '33',
  },
  {
    label: 'date',
    renderManaged: (onCommit) => (
      <ManagedField
        initial={toISODateString('2025-01-01')}
        render={(value, commit) => <StyledDateField value={value} onCommit={(e) => commit(e.value)} />}
        onCommit={onCommit}
      />
    ),
    typed: '15062025',
  },
  {
    label: 'percent',
    renderManaged: (onCommit) => (
      <ManagedField<number | undefined>
        initial={12.5}
        render={(value, commit) => <StyledPercentField value={value} useDefaultPercentRange onCommit={(e) => commit(e.value)} />}
        onCommit={onCommit}
      />
    ),
    typed: '33',
  },
  {
    label: 'integer',
    renderManaged: (onCommit) => (
      <ManagedField<number | undefined>
        initial={42}
        render={(value, commit) => <StyledIntegerField value={value} onCommit={(e) => commit(e.value)} />}
        onCommit={onCommit}
      />
    ),
    typed: '99',
  },
  {
    label: 'year',
    renderManaged: (onCommit) => (
      <ManagedField<number | undefined>
        initial={2025}
        render={(value, commit) => <StyledYearField value={value} onCommit={(e) => commit(e.value)} />}
        onCommit={onCommit}
      />
    ),
    typed: '2099',
  },
  {
    label: 'week',
    renderManaged: (onCommit) => (
      <ManagedField<string | undefined>
        initial="01/2025"
        render={(value, commit) => <StyledWeekField value={value} onCommit={(e) => commit(e.value)} />}
        onCommit={onCommit}
      />
    ),
    typed: '052024',
  },
  {
    label: 'fraction',
    renderManaged: (onCommit) => (
      <ManagedField<string | undefined>
        initial="50"
        render={(value, commit) => <StyledFractionField value={value} onCommit={(e) => commit(e.value)} />}
        onCommit={onCommit}
      />
    ),
    typed: '33',
  },
];

/** Lille controlled-wrapper: holder feltets værdi, så et utilsigtet commit ville blive synligt. */
function ManagedField<TValue>({
  initial,
  render,
  onCommit,
}: Readonly<{
  initial: TValue;
  render: (value: TValue, commit: (next: TValue) => void) => React.JSX.Element;
  onCommit: (next: unknown) => void;
}>): React.JSX.Element {
  const [value, setValue] = React.useState<TValue>(initial);
  return render(value, (next) => {
    onCommit(next);
    setValue(next);
  });
}

const openByDoubleClick = async (user: ReturnType<typeof userEvent.setup>, input: HTMLInputElement, typed: string) => {
  await user.click(input);
  await user.click(input);
  await waitFor(() => expect(input).not.toHaveAttribute('readonly'));
  await user.clear(input);
  await user.type(input, typed);
};

const openByKeystroke = async (user: ReturnType<typeof userEvent.setup>, input: HTMLInputElement, typed: string) => {
  // Klik 1 fokuserer feltet read-only; editoren er endnu ikke åben.
  await user.click(input);
  // Første tastetryk åbner editoren via 'key'-vejen og sætter draften til tegnet.
  await user.keyboard(typed.slice(0, 1));
  await waitFor(() => expect(input).not.toHaveAttribute('readonly'));
  if (typed.length > 1) await user.keyboard(typed.slice(1));
};

describe('Escape-kontrakt for almindelige styled-felter', () => {
  describe.each([
    ['dobbeltklik', openByDoubleClick],
    ['tastetryk', openByKeystroke],
  ] as const)('editor åbnet via %s', (_pathLabel, open) => {
    it.each(FIELD_CASES)('Escape annullerer $label-edit og gendanner committed værdi uden commit', async ({ renderManaged, typed }) => {
      const user = userEvent.setup();
      const onCommit = vi.fn();
      render(renderManaged(onCommit));

      const input = screen.getByRole('textbox') as HTMLInputElement;
      // Read-only committed display, fanget før redigering — Escape skal gendanne præcis denne streng.
      const committedDisplay = input.value;
      expect(input).toHaveAttribute('readonly');

      await open(user, input, typed);
      // Draften skal faktisk afvige, ellers tester vi ikke en reel annullering.
      expect(input.value).not.toBe(committedDisplay);

      await user.keyboard('{Escape}');

      expect(input).toHaveValue(committedDisplay);
      expect(onCommit).not.toHaveBeenCalled();
      // Editoren skal lukke igen (feltet bliver read-only).
      await waitFor(() => expect(input).toHaveAttribute('readonly'));
    });
  });
});

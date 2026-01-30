import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StyledAmountField from '../../../components/inputs/StyledAmountField';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';

type CommitEvent = { target: { value: AmountValue | undefined } };
type OnCommit = (event: CommitEvent) => void;

const renderField = (initialValue: AmountValue | undefined, onCommit: OnCommit) => {
  const Wrapper = () => {
    const [value, setValue] = React.useState<AmountValue | undefined>(initialValue);
    return (
      <StyledAmountField
        value={value}
        onCommit={(e) => {
          onCommit(e);
          setValue(e.target.value);
        }}
      />
    );
  };

  render(<Wrapper />);
  return screen.getByRole('textbox');
};

const openEditor = async (user: ReturnType<typeof userEvent.setup>, input: HTMLElement) => {
  // Two clicks: first focuses, second opens editor (two-stage activation).
  await user.click(input);
  await user.click(input);
};

describe('StyledAmountField expression behavior', () => {
  it('preserves expression errors across blur and focus', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn<OnCommit>();
    const input = renderField(undefined, onCommit);

    await openEditor(user, input);
    await user.type(input, '1+');
    await user.tab();

    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue('Fejl');

    await user.click(input);
    expect(input).toHaveValue('Fejl');

    await openEditor(user, input);
    // Critical: error draft must survive and re-open exactly as entered.
    expect(input).toHaveValue('1+');

    await user.clear(input);
    await user.type(input, '1+2');
    await user.tab();

    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        target: {
          value: { kind: 'expression', expression: '1+2', value: 3 },
        },
      })
    );
    expect(input).toHaveValue('3,00');
  });

  it('opens editor with expression draft when value is expression', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn<OnCommit>();
    const input = renderField({ kind: 'expression', expression: '1+2', value: 3 }, onCommit);

    expect(input).toHaveValue('3,00');

    await openEditor(user, input);

    expect(input).toHaveValue('1+2');
    expect(onCommit).not.toHaveBeenCalled();
  });
});

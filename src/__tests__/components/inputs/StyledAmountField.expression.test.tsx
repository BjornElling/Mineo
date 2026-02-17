import * as React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StyledAmountField from '../../../components/inputs/StyledAmountField';
import type { AmountValue } from '../../../schemas/amountExpressionSchema';

type CommitEvent = { target: { value: AmountValue | undefined } };
type OnCommit = (event: CommitEvent) => void;

const renderField = (
  initialValue: AmountValue | undefined,
  onCommit: OnCommit,
  props?: Partial<React.ComponentProps<typeof StyledAmountField>>
) => {
  const Wrapper = () => {
    const [value, setValue] = React.useState<AmountValue | undefined>(initialValue);
    return (
      <StyledAmountField
        value={value}
        onCommit={(e) => {
          onCommit(e);
          setValue(e.target.value);
        }}
        {...props}
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
    expect(input).toHaveValue('1+');

    await user.click(input);
    expect(input).toHaveValue('1+');

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

  it('clears error state when draft is emptied', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn<OnCommit>();
    const input = renderField(undefined, onCommit);

    await openEditor(user, input);
    await user.type(input, '1+');
    await user.tab();

    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue('1+');

    await openEditor(user, input);
    await user.clear(input);
    await user.tab();

    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        target: {
          value: undefined,
        },
      })
    );
    expect(input).toHaveValue('');
  });

  it('normalizes -0 to 0 on commit', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn<OnCommit>();
    const input = renderField(undefined, onCommit);

    await openEditor(user, input);
    await user.type(input, '-0');
    await user.tab();

    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        target: {
          value: { kind: 'number', value: 0 },
        },
      })
    );
    expect(input).toHaveValue('0,00');
  });

  it('removes all non-allowed characters on paste', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn<OnCommit>();
    const input = renderField(undefined, onCommit);

    await user.click(input);
    await user.paste(input, 'ab1c2,3d');
    await user.tab();

    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        target: {
          value: { kind: 'number', value: 12.3 },
        },
      })
    );
    expect(input).toHaveValue('12,30');
  });

  it('blocks unary minus typing when allowNegative=false', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn<OnCommit>();
    const input = renderField(undefined, onCommit, { allowNegative: false });

    await openEditor(user, input);
    await user.type(input, '-100');
    await user.tab();

    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        target: {
          value: { kind: 'number', value: 100 },
        },
      })
    );
    expect(input).toHaveValue('100,00');
  });

  it('ignores leading minus in first key activation when allowNegative=false', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn<OnCommit>();
    const input = renderField(undefined, onCommit, { allowNegative: false });

    await user.click(input);
    await user.keyboard('-');
    await user.keyboard('1');
    await user.tab();

    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        target: {
          value: { kind: 'number', value: 1 },
        },
      })
    );
    expect(input).toHaveValue('1,00');
  });

  it('blocks unary minus paste when allowNegative=false', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn<OnCommit>();
    const input = renderField(undefined, onCommit, { allowNegative: false });

    await openEditor(user, input);
    await user.paste(input, '-123');
    await user.tab();

    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue('');
  });
});

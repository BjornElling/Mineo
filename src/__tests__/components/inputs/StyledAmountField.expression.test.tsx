// @vitest-environment jsdom
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
          return true;
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
  const TEST_TIMEOUT_MS = 15000;

  it('viser kr.-enheden både i hvile og under indtastning, uden for input-værdien', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn<OnCommit>();
    const input = renderField({ kind: 'number', value: 12500 }, onCommit);

    const adornment = screen.getByText('kr.').closest('.MuiInputAdornment-root') as HTMLElement;

    // I hvile: enheden er synlig, men er ikke en del af input-værdien.
    expect(window.getComputedStyle(adornment).visibility).toBe('visible');
    expect(input).toHaveValue('12.500,00');

    // Under indtastning: enheden forbliver synlig.
    await openEditor(user, input);
    expect(window.getComputedStyle(adornment).visibility).toBe('visible');
  }, TEST_TIMEOUT_MS);

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
  }, TEST_TIMEOUT_MS);

  it('opens editor with expression draft when value is expression', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn<OnCommit>();
    const input = renderField({ kind: 'expression', expression: '1+2', value: 3 }, onCommit);

    expect(input).toHaveValue('3,00');

    await openEditor(user, input);

    expect(input).toHaveValue('1+2');
    expect(onCommit).not.toHaveBeenCalled();
  }, TEST_TIMEOUT_MS);

  it('does not move caret with stale click placement after typing starts', async () => {
    const rafCallbacks: FrameRequestCallback[] = [];
    const requestAnimationFrameSpy = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      rafCallbacks.push(callback);
      return rafCallbacks.length;
    });

    try {
      const user = userEvent.setup();
      const onCommit = vi.fn<OnCommit>();
      const input = renderField(undefined, onCommit);

      await openEditor(user, input);
      await user.type(input, '1');

      for (const callback of rafCallbacks.splice(0)) {
        callback(performance.now());
      }

      await user.type(input, '+');

      expect(input).toHaveValue('1+');
    } finally {
      requestAnimationFrameSpy.mockRestore();
    }
  }, TEST_TIMEOUT_MS);

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
  }, TEST_TIMEOUT_MS);

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
  }, TEST_TIMEOUT_MS);

  it('removes all non-allowed characters on paste', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn<OnCommit>();
    const input = renderField(undefined, onCommit);

    await user.click(input);
    input.focus();
    await user.paste('adffergregs//sgd1712,56//');
    await user.tab();

    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        target: {
          value: { kind: 'number', value: 1712.56 },
        },
      })
    );
    expect(input).toHaveValue('1.712,56');
  }, TEST_TIMEOUT_MS);

  it('normalizes pasted currency text during edit before commit', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn<OnCommit>();
    const input = renderField(undefined, onCommit);

    await openEditor(user, input);
    input.focus();
    await user.paste('9.602,05 kr.');
    await user.tab();

    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        target: {
          value: { kind: 'number', value: 9602.05 },
        },
      })
    );
    expect(input).toHaveValue('9.602,05');
  }, TEST_TIMEOUT_MS);

  it('pastes only the first numeric token from an expression-like string', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn<OnCommit>();
    const input = renderField(undefined, onCommit);

    await user.click(input);
    input.focus();
    await user.paste('100+25');
    await user.tab();

    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        target: {
          value: { kind: 'number', value: 100 },
        },
      })
    );
    expect(input).toHaveValue('100,00');
  }, TEST_TIMEOUT_MS);

  it('commits pasted currency text while editor is closed', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn<OnCommit>();
    const input = renderField(undefined, onCommit);

    await user.click(input);
    input.focus();
    await user.paste('9.602,05 kr.');
    await user.tab();

    expect(onCommit).toHaveBeenCalledTimes(1);
    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        target: {
          value: { kind: 'number', value: 9602.05 },
        },
      })
    );
    expect(input).toHaveValue('9.602,05');
    expect(input).toHaveAttribute('readonly');
  }, TEST_TIMEOUT_MS);

  it('ignores closed-editor paste that normalizes to empty', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn<OnCommit>();
    const input = renderField({ kind: 'number', value: 42 }, onCommit);

    await user.click(input);
    input.focus();
    await user.paste('se bilag');

    expect(onCommit).not.toHaveBeenCalled();
    expect(input).toHaveValue('42,00');
    expect(input).toHaveAttribute('readonly');
  }, TEST_TIMEOUT_MS);

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
  }, TEST_TIMEOUT_MS);

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
  }, TEST_TIMEOUT_MS);

  it('ignores pasted minus and uses the first numeric token when allowNegative=false', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn<OnCommit>();
    const input = renderField(undefined, onCommit, { allowNegative: false });

    await openEditor(user, input);
    input.focus();
    await user.paste('-123');
    await user.tab();

    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        target: {
          value: { kind: 'number', value: 123 },
        },
      })
    );
    expect(input).toHaveValue('123,00');
  }, TEST_TIMEOUT_MS);

  it('keeps pasted amount negative when the nearest real prefix character is minus and negatives are allowed', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn<OnCommit>();
    const input = renderField(undefined, onCommit, { allowNegative: true });

    await user.click(input);
    input.focus();
    await user.paste('abc - 123,45 kr.');
    await user.tab();

    expect(onCommit).toHaveBeenCalledWith(
      expect.objectContaining({
        target: {
          value: { kind: 'number', value: -123.45 },
        },
      })
    );
    expect(input).toHaveValue('-123,45');
  }, TEST_TIMEOUT_MS);

  it('blocks point typing and only blocks commas that would become adjacent', async () => {
    const user = userEvent.setup();
    const onCommit = vi.fn<OnCommit>();
    const input = renderField(undefined, onCommit);

    await openEditor(user, input);
    await user.type(input, '1.2,3,4');

    expect(input).toHaveValue('12,3,4');
  }, TEST_TIMEOUT_MS);
});

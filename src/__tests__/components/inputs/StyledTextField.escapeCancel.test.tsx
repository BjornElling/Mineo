// @vitest-environment jsdom
import { act, fireEvent, render, screen } from '@testing-library/react';
import StyledTextField from '../../../components/inputs/StyledTextField';

/**
 * Escape skal gendanne feltet til den committede værdi — uanset HVORDAN editoren blev åbnet.
 *
 * Regression: ved åbning via 'key'-vejen (klik 1 fokuserer feltet read-only, første
 * tastetryk åbner editoren OG sætter draften til det indtastede tegn) kørte
 * caret-etableringens programmatiske blur()+focus() useDraftField's onFocus igen.
 * Det gen-tog focus-snapshot'et EFTER at draften allerede indeholdt første-karakteren,
 * så Escape gendannede "a" i stedet for den committede tomme værdi — det første bogstav
 * overlevede fejlagtigt. Åbning via dobbeltklik (caret allerede sat, ingen draft endnu)
 * ramte ikke fejlen, fordi snapshot'et stadig var tomt ved re-fokus.
 */
describe('StyledTextField Escape-cancel efter to-trins-åbning', () => {
  const renderField = (multiline: boolean) => {
    const onCommit = vi.fn();
    render(
      <StyledTextField value="" onCommit={onCommit} multiline={multiline} rows={multiline ? 3 : undefined} />
    );
    const el = screen.getByRole('textbox') as HTMLInputElement | HTMLTextAreaElement;
    return { el, onCommit };
  };

  it.each([
    ['single-line', false],
    ['multiline', true],
  ])('%s: åbning via tastetryk + Escape rydder hele draften (også første tegn)', (_label, multiline) => {
    const { el, onCommit } = renderField(multiline as boolean);

    // Klik 1: feltet fokuseres read-only (editoren er endnu ikke åben).
    act(() => {
      el.focus();
    });
    expect(el).toHaveAttribute('readonly');

    // Første tastetryk åbner editoren via 'key'-vejen og sætter draften til 'a'.
    act(() => {
      fireEvent.keyDown(el, { key: 'a' });
    });
    expect(el).not.toHaveAttribute('readonly');
    expect(el).toHaveValue('a');

    // Resten af teksten skrives ind i den nu åbne editor.
    act(() => {
      fireEvent.change(el, { target: { value: 'abc' } });
    });
    expect(el).toHaveValue('abc');

    // Escape skal rydde HELE draften — første bogstav må ikke overleve.
    act(() => {
      fireEvent.keyDown(el, { key: 'Escape' });
    });
    expect(el).toHaveValue('');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it.each([
    ['single-line', false],
    ['multiline', true],
  ])('%s: åbning via klik + Escape rydder draften (uændret adfærd)', (_label, multiline) => {
    const { el, onCommit } = renderField(multiline as boolean);

    // Klik 1 fokuserer, klik 2 åbner editoren (allerede-fokuseret → to-trins åbner ved klik).
    act(() => {
      el.focus();
      fireEvent.mouseDown(el);
      fireEvent.click(el);
    });
    expect(el).not.toHaveAttribute('readonly');

    act(() => {
      fireEvent.change(el, { target: { value: 'abc' } });
    });
    expect(el).toHaveValue('abc');

    act(() => {
      fireEvent.keyDown(el, { key: 'Escape' });
    });
    expect(el).toHaveValue('');
    expect(onCommit).not.toHaveBeenCalled();
  });

  it('Escape gendanner den committede værdi (ikke kun den tomme)', () => {
    const onCommit = vi.fn();
    render(<StyledTextField value="start" onCommit={onCommit} multiline rows={3} />);
    const el = screen.getByRole('textbox') as HTMLTextAreaElement;

    act(() => {
      el.focus();
      fireEvent.mouseDown(el);
      fireEvent.click(el);
    });
    expect(el).not.toHaveAttribute('readonly');

    act(() => {
      fireEvent.change(el, { target: { value: 'start ændret' } });
    });

    act(() => {
      fireEvent.keyDown(el, { key: 'Escape' });
    });
    expect(el).toHaveValue('start');
    expect(onCommit).not.toHaveBeenCalled();
  });
});

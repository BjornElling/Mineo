import { fireEvent, render, screen } from '@testing-library/react';
import StyledTextField from '../../../components/inputs/StyledTextField';

/**
 * Ved to-trins-aktivering (klik 1 fokuserer, klik 2 åbner editoren) skal caret'en
 * på et UDFYLDT felt bevares dér, hvor den stod ved klikket — ikke tvinges til
 * enden. Caret-etableringen (blur()+focus()+setSelectionRange) ejes af
 * useTwoStageInputActivation; her verificeres kontrakten: den caret-position der
 * gælder når editoren åbner, overlever det programmatiske re-fokus.
 *
 * Bruger fireEvent (ikke userEvent) for at styre selection-tilstanden præcist før
 * klik 2 — userEvents click-simulering nulstiller selv selection til enden.
 */
const openEditorPreservingCaret = (multiline: boolean) => {
  render(<StyledTextField value="hej med dig" onCommit={vi.fn()} multiline={multiline} rows={multiline ? 3 : undefined} />);
  const el = screen.getByRole('textbox') as HTMLInputElement | HTMLTextAreaElement;

  // Feltet er allerede fokuseret med caret midt i teksten (svarende til at klik 1
  // har fokuseret feltet og placeret caret'en dér, hvor brugeren klikkede).
  el.focus();
  el.setSelectionRange(4, 4);

  // Klik åbner editoren (allerede-fokuseret → to-trins åbner ved klik) og kører
  // caret-etableringen. Den eksisterende caret-position skal bevares — ikke tvinges
  // til enden.
  fireEvent.mouseDown(el);
  fireEvent.click(el);

  expect(el).not.toHaveAttribute('readonly');
  expect(el.selectionStart).toBe(4);
  expect(el.selectionEnd).toBe(4);
};

describe('StyledTextField caret preservation on editor open', () => {
  it('single-line: preserves caret position from click', () => {
    openEditorPreservingCaret(false);
  });

  it('multiline: preserves caret position from click', () => {
    openEditorPreservingCaret(true);
  });
});

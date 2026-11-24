// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Container from '../../../components/layout/Container';
import TextLinkButton from '../../../components/inputs/TextLinkButton';
import { CONTAINER_FOCUSABLE_SELECTOR } from '../../../components/tables/gridCore/tableFocusHelpers';

/**
 * Reparationslinkene i «Fejl og advarsler» og Stamdata-linket lå uden for Containerens Tab-ring, og Enter
 * på et fokuseret link flyttede fokus til sidens første felt i stedet for at følge linket (BB-463/BB-464).
 * Testene måler adfærden i en ægte Container – Tab når linket, Enter og mellemrum aktiverer det og lader
 * fokus blive – så en senere ændring til fx et `<span>` med markøren også fanges.
 */

// JSDOM giver ingen layout: ingen bokse og altid `offsetParent === null`. Containerens inventar medtager
// kun synlige mål, så begge synlighedssignaler simuleres for alle elementer.
const getRectsSpy = vi.spyOn(HTMLElement.prototype, 'getClientRects');
const offsetParentSpy = vi.spyOn(HTMLElement.prototype, 'offsetParent', 'get');

const renderInContainer = () => {
  const onClick = vi.fn();
  render(
    <Container>
      <input data-testid="perioden" type="text" />
      <TextLinkButton onClick={onClick}>Sygedagpenge</TextLinkButton>
      <input data-testid="efterfoelgende" type="text" />
    </Container>
  );
  return {
    onClick,
    link: screen.getByRole('button', { name: 'Sygedagpenge' }),
    perioden: screen.getByTestId('perioden'),
    efterfoelgende: screen.getByTestId('efterfoelgende'),
  };
};

describe('TextLinkButton', () => {
  beforeAll(() => {
    getRectsSpy.mockImplementation(() => {
      const rects = [{
        x: 0, y: 0, width: 10, height: 10, top: 0, left: 0, right: 10, bottom: 10, toJSON: () => ({}),
      } as DOMRect];
      return Object.assign(rects, { item: (index: number) => rects[index] ?? null }) as DOMRectList;
    });
    offsetParentSpy.mockImplementation(() => document.body);
  });

  afterAll(() => {
    getRectsSpy.mockRestore();
    offsetParentSpy.mockRestore();
  });

  it('er en native knap med Containerens opt-in-markør og indgår i fokusinventaret', () => {
    const { link } = renderInContainer();

    expect(link.tagName).toBe('BUTTON');
    expect(link).toHaveAttribute('type', 'button');
    expect(link).toHaveAttribute('data-mineo-focusable-button', 'true');
    expect(link.matches(CONTAINER_FOCUSABLE_SELECTOR)).toBe(true);
  });

  it('nås med Tab fra feltet før og fører videre til feltet efter', async () => {
    const user = userEvent.setup();
    const { link, perioden, efterfoelgende } = renderInContainer();

    // Fokusflytningen er asynkron under belastning (fuld suite); vent på den frem for at aflæse straks.
    act(() => perioden.focus());
    await waitFor(() => expect(perioden).toHaveFocus());
    await user.keyboard('{Tab}');
    await waitFor(() => expect(link).toHaveFocus());

    await user.keyboard('{Tab}');
    await waitFor(() => expect(efterfoelgende).toHaveFocus());
  });

  it('Enter følger linket og flytter ikke fokus til et felt', async () => {
    const user = userEvent.setup();
    const { onClick, link, perioden, efterfoelgende } = renderInContainer();

    act(() => link.focus());
    await user.keyboard('{Enter}');

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(perioden).not.toHaveFocus();
    expect(efterfoelgende).not.toHaveFocus();
  });

  it('mellemrum følger linket', async () => {
    const user = userEvent.setup();
    const { onClick, link } = renderInContainer();

    act(() => link.focus());
    await user.keyboard('[Space]');

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('bærer rækkens tekstklasse som standard og kun linkklassen midt i en sætning', () => {
    render(
      <>
        <TextLinkButton onClick={vi.fn()}>I rækken</TextLinkButton>
        <TextLinkButton placement="inline" onClick={vi.fn()}>I teksten</TextLinkButton>
      </>
    );

    expect(screen.getByRole('button', { name: 'I rækken' })).toHaveClass('row--text', 'icon-text-link');
    const inline = screen.getByRole('button', { name: 'I teksten' });
    expect(inline).toHaveClass('icon-text-link');
    expect(inline).not.toHaveClass('row--text');
  });
});

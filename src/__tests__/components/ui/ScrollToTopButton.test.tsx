import {
  describe,
  it,
  expect,
  vi,
  afterEach
} from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import React from 'react';
import '@testing-library/jest-dom/vitest';

import ScrollToTopButton from '../../../components/ui/ScrollToTopButton';
import { ScrollContainerProvider } from '../../../contexts/ScrollContainerContext';
import { SCROLL_VISIBILITY_THRESHOLD_PX } from '../../../config/scrollToTopConfig';

function createScrollContainer(initialScrollTop = 0) {
  const el = document.createElement('div');

  Object.defineProperty(el, 'scrollTop', {
    writable: true,
    configurable: true,
    value: initialScrollTop,
  });

  el.scrollTo = vi.fn();
  el.style.height = '500px';
  el.style.overflow = 'auto';

  return el;
}

describe('ScrollToTopButton', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('viser knappen når scrollTop overstiger threshold', async () => {
    const container = createScrollContainer(0);
    const ref = { current: container };

    render(
      <ScrollContainerProvider containerRef={ref}>
        <ScrollToTopButton />
      </ScrollContainerProvider>
    );

    expect(screen.queryByLabelText('Scroll til toppen')).not.toBeInTheDocument();

    act(() => {
      container.scrollTop = SCROLL_VISIBILITY_THRESHOLD_PX + 50;
      container.dispatchEvent(new Event('scroll'));
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Scroll til toppen')).toBeInTheDocument();
    });
  });

  it('kalder scrollTo med smooth behavior ved klik', async () => {
    const container = createScrollContainer(SCROLL_VISIBILITY_THRESHOLD_PX + 50);
    const ref = { current: container };
    const user = userEvent.setup();

    render(
      <ScrollContainerProvider containerRef={ref}>
        <ScrollToTopButton />
      </ScrollContainerProvider>
    );

    act(() => {
      container.dispatchEvent(new Event('scroll'));
    });

    const button = await screen.findByLabelText('Scroll til toppen');
    await user.click(button);

    expect(container.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: 'smooth',
    });
  });

  it('skifter korrekt mellem scroll-containere under runtime', async () => {
    const containerA = createScrollContainer(0);
    const containerB = createScrollContainer(0);

    const refA = { current: containerA };
    const refB = { current: containerB };

    const { rerender } = render(
      <ScrollContainerProvider containerRef={refA}>
        <ScrollToTopButton />
      </ScrollContainerProvider>
    );

    act(() => {
      containerA.scrollTop = SCROLL_VISIBILITY_THRESHOLD_PX + 100;
      containerA.dispatchEvent(new Event('scroll'));
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Scroll til toppen')).toBeInTheDocument();
    });

    rerender(
      <ScrollContainerProvider containerRef={refB}>
        <ScrollToTopButton />
      </ScrollContainerProvider>
    );

    act(() => {
      containerB.scrollTop = SCROLL_VISIBILITY_THRESHOLD_PX + 100;
      containerB.dispatchEvent(new Event('scroll'));
    });

    await waitFor(() => {
      expect(screen.getByLabelText('Scroll til toppen')).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByLabelText('Scroll til toppen'));

    expect(containerB.scrollTo).toHaveBeenCalled();
    expect(containerA.scrollTo).not.toHaveBeenCalled();
  });
});

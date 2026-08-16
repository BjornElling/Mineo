// @vitest-environment jsdom
import * as React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import {
  __resetOverlayStackForTest,
  type OverlayCloseCause,
} from '../../components/ui/overlayBehavior';
import { useOverlayBehavior } from '../../hooks/useOverlayBehavior';

const OverlayHarness = ({ busy }: { busy: boolean }) => {
  const [open, setOpen] = React.useState(true);
  const onClose = React.useCallback((cause: OverlayCloseCause): boolean => {
    if (busy) return false;
    expect(cause).toBe('history-back');
    setOpen(false);
    return true;
  }, [busy]);
  const { overlayRootProps } = useOverlayBehavior({ open, onClose });

  return open ? <div {...overlayRootProps} data-testid="overlay" /> : null;
};

describe('useOverlayBehavior', () => {
  beforeEach(() => {
    __resetOverlayStackForTest();
    window.history.replaceState({ test: 'base' }, '', '/overlay-test');
  });

  afterEach(() => {
    __resetOverlayStackForTest();
  });

  it('gendanner historikbeskyttelsen, hvis tilbage-knappen afvises under travlhed', async () => {
    const rendered = render(<OverlayHarness busy />);

    await waitFor(() => expect(window.history.state).toEqual({ __mineoOverlay: expect.any(String) }));
    act(() => { window.history.back(); });

    await waitFor(() => expect(screen.getByTestId('overlay')).toBeInTheDocument());
    expect(window.history.state).toEqual({ __mineoOverlay: expect.any(String) });

    rendered.rerender(<OverlayHarness busy={false} />);
    act(() => { window.history.back(); });

    await waitFor(() => expect(screen.queryByTestId('overlay')).not.toBeInTheDocument());
    expect(window.history.state).toEqual({ test: 'base' });
  });
});

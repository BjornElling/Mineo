import { render, act } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom/vitest';

import Overlay from '../../../components/ui/Overlay';

describe('Overlay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('lukker success-overlay efter sin varighed selv når forælderen re-renderer med en ny onClose-reference', () => {
    const onClose = vi.fn();

    // En wrapper der re-renderer Overlay med en frisk inline-onClose-arrow ved hver render —
    // det mønster der tidligere genstartede auto-close-timeren på hver re-render.
    const Wrapper = () => {
      const [, setTick] = React.useState(0);
      React.useEffect(() => {
        // Tving flere re-renders i løbet af nedtællingen.
        const id = setInterval(() => setTick((t) => t + 1), 500);
        return () => clearInterval(id);
      }, []);
      return <Overlay message="Gemt" type="success" onClose={() => onClose()} />;
    };

    render(<Wrapper />);

    // Success-varighed er 3000 ms. Lad re-renders ske undervejs, og bekræft at lukningen
    // ikke skubbes — onClose kaldes præcis når den oprindelige nedtælling udløber.
    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(onClose).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('lukker aldrig error-overlay automatisk', () => {
    const onClose = vi.fn();
    render(<Overlay message="Fejl" type="error" onClose={onClose} />);

    act(() => {
      vi.advanceTimersByTime(60000);
    });
    expect(onClose).not.toHaveBeenCalled();
  });
});

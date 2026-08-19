// @vitest-environment jsdom
import { render, act, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import '@testing-library/jest-dom/vitest';

import Overlay from '../../../components/ui/Overlay';

describe('Overlay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    // act-wrap: en stadig-kørende interval-callback (Wrapper'ens re-render-tick) kan ellers
    // fyre en setState uden for act, når de resterende timers drænes ("update to Wrapper not
    // wrapped in act").
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
  });

  it('lukker success-overlay efter sin varighed selv når forælderen re-renderer med en ny onClose-reference', () => {
    const onClose = vi.fn();

    // En wrapper der re-renderer Overlay med en frisk inline-onClose-arrow ved hver render –
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
    // ikke skubbes – onClose kaldes præcis når den oprindelige nedtælling udløber.
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

// Fejlbeskeden bliver stående, indtil brugeren lukker den. Den kunne tidligere KUN lukkes med et
// museklik på selve boksen: ingen synlig lukkeknap, ingen Escape, ingen plads i tab-rækkefølgen – og
// museteksten «Klik for at lukke» som eneste vejledning.
describe('Overlay: fejlbeskeden kan lukkes uden mus', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => {
    act(() => { vi.runOnlyPendingTimers(); });
    vi.useRealTimers();
  });

  /** Kører fade-ud-forsinkelsen færdig, så `onClose`-kvitteringen når frem. */
  const flushDismiss = () => { act(() => { vi.advanceTimersByTime(300); }); };

  it('har en synlig, navngivet lukkeknap', () => {
    render(<Overlay message="Fejl" type="error" onClose={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Luk besked' })).toBeInTheDocument();
  });

  it('lukker ved klik på lukkeknappen', () => {
    const onClose = vi.fn();
    render(<Overlay message="Fejl" type="error" onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Luk besked' }));
    flushDismiss();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('lukker ved Escape', () => {
    const onClose = vi.fn();
    render(<Overlay message="Fejl" type="error" onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    flushDismiss();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('kvitterer PRÆCIS én gang, selv om knappen klikkes inde i den klikbare boks', () => {
    // Boksen bevarer sin klik-til-luk-genvej for musebrugere. Uden `stopPropagation` ville knappens
    // klik boble op og udløse lukkevejen to gange.
    const onClose = vi.fn();
    render(<Overlay message="Fejl" type="error" onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: 'Luk besked' }));
    flushDismiss();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('oplyses som en alert, så en skærmlæser får beskeden', () => {
    render(<Overlay message="Fejl" type="error" onClose={vi.fn()} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Fejl');
  });

  it('bevarer museklikket på boksen som genvej', () => {
    const onClose = vi.fn();
    render(<Overlay message="Fejl" type="error" onClose={onClose} />);

    fireEvent.click(screen.getByRole('alert'));
    flushDismiss();
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});

describe('Overlay: de auto-lukkende varianter er uændrede', () => {
  beforeEach(() => { vi.useFakeTimers(); });
  afterEach(() => {
    act(() => { vi.runOnlyPendingTimers(); });
    vi.useRealTimers();
  });

  it('har INGEN lukkeknap – de forsvinder selv', () => {
    render(<Overlay message="Gemt" type="success" onClose={vi.fn()} />);
    expect(screen.queryByRole('button', { name: 'Luk besked' })).not.toBeInTheDocument();
  });

  it('reagerer ikke på Escape, så tasten forbliver dialogens og feltets', () => {
    // En Escape-lytter på en besked, der lukker af sig selv, ville stjæle tasten fra en åben dialog
    // eller en igangværende feltredigering – én Escape må kun gøre én ting.
    const onClose = vi.fn();
    render(<Overlay message="Gemt" type="success" onClose={onClose} />);

    fireEvent.keyDown(document, { key: 'Escape' });
    act(() => { vi.advanceTimersByTime(300); });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('bruger den høflige `status`-rolle frem for `alert`', () => {
    render(<Overlay message="Gemt" type="success" onClose={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Gemt');
  });
});

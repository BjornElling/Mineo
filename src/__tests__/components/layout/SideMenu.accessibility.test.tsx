// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import SideMenu from '../../../components/layout/SideMenu';

describe('SideMenu — tastatur og aktiv side', () => {
  it('holder menuknapperne i den normale tastatursekvens og markerer aktiv side', () => {
    render(
      <SideMenu
        activePage="renteberegning"
        onPageChange={vi.fn()}
        onGem={vi.fn()}
        onHent={vi.fn()}
        onSletAlt={vi.fn()}
        sletAltButtonRef={React.createRef<HTMLButtonElement>()}
      />
    );

    const menuButton = screen.getByRole('button', { name: 'Renteberegning' });
    expect(menuButton).toHaveAttribute('tabindex', '0');
    expect(menuButton).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('button', { name: 'Stamdata' })).not.toHaveAttribute('aria-current');

    // Alle globale menuhandlinger skal kunne nås uden pointer; Containerens feltinventar ejer ikke
    // sidemenuen, så tabIndex={-1} ville ellers gøre dem permanent museafhængige.
    for (const button of screen.getAllByRole('button')) {
      expect(button).not.toHaveAttribute('tabindex', '-1');
    }
  });

  /**
   * `Slet alt`-bekræftelsen kan ikke huske sit fokusmål selv: menuknappen kalder `preventDefault()` i
   * `onMouseDown` for at bevare felt-fokus, så den bliver aldrig `activeElement`. Refen ER derfor
   * restore-målet (`keyboard-navigation.md` §Popup-fokus-restore, målprioritet 1) — bindes den til den
   * forkerte knap eller slet ikke, lander fokus et vilkårligt sted efter en lukket dialog.
   */
  it('binder Slet alt-refen til netop Slet alt-knappen', () => {
    const sletAltButtonRef = React.createRef<HTMLButtonElement>();
    render(
      <SideMenu
        activePage="stamdata"
        onPageChange={vi.fn()}
        onGem={vi.fn()}
        onHent={vi.fn()}
        onSletAlt={vi.fn()}
        sletAltButtonRef={sletAltButtonRef}
      />
    );

    expect(sletAltButtonRef.current).toBe(screen.getByRole('button', { name: 'Slet alt' }));
  });
});
